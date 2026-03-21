import db from '../../shared/database/connection';
import { clockIn, clockOut, getActiveEntry } from './clock.service';
import { checkGeofence } from './location.service';
import { emitToOrg } from '../../shared/websocket/socket';
import { enqueueNotification } from '../../notifications/services/queue.service';
import logger from '../../shared/utils/logger';

/**
 * Process a GPS ping from a driver. Handles:
 * - Auto clock-in when entering a work zone
 * - Auto clock-out when leaving all work zones
 * - Silent location tracking throughout the day
 */
export async function processLocationPing(
  orgId: string,
  userId: string,
  lat: number,
  lon: number,
): Promise<{
  action: 'auto_clock_in' | 'auto_clock_out' | 'tracking' | 'none';
  details?: any;
}> {
  // Store the location ping for tracking
  await storeLocationPing(orgId, userId, lat, lon);

  const geoCheck = await checkGeofence(orgId, lat, lon);
  const activeEntry = await getActiveEntry(orgId, userId);

  // --- AUTO CLOCK-IN ---
  if (geoCheck.insideZone && !activeEntry) {
    // Verify they've been in the zone for at least 2 minutes (avoid drive-throughs)
    const confirmed = await confirmZonePresence(orgId, userId, lat, lon);
    if (!confirmed) {
      return { action: 'none' };
    }

    try {
      const result = await clockIn({
        orgId,
        userId,
        locationLat: lat,
        locationLon: lon,
        source: 'app',
        idempotencyKey: `auto-${userId}-${new Date().toISOString().split('T')[0]}`,
      });

      await db('audit_log').insert({
        org_id: orgId,
        user_id: userId,
        action: 'auto_clock_in',
        entity_type: 'clock_entry',
        details: JSON.stringify({ lat, lon, zone: geoCheck.zoneName, entryId: result.entryId }),
      });

      emitToOrg(orgId, 'auto_clock_in', {
        userId,
        zoneName: geoCheck.zoneName,
        timestamp: result.timestamp,
      });

      logger.info('Auto clock-in triggered', { orgId, userId, zone: geoCheck.zoneName });

      return {
        action: 'auto_clock_in',
        details: { zone: geoCheck.zoneName, entryId: result.entryId },
      };
    } catch (err) {
      // Already clocked in or daily limit — not an error
      logger.debug('Auto clock-in skipped', { reason: (err as Error).message });
      return { action: 'none' };
    }
  }

  // --- AUTO CLOCK-OUT ---
  if (!geoCheck.insideZone && activeEntry) {
    // Verify they've been outside the zone for at least 5 minutes (avoid brief exits)
    const confirmedOut = await confirmZoneExit(orgId, userId);
    if (!confirmedOut) {
      return { action: 'tracking' };
    }

    try {
      const result = await clockOut(orgId, userId);

      await db('audit_log').insert({
        org_id: orgId,
        user_id: userId,
        action: 'auto_clock_out',
        entity_type: 'clock_entry',
        details: JSON.stringify({ lat, lon, hoursWorked: result.hoursWorked }),
      });

      // Send end-of-day summary
      await sendEndOfDaySummary(orgId, userId, result.hoursWorked, result.entryId);

      logger.info('Auto clock-out triggered', {
        orgId,
        userId,
        hoursWorked: result.hoursWorked,
      });

      return {
        action: 'auto_clock_out',
        details: { hoursWorked: result.hoursWorked },
      };
    } catch (err) {
      logger.debug('Auto clock-out skipped', { reason: (err as Error).message });
      return { action: 'none' };
    }
  }

  return { action: activeEntry ? 'tracking' : 'none' };
}

/**
 * Store a GPS ping for location history.
 */
async function storeLocationPing(
  orgId: string,
  userId: string,
  lat: number,
  lon: number,
): Promise<void> {
  try {
    await db('audit_log').insert({
      org_id: orgId,
      user_id: userId,
      action: 'location_ping',
      entity_type: 'gps',
      details: JSON.stringify({ lat, lon, timestamp: new Date().toISOString() }),
    });
  } catch {
    // Non-critical — don't fail on ping storage errors
  }
}

