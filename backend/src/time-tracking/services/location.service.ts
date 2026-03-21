import db from '../../shared/database/connection';
import logger from '../../shared/utils/logger';

const BUDDY_PUNCH_RADIUS_METERS = 50; // Flag if two employees clock in within 50m
const EARTH_RADIUS_KM = 6371;

/**
 * Check for buddy punch — two different employees clocking in from nearly the same location.
 */
export async function checkBuddyPunch(
  orgId: string,
  userId: string,
  lat: number,
  lon: number,
): Promise<{ flagged: boolean; nearbyUserId?: string; distanceMeters?: number }> {
  // Find other clock-ins from the last 10 minutes within the radius
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

  const recentEntries = await db('clock_entries')
    .where({ org_id: orgId })
    .whereNot({ user_id: userId })
    .where('clock_in', '>=', tenMinAgo)
    .whereNotNull('location_lat')
    .whereNotNull('location_lon')
    .select('user_id', 'location_lat', 'location_lon');

  for (const entry of recentEntries) {
    const distance = haversineDistance(
      lat,
      lon,
      Number(entry.location_lat),
      Number(entry.location_lon),
    );

    if (distance <= BUDDY_PUNCH_RADIUS_METERS) {
      logger.warn('Buddy punch detected', {
        orgId,
        userId,
        nearbyUserId: entry.user_id,
        distanceMeters: Math.round(distance),
      });
      return {
        flagged: true,
        nearbyUserId: entry.user_id,
        distanceMeters: Math.round(distance),
      };
    }
  }

  return { flagged: false };
}

/**
 * Check if a location is within an org's work zones (from work_zones table).
 */
export async function checkGeofence(
  orgId: string,
  lat: number,
  lon: number,
): Promise<{ insideZone: boolean; zoneName?: string; distanceFromZone?: number }> {
  const zones = await db('work_zones')
    .where({ org_id: orgId, is_active: true })
    .select('name', 'lat', 'lon', 'radius_meters');

  if (zones.length === 0) {
    return { insideZone: true }; // No zones defined = allow everywhere
  }

  for (const zone of zones) {
    const distance = haversineDistance(lat, lon, Number(zone.lat), Number(zone.lon));
    if (distance <= (zone.radius_meters || 200)) {
      return { insideZone: true, zoneName: zone.name };
    }
  }

  // Outside all zones
  const nearest = zones.reduce(
    (min: { name: string; dist: number }, zone: any) => {
      const dist = haversineDistance(lat, lon, Number(zone.lat), Number(zone.lon));
      return dist < min.dist ? { name: zone.name, dist } : min;
    },
    { name: '', dist: Infinity },
  );

  logger.warn('Clock-in outside geofence', {
    orgId,
    lat,
    lon,
    nearestZone: nearest.name,
    distanceMeters: Math.round(nearest.dist),
  });

  return {
    insideZone: false,
    zoneName: nearest.name,
    distanceFromZone: Math.round(nearest.dist),
  };
}

/**
 * Haversine distance between two GPS points in meters.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c * 1000; // Convert km to meters
}
