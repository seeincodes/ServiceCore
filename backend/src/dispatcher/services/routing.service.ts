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
 * Optimize the order of multiple stops using OpenRouteService's optimization API.
 * Solves the Traveling Salesman Problem for waste collection routes.
 */
export async function optimizeRoute(stops: RouteStop[]): Promise<OptimizedRoute> {
  if (stops.length < 2) {
    return { stops, totalDistanceKm: 0, totalDurationMin: 0, geometry: [] };
  }

  if (!ORS_API_KEY) {
    logger.warn('ORS_API_KEY not set, returning stops in original order');
    return { stops, totalDistanceKm: 0, totalDurationMin: 0, geometry: [] };
  }

  try {
    // Build optimization request
    // Vehicles: one vehicle starting and ending at the first stop
    // Jobs: each stop is a job to visit
    const vehicles = [
      {
        id: 1,
        profile: 'driving-car',
        start: [stops[0].lon, stops[0].lat], // ORS uses [lon, lat]
        end: [stops[0].lon, stops[0].lat],
      },
    ];

    const jobs = stops.slice(1).map((stop, i) => ({
      id: i + 1,
      location: [stop.lon, stop.lat],
      service: 300, // 5 minutes per stop (waste pickup time)
    }));

    const response = await axios.post(
      `${ORS_BASE_URL}/optimization`,
      { jobs, vehicles },
      {
        headers: {
          Authorization: ORS_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    const solution = response.data;

    if (!solution.routes || solution.routes.length === 0) {
      logger.warn('ORS optimization returned no routes');
      return { stops, totalDistanceKm: 0, totalDurationMin: 0, geometry: [] };
    }

    const route = solution.routes[0];

    // Reorder stops based on optimization result
    const optimizedStops: RouteStop[] = [stops[0]]; // Start with depot
    for (const step of route.steps) {
      if (step.type === 'job') {
        const originalStop = stops[step.job]; // job IDs map to stops index + 1
        if (originalStop) optimizedStops.push(originalStop);
      }
    }

    // Get directions for the optimized order
    const directions = await getDirections(optimizedStops);

    return {
      stops: optimizedStops,
      totalDistanceKm: Math.round((route.distance / 1000) * 10) / 10,
      totalDurationMin: Math.round(route.duration / 60),
      geometry: directions?.geometry || [],
    };
  } catch (err) {
    logger.error('Route optimization failed', { error: (err as Error).message });
    return { stops, totalDistanceKm: 0, totalDurationMin: 0, geometry: [] };
  }
}

/**
 * Get driving directions between ordered stops.
 */
export async function getDirections(stops: RouteStop[]): Promise<RouteDirections | null> {
  if (stops.length < 2) return null;

  if (!ORS_API_KEY) {
    logger.warn('ORS_API_KEY not set, skipping directions');
    return null;
  }

  try {
    const coordinates = stops.map((s) => [s.lon, s.lat]); // ORS uses [lon, lat]

    const response = await axios.post(
      `${ORS_BASE_URL}/v2/directions/driving-car/geojson`,
      { coordinates },
      {
        headers: {
          Authorization: ORS_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );

    const feature = response.data.features?.[0];
    if (!feature) return null;

    const props = feature.properties;
    const coords = feature.geometry.coordinates;

    // Convert [lon, lat] to [lat, lon] for Leaflet
    const geometry: [number, number][] = coords.map((c: number[]) => [c[1], c[0]]);

    // Extract turn-by-turn steps
    const steps: RouteStep[] = (props.segments || []).flatMap((seg: any) =>
      (seg.steps || []).map((step: any) => ({
        instruction: step.instruction,
        distanceKm: Math.round((step.distance / 1000) * 10) / 10,
        durationMin: Math.round(step.duration / 60),
      })),
    );

    return {
      distanceKm: Math.round((props.summary.distance / 1000) * 10) / 10,
      durationMin: Math.round(props.summary.duration / 60),
      geometry,
      steps,
    };
  } catch (err) {
    logger.error('Directions request failed', { error: (err as Error).message });
    return null;
  }
}