/**
 * Confirm driver has been inside a work zone for at least 2 minutes
 * by checking the last 2 pings were also inside a zone.
 */
async function confirmZonePresence(
  orgId: string,
  userId: string,
  lat: number,
  lon: number,
): Promise<boolean> {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);

  const recentPings = await db('audit_log')
    .where({ org_id: orgId, user_id: userId, action: 'location_ping' })
    .where('created_at', '>', twoMinAgo)
    .orderBy('created_at', 'desc')
    .limit(2);

  // Need at least 2 recent pings to confirm presence (not a drive-through)
  if (recentPings.length < 2) return false;

  // Verify all recent pings were inside a zone
  for (const ping of recentPings) {
    const details = typeof ping.details === 'string' ? JSON.parse(ping.details) : ping.details;
    const check = await checkGeofence(orgId, details.lat, details.lon);
    if (!check.insideZone) return false;
  }

  return true;
}

/**
 * Confirm driver has been outside all work zones for at least 5 minutes.
 */
async function confirmZoneExit(orgId: string, userId: string): Promise<boolean> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentPings = await db('audit_log')
    .where({ org_id: orgId, user_id: userId, action: 'location_ping' })
    .where('created_at', '>', fiveMinAgo)
    .orderBy('created_at', 'desc')
    .limit(3);

  if (recentPings.length < 2) return false;

  // Verify all recent pings were outside zones
  for (const ping of recentPings) {
    const details = typeof ping.details === 'string' ? JSON.parse(ping.details) : ping.details;
    const check = await checkGeofence(orgId, details.lat, details.lon);
    if (check.insideZone) return false;
  }

  return true;
}

/**
 * Send end-of-day summary via WebSocket and SMS.
 */
async function sendEndOfDaySummary(
  orgId: string,
  userId: string,
  hoursWorked: number,
  entryId: string,
): Promise<void> {
  const user = await db('users').where({ id: userId }).first();
  if (!user) return;

  const entry = await db('clock_entries').where({ id: entryId }).first();
  const routeId = entry?.route_id || 'N/A';

  // Count stops completed today (from audit log)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const stopsCount = await db('audit_log')
    .where({ org_id: orgId, user_id: userId, action: 'location_ping' })
    .where('created_at', '>=', today)
    .count('id as count')
    .first();

  const summary = {
    userId,
    hoursWorked: Math.round(hoursWorked * 10) / 10,
    routeId,
    stopsCompleted: Number(stopsCount?.count || 0),
    date: new Date().toLocaleDateString(),
  };

  // Push via WebSocket
  emitToOrg(orgId, 'day_summary', summary);

  // Send SMS confirmation
  if (user.phone) {
    await enqueueNotification({
      type: 'sms',
      to: user.phone,
      body: `TimeKeeper: Day complete! ${summary.hoursWorked}h worked, Route ${routeId}. No action needed — your time is recorded.`,
    });
  }

  logger.info('End-of-day summary sent', { orgId, ...summary });
}

/**
 * Auto-submit timesheets for the completed week.
 * Runs as a scheduled job every Sunday at midnight.
 */
export async function autoSubmitTimesheets(): Promise<void> {
  const now = new Date();
  const lastFriday = new Date(now);
  lastFriday.setDate(now.getDate() - ((now.getDay() + 2) % 7));
  const weekEnding = lastFriday.toISOString().split('T')[0];

  // Find all draft timesheets for this week
  const drafts = await db('timesheets').where({ status: 'draft', week_ending: weekEnding });

  for (const ts of drafts) {
    await db('timesheets').where({ id: ts.id }).update({ status: 'submitted' });

    await db('audit_log').insert({
      org_id: ts.org_id,
      user_id: ts.user_id,
      action: 'auto_submit_timesheet',
      entity_type: 'timesheet',
      details: JSON.stringify({ timesheetId: ts.id, weekEnding }),
    });
  }

  if (drafts.length > 0) {
    logger.info('Auto-submitted timesheets', { count: drafts.length, weekEnding });
  }
}

