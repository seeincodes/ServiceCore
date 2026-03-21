import crypto from 'crypto';
import axios from 'axios';
import redis from '../../shared/database/redis';
import logger from '../../shared/utils/logger';

const ORS_API_KEY = process.env.ORS_API_KEY || '';
const ORS_BASE_URL = 'https://api.openrouteservice.org';
const ROUTE_CACHE_TTL = 86400; // 24 hours

export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface OptimizedRoute {
  stops: RouteStop[];
  totalDistanceKm: number;
  totalDurationMin: number;
  geometry: [number, number][]; // [lat, lon] pairs for the route line
  cached?: boolean;
}

export interface RouteDirections {
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][];
  steps: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distanceKm: number;
  durationMin: number;
}

/**
 * Generate a cache key from stop coordinates.
 * Same stops in same input order = same hash = cache hit.
 */
function routeCacheKey(stops: RouteStop[]): string {
  const coordStr = stops.map((s) => `${s.lat},${s.lon}`).join('|');
  const hash = crypto.createHash('md5').update(coordStr).digest('hex').slice(0, 12);
  return `route:optimized:${hash}`;
}

/**
 * Haversine distance in km between two lat/lon points.
 */
function haversineKm(a: RouteStop, b: RouteStop): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLon * sinLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Nearest-neighbor TSP solver. Starts at the first stop (depot),
 * visits all others in the order that minimizes distance to the next unvisited stop.
 */
function nearestNeighborOptimize(stops: RouteStop[]): RouteStop[] {
  if (stops.length <= 2) return stops;

  const optimized: RouteStop[] = [stops[0]]; // Start at depot
  const remaining = stops.slice(1);

  while (remaining.length > 0) {
    const current = optimized[optimized.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineKm(current, remaining[i]);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    optimized.push(remaining.splice(nearestIdx, 1)[0]);
  }

  return optimized;
}

/**
 * Optimize the order of multiple stops using nearest-neighbor heuristic,
 * then get real driving directions from OpenRouteService.
 * Results are cached in Redis for 24 hours.
 */
export async function optimizeRoute(stops: RouteStop[]): Promise<OptimizedRoute> {
  if (stops.length < 2) {
    return { stops, totalDistanceKm: 0, totalDurationMin: 0, geometry: [] };
  }

  // Check cache first
  const cacheKey = routeCacheKey(stops);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const result = JSON.parse(cached) as OptimizedRoute;
      result.cached = true;
      logger.debug('Route cache hit', { key: cacheKey });
      return result;
    }
  } catch {
    // Cache miss or Redis error — continue to compute
  }

  // Optimize stop order using nearest-neighbor
  const optimizedStops = nearestNeighborOptimize(stops);

  // Get real driving directions for the optimized order
  const directions = await getDirections(optimizedStops);

  const result: OptimizedRoute = {
    stops: optimizedStops,
    totalDistanceKm: directions?.distanceKm || 0,
    totalDurationMin: directions?.durationMin || 0,
    geometry: directions?.geometry || [],
  };

  // Cache the result (only if we got real directions)
  if (directions) {
    try {
      await redis.setex(cacheKey, ROUTE_CACHE_TTL, JSON.stringify(result));
      logger.info('Route cached', { key: cacheKey, stops: stops.length });
    } catch {
      // Non-critical — continue without caching
    }
  }

  return result;
}

/**
 * Generate a cache key for a single direction segment.
 */
function segmentCacheKey(from: RouteStop, to: RouteStop): string {
  const str = `${from.lat},${from.lon}->${to.lat},${to.lon}`;
  const hash = crypto.createHash('md5').update(str).digest('hex').slice(0, 12);
  return `route:segment:${hash}`;
}

/**
 * Get driving directions between ordered stops from OpenRouteService.
 * Uses GET endpoint (free tier) which supports 2 points per request.
 * Each segment is cached individually in Redis for 24 hours.
 */
export async function getDirections(stops: RouteStop[]): Promise<RouteDirections | null> {
  if (stops.length < 2) return null;

  if (!ORS_API_KEY) {
    logger.warn('ORS_API_KEY not set, skipping directions');
    return null;
  }

  try {
    let totalDistance = 0;
    let totalDuration = 0;
    const allGeometry: [number, number][] = [];
    const allSteps: RouteStep[] = [];

    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];
      const segKey = segmentCacheKey(from, to);

      // Check segment cache
      let segData: {
        distance: number;
        duration: number;
        geometry: [number, number][];
        steps: RouteStep[];
      } | null = null;

      try {
        const cachedSeg = await redis.get(segKey);
        if (cachedSeg) {
          segData = JSON.parse(cachedSeg);
          logger.debug('Segment cache hit', { from: from.name, to: to.name });
        }
      } catch {
        // Cache miss
      }

      // Fetch from ORS if not cached
      if (!segData) {
        const response = await axios.get(`${ORS_BASE_URL}/v2/directions/driving-car`, {
          params: {
            start: `${from.lon},${from.lat}`,
            end: `${to.lon},${to.lat}`,
          },
          headers: {
            Authorization: `Bearer ${ORS_API_KEY}`,
          },
          timeout: 10000,
        });

        const feature = response.data.features?.[0];
        if (!feature) continue;

        const props = feature.properties;
        const coords = feature.geometry.coordinates;

        segData = {
          distance: props.summary.distance,
          duration: props.summary.duration,
          geometry: coords.map((c: number[]) => [c[1], c[0]] as [number, number]),
          steps: (props.segments || []).flatMap((seg: any) =>
            (seg.steps || []).map((step: any) => ({
              instruction: step.instruction,
              distanceKm: Math.round((step.distance / 1000) * 10) / 10,
              durationMin: Math.round(step.duration / 60),
            })),
          ),
        };

        // Cache this segment
        try {
          await redis.setex(segKey, ROUTE_CACHE_TTL, JSON.stringify(segData));
        } catch {
          // Non-critical
        }

        // Rate limit: free tier is 40 req/min
        if (i < stops.length - 2) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      totalDistance += segData.distance;
      totalDuration += segData.duration;
      allGeometry.push(...(i > 0 ? segData.geometry.slice(1) : segData.geometry));
      allSteps.push(...segData.steps);
    }

    return {
      distanceKm: Math.round((totalDistance / 1000) * 10) / 10,
      durationMin: Math.round(totalDuration / 60),
      geometry: allGeometry,
      steps: allSteps,
    };
  } catch (err) {
    logger.error('Directions request failed', { error: (err as Error).message });
    return null;
  }
}
