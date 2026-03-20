import axios from 'axios';
import db from '../../shared/database/connection';
import redis from '../../shared/database/redis';
import { emitToOrg } from '../../shared/websocket/socket';
import logger from '../../shared/utils/logger';

const ROUTE_CACHE_TTL = 300; // 5 minutes
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export interface DispatcherRoute {
  id: string;
  name: string;
  stops: number;
  assignedDriverId?: string;
  status: string;
}

interface DispatcherConfig {
  dispatcherApiUrl: string;
  dispatcherApiKey: string;
}

/**
 * Get dispatcher config from org's config JSONB.
 */
async function getDispatcherConfig(orgId: string): Promise<DispatcherConfig | null> {
  const org = await db('orgs').where({ id: orgId }).select('config').first();
  if (!org?.config) return null;

  const config = typeof org.config === 'string' ? JSON.parse(org.config) : org.config;
  if (!config.dispatcher_api_url) return null;

  return {
    dispatcherApiUrl: config.dispatcher_api_url,
    dispatcherApiKey: config.dispatcher_api_key || '',
  };
}

/**
 * Fetch routes from dispatcher API and cache in Redis.
 */
export async function fetchAndCacheRoutes(orgId: string): Promise<DispatcherRoute[]> {
  const cacheKey = `routes:${orgId}`;

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const config = await getDispatcherConfig(orgId);
  if (!config) {
    logger.debug('No dispatcher config for org', { orgId });
    return [];
  }

  try {
    const response = await axios.get(`${config.dispatcherApiUrl}/routes`, {
      headers: {
        Authorization: `Bearer ${config.dispatcherApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const routes: DispatcherRoute[] = response.data.routes || response.data || [];

    // Cache in Redis
    await redis.setex(cacheKey, ROUTE_CACHE_TTL, JSON.stringify(routes));

    logger.info('Routes fetched from dispatcher', { orgId, count: routes.length });
    return routes;
  } catch (err) {
    logger.error('Dispatcher API fetch failed', {
      orgId,
      error: (err as Error).message,
    });
    return [];
  }
}

/**
 * Post a clock event back to the dispatcher API.
 */
export async function postClockEvent(
  orgId: string,
  event: {
    type: 'clock_in' | 'clock_out';
    userId: string;
    routeId?: string;
    timestamp: string;
  },
): Promise<void> {
  const config = await getDispatcherConfig(orgId);
  if (!config) return;

  try {
    await axios.post(`${config.dispatcherApiUrl}/events`, event, {
      headers: {
        Authorization: `Bearer ${config.dispatcherApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    logger.info('Clock event posted to dispatcher', { orgId, type: event.type });
  } catch (err) {
    logger.warn('Failed to post clock event to dispatcher', {
      orgId,
      error: (err as Error).message,
    });
  }
}

/**
 * Start polling dispatcher for all orgs that have dispatcher configured.
 */
export function startDispatcherPolling(): void {
  logger.info('Starting dispatcher polling service');

  const poll = async () => {
    try {
      const orgs = await db('orgs')
        .where({ is_active: true })
        .whereRaw("config->>'dispatcher_api_url' IS NOT NULL")
        .select('id');

      for (const org of orgs) {
        const previousRoutes = await redis.get(`routes:${org.id}`);
        const routes = await fetchAndCacheRoutes(org.id);

        // If routes changed, push update via WebSocket
        if (previousRoutes && JSON.stringify(routes) !== previousRoutes) {
          emitToOrg(org.id, 'routes_updated', { routes });
          logger.info('Route update pushed via WebSocket', { orgId: org.id });
        }
      }
    } catch (err) {
      logger.error('Dispatcher polling error', { error: (err as Error).message });
    }
  };

  // Initial poll
  poll();

  // Poll every 5 minutes
  setInterval(poll, POLL_INTERVAL);
}

/**
 * Get cached routes for an org.
 */
export async function getCachedRoutes(orgId: string): Promise<DispatcherRoute[]> {
  const cacheKey = `routes:${orgId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  return fetchAndCacheRoutes(orgId);
}