/**
 * Auto-approve timesheets that have no anomalies.
 * An anomaly is: >12h day, clock-in outside geofence, buddy punch flag, or missing days.
 */
export async function autoApproveTimesheets(): Promise<void> {
  // Find all submitted timesheets pending approval
  const submitted = await db('timesheets').where({ status: 'submitted' });

  for (const ts of submitted) {
    const anomalies = await detectAnomalies(ts.org_id, ts.user_id, ts.week_ending);

    if (anomalies.length === 0) {
      // No anomalies — auto-approve
      await db('timesheets').where({ id: ts.id }).update({ status: 'approved' });

      await db('timesheet_approvals').insert({
        org_id: ts.org_id,
        timesheet_id: ts.id,
        manager_id: ts.user_id, // System-approved
        status: 'approved',
        notes: 'Auto-approved: no anomalies detected',
      });

      await db('audit_log').insert({
        org_id: ts.org_id,
        user_id: ts.user_id,
        action: 'auto_approve_timesheet',
        entity_type: 'timesheet',
        details: JSON.stringify({ timesheetId: ts.id }),
      });

      logger.info('Auto-approved timesheet', {
        timesheetId: ts.id,
        userId: ts.user_id,
      });
    } else {
      // Flag for manager review
      await db('audit_log').insert({
        org_id: ts.org_id,
        user_id: ts.user_id,
        action: 'timesheet_flagged',
        entity_type: 'timesheet',
        details: JSON.stringify({ timesheetId: ts.id, anomalies }),
      });

      logger.info('Timesheet flagged for review', {
        timesheetId: ts.id,
        anomalies,
      });
    }
  }
}

/**
 * Detect anomalies in a driver's week.
 */
async function detectAnomalies(
  orgId: string,
  userId: string,
  weekEnding: string,
): Promise<string[]> {
  const anomalies: string[] = [];

  const weekEnd = new Date(weekEnding);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);

  // Get all clock entries for the week
  const entries = await db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .where('clock_in', '>=', weekStart)
    .where('clock_in', '<=', weekEnd)
    .whereNotNull('clock_out');

  // Check for >12 hour days
  for (const entry of entries) {
    const hours =
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
    if (hours > 12) {
      anomalies.push(
        `${new Date(entry.clock_in).toLocaleDateString()}: ${hours.toFixed(1)}h shift (>12h)`,
      );
    }
  }

  // Check for geofence violations
  const geoViolations = await db('audit_log')
    .where({ org_id: orgId, user_id: userId, action: 'geofence_alert' })
    .where('created_at', '>=', weekStart)
    .where('created_at', '<=', weekEnd)
    .count('id as count')
    .first();

  if (Number(geoViolations?.count || 0) > 0) {
    anomalies.push(`${geoViolations?.count} geofence violation(s)`);
  }

  // Check for buddy punch flags
  const buddyFlags = await db('audit_log')
    .where({ org_id: orgId, user_id: userId, action: 'buddy_punch_alert' })
    .where('created_at', '>=', weekStart)
    .where('created_at', '<=', weekEnd)
    .count('id as count')
    .first();

  if (Number(buddyFlags?.count || 0) > 0) {
    anomalies.push(`${buddyFlags?.count} buddy punch flag(s)`);
  }

  // Check for missing weekdays (should have 5 entries for Mon-Fri)
  const workDays = new Set(entries.map((e) => new Date(e.clock_in).toISOString().split('T')[0]));
  const expectedDays = [];
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      expectedDays.push(d.toISOString().split('T')[0]);
    }
  }
  const missingDays = expectedDays.filter((d) => !workDays.has(d));
  if (missingDays.length > 0) {
    anomalies.push(`Missing ${missingDays.length} workday(s): ${missingDays.join(', ')}`);
  }

  return anomalies;
}
