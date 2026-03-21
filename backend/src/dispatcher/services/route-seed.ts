import db from '../../shared/database/connection';
import redis from '../../shared/database/redis';
import logger from '../../shared/utils/logger';

interface SeededRoute {
  id: string;
  name: string;
  stops: number;
  status: string;
  assignedDriverId?: string;
  waypoints: { id: string; name: string; lat: number; lon: number }[];
}

// Realistic SF Bay Area waste collection routes
const DEMO_ROUTES: Omit<SeededRoute, 'assignedDriverId'>[] = [
  {
    id: 'RT-101',
    name: 'Downtown Commercial',
    stops: 8,
    status: 'active',
    waypoints: [
      { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
      { id: 'w2', name: 'Market St & 3rd', lat: 37.7869, lon: -122.4025 },
      { id: 'w3', name: 'Union Square', lat: 37.7879, lon: -122.4074 },
      { id: 'w4', name: 'Financial District', lat: 37.7946, lon: -122.3999 },
      { id: 'w5', name: 'Embarcadero Center', lat: 37.7954, lon: -122.3962 },
      { id: 'w6', name: 'Ferry Building', lat: 37.7955, lon: -122.3935 },
      { id: 'w7', name: 'SOMA - Howard St', lat: 37.7833, lon: -122.3958 },
      { id: 'w8', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
    ],
  },
  {
    id: 'RT-102',
    name: 'Mission & Castro Residential',
    stops: 7,
    status: 'active',
    waypoints: [
      { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
      { id: 'w2', name: '16th & Mission', lat: 37.7649, lon: -122.4194 },
      { id: 'w3', name: '24th & Valencia', lat: 37.7526, lon: -122.4202 },
      { id: 'w4', name: 'Dolores Park', lat: 37.7596, lon: -122.4269 },
      { id: 'w5', name: 'Castro & 18th', lat: 37.7609, lon: -122.435 },
      { id: 'w6', name: 'Noe Valley', lat: 37.7502, lon: -122.4337 },
      { id: 'w7', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
    ],
  },
  {
    id: 'RT-103',
    name: 'Sunset District',
    stops: 6,
    status: 'active',
    waypoints: [
      { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
      { id: 'w2', name: 'Inner Sunset - Irving St', lat: 37.7637, lon: -122.4627 },
      { id: 'w3', name: 'Golden Gate Park - South', lat: 37.7694, lon: -122.4862 },
      { id: 'w4', name: 'Outer Sunset - Taraval', lat: 37.7424, lon: -122.4949 },
      { id: 'w5', name: 'Parkside - 26th Ave', lat: 37.7382, lon: -122.4838 },
      { id: 'w6', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
    ],
  },
  {
    id: 'RT-104',
    name: 'Richmond & Marina',
    stops: 7,
    status: 'active',
    waypoints: [
      { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
      { id: 'w2', name: 'Marina Blvd', lat: 37.8067, lon: -122.4371 },
      { id: 'w3', name: 'Presidio Gate', lat: 37.7989, lon: -122.4546 },
      { id: 'w4', name: 'Clement St - Inner Richmond', lat: 37.7828, lon: -122.4597 },
      { id: 'w5', name: 'Geary Blvd - Mid Richmond', lat: 37.7808, lon: -122.4706 },
      { id: 'w6', name: 'Balboa St - Outer Richmond', lat: 37.7755, lon: -122.5078 },
      { id: 'w7', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
    ],
  },
  {
    id: 'RT-105',
    name: 'Bayview & Hunters Point',
    stops: 6,
    status: 'active',
    waypoints: [
      { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
      { id: 'w2', name: 'Potrero Hill', lat: 37.7607, lon: -122.3918 },
      { id: 'w3', name: 'Dogpatch', lat: 37.7567, lon: -122.3873 },
      { id: 'w4', name: 'Bayview - 3rd St', lat: 37.7319, lon: -122.391 },
      { id: 'w5', name: 'Hunters Point', lat: 37.7247, lon: -122.3811 },
      { id: 'w6', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
    ],
  },
  {
    id: 'RT-106',
    name: 'North Beach & Chinatown',
    stops: 6,
    status: 'active',
    waypoints: [
      { id: 'w1', name: 'Depot - Bayshore Yard', lat: 37.7196, lon: -122.3992 },
      { id: 'w2', name: 'Chinatown - Grant Ave', lat: 37.7941, lon: -122.4078 },
      { id: 'w3', name: 'North Beach - Columbus', lat: 37.8005, lon: -122.4109 },
      { id: 'w4', name: 'Telegraph Hill', lat: 37.8024, lon: -122.4058 },
      { id: 'w5', name: 'Fishermans Wharf', lat: 37.808, lon: -122.4177 },
      { id: 'w6', name: 'Depot Return', lat: 37.7196, lon: -122.3992 },
    ],
  },
];

/**
 * Seeds Redis with demo route data for orgs that don't have a dispatcher API configured.
 * Assigns routes to drivers round-robin.
 */
export async function seedDemoRoutes(): Promise<void> {
  try {
    const orgs = await db('orgs').where({ is_active: true }).select('id', 'config');

    for (const org of orgs) {
      const config = typeof org.config === 'string' ? JSON.parse(org.config) : org.config || {};

      // Skip orgs with a real dispatcher API
      if (config.dispatcher_api_url) continue;

      const cacheKey = `routes:${org.id}`;
      const existing = await redis.get(cacheKey);
      if (existing) continue; // Already seeded

      // Get drivers for this org
      const drivers = await db('users')
        .where({ org_id: org.id, role: 'employee', is_active: true })
        .select('id');

      // Assign routes to drivers round-robin
      const seededRoutes: SeededRoute[] = DEMO_ROUTES.map((route, i) => ({
        ...route,
        assignedDriverId: drivers.length > 0 ? drivers[i % drivers.length].id : undefined,
      }));

      await redis.setex(cacheKey, 86400, JSON.stringify(seededRoutes)); // 24h TTL
      logger.info('Demo routes seeded', { orgId: org.id, count: seededRoutes.length });
    }
  } catch (err) {
    logger.warn('Failed to seed demo routes', { error: (err as Error).message });
  }
}
