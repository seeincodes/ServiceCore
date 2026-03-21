import axios from 'axios';
import logger from '../../shared/utils/logger';

const ORS_API_KEY = process.env.ORS_API_KEY || '';
const ORS_BASE_URL = 'https://api.openrouteservice.org';

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
 */
export async function optimizeRoute(stops: RouteStop[]): Promise<OptimizedRoute> {
  if (stops.length < 2) {
    return { stops, totalDistanceKm: 0, totalDurationMin: 0, geometry: [] };
  }

  // Optimize stop order using nearest-neighbor
  const optimizedStops = nearestNeighborOptimize(stops);

  // Get real driving directions for the optimized order
  const directions = await getDirections(optimizedStops);

  return {
    stops: optimizedStops,
    totalDistanceKm: directions?.distanceKm || 0,
    totalDurationMin: directions?.durationMin || 0,
    geometry: directions?.geometry || [],
  };
}

/**
 * Get driving directions between ordered stops from OpenRouteService.
 * Uses GET endpoint (free tier) which supports 2 points per request,
 * so we chain segment-by-segment and merge the results.
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

    // Request directions for each consecutive pair of stops
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i];
      const to = stops[i + 1];

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

      totalDistance += props.summary.distance;
      totalDuration += props.summary.duration;

      // Convert [lon, lat] to [lat, lon] for Leaflet
      const segGeometry: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);
      // Skip first point on subsequent segments to avoid duplicates
      allGeometry.push(...(i > 0 ? segGeometry.slice(1) : segGeometry));

      // Extract turn-by-turn steps
      for (const seg of props.segments || []) {
        for (const step of seg.steps || []) {
          allSteps.push({
            instruction: step.instruction,
            distanceKm: Math.round((step.distance / 1000) * 10) / 10,
            durationMin: Math.round(step.duration / 60),
          });
        }
      }

      // Rate limit: free tier is 40 req/min, add small delay between requests
      if (i < stops.length - 2) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
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
