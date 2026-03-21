import db from '../../shared/database/connection';
import logger from '../../shared/utils/logger';
import { emitToOrg } from '../../shared/websocket/socket';
import { postClockEvent } from '../../dispatcher/services/dispatcher.service';
import { checkBuddyPunch, checkGeofence } from './location.service';

const MAX_HOURS_PER_DAY = 16;

export interface ClockInParams {
  orgId: string;
  userId: string;
  projectId?: string;
  routeId?: string;
  locationLat?: number;
  locationLon?: number;
  source?: 'app' | 'sms' | 'ivr';
  idempotencyKey?: string;
}

export interface ClockInResult {
  entryId: string;
  status: 'clocked_in';
  timestamp: string;
  routeId?: string;
  projectId?: string;
}

export interface ClockOutResult {
  entryId: string;
  status: 'clocked_out';
  hoursWorked: number;
  timestamp: string;
}

export async function clockIn(params: ClockInParams): Promise<ClockInResult> {
  const { orgId, userId, projectId, routeId, locationLat, locationLon, source, idempotencyKey } =
    params;

  // Deduplication: check idempotency key
  if (idempotencyKey) {
    const existing = await db('clock_entries').where({ idempotency_key: idempotencyKey }).first();
    if (existing) {
      logger.info('Duplicate clock-in detected, returning existing entry', {
        idempotencyKey,
        entryId: existing.id,
      });
      return {
        entryId: existing.id,
        status: 'clocked_in',
        timestamp: existing.clock_in.toISOString(),
        routeId: existing.route_id,
        projectId: existing.project_id,
      };
    }
  }

  // Check if already clocked in (no clock_out)
  const openEntry = await db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .whereNull('clock_out')
    .first();

  if (openEntry) {
    throw new Error('Already clocked in. Please clock out first.');
  }

  // 16-hour safety check: total hours today
  await checkDailyHoursLimit(orgId, userId);

  // Location-based checks (non-blocking — log warnings, don't prevent clock-in)
  const locationFlags: { buddyPunch?: boolean; outsideZone?: boolean } = {};
  if (locationLat && locationLon) {
    const [buddyCheck, geoCheck] = await Promise.all([
      checkBuddyPunch(orgId, userId, locationLat, locationLon),
      checkGeofence(orgId, locationLat, locationLon),
    ]);
    locationFlags.buddyPunch = buddyCheck.flagged;
    locationFlags.outsideZone = !geoCheck.insideZone;

    if (buddyCheck.flagged) {
      emitToOrg(orgId, 'buddy_punch_alert', {
        userId,
        nearbyUserId: buddyCheck.nearbyUserId,
        distance: buddyCheck.distanceMeters,
      });
    }
    if (!geoCheck.insideZone) {
      emitToOrg(orgId, 'geofence_alert', {
        userId,
        nearestZone: geoCheck.zoneName,
        distance: geoCheck.distanceFromZone,
      });
    }
  }

  const now = new Date();

  const [entry] = await db('clock_entries')
    .insert({
      org_id: orgId,
      user_id: userId,
      clock_in: now,
      project_id: projectId,
      route_id: routeId,
      location_lat: locationLat,
      location_lon: locationLon,
      source: source || 'app',
      synced_at: source === 'app' ? now : null,
      idempotency_key: idempotencyKey,
    })
    .returning(['id', 'clock_in', 'route_id', 'project_id']);

  const result = {
    entryId: entry.id,
    status: 'clocked_in' as const,
    timestamp: entry.clock_in.toISOString(),
    routeId: entry.route_id,
    projectId: entry.project_id,
  };

  emitToOrg(orgId, 'clock_in', { userId, ...result });
  postClockEvent(orgId, {
    type: 'clock_in',
    userId,
    routeId: result.routeId,
    timestamp: result.timestamp,
  }).catch(() => {});

  return result;
}

export async function clockOut(
  orgId: string,
  userId: string,
  entryId?: string,
): Promise<ClockOutResult> {
  // Find the open entry
  const query = db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .whereNull('clock_out');

  if (entryId) {
    query.andWhere({ id: entryId });
  }

  const entry = await query.first();

  if (!entry) {
    throw new Error('No active clock-in found.');
  }

  const now = new Date();
  const hoursWorked = (now.getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);

  await db('clock_entries').where({ id: entry.id }).update({ clock_out: now });

  const result = {
    entryId: entry.id,
    status: 'clocked_out' as const,
    hoursWorked: Math.round(hoursWorked * 100) / 100,
    timestamp: now.toISOString(),
  };

  emitToOrg(orgId, 'clock_out', { userId, ...result });
  postClockEvent(orgId, { type: 'clock_out', userId, timestamp: result.timestamp }).catch(() => {});

  // Emit OT alert if approaching threshold
  if (result.hoursWorked >= 38) {
    const alertType =
      result.hoursWorked >= 45
        ? 'exceeded'
        : result.hoursWorked >= 40
          ? 'threshold'
          : 'approaching';
    emitToOrg(orgId, 'ot_alert', { userId, hours: result.hoursWorked, alertType });
  }

  return result;
}

export async function getActiveEntry(orgId: string, userId: string) {
  return db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .whereNull('clock_out')
    .first();
}

export async function getTodayHours(orgId: string, userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const entries = await db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .where('clock_in', '>=', today)
    .where('clock_in', '<', tomorrow)
    .whereNotNull('clock_out');

  let totalHours = 0;
  for (const entry of entries) {
    const hours =
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
    totalHours += hours;
  }

  return totalHours;
}

async function checkDailyHoursLimit(orgId: string, userId: string): Promise<void> {
  const totalHours = await getTodayHours(orgId, userId);

  if (totalHours >= MAX_HOURS_PER_DAY) {
    throw new Error(
      `Safety limit: You have already worked ${totalHours.toFixed(1)} hours today. Maximum is ${MAX_HOURS_PER_DAY} hours.`,
    );
  }
}
