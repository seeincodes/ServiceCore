import db from '../../shared/database/connection';
import { clockIn, clockOut, getActiveEntry } from './clock.service';
import { hasApprovedTimeOff } from './time-off.service';
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

  // --- AUTO CLOCK-OUT AT DEPOT AFTER 30 MIN (only if 6+ hours worked) ---
  if (geoCheck.insideZone && activeEntry) {
    const isDepot = await isDepotZone(orgId, lat, lon);
    if (isDepot) {
      const elapsed = (Date.now() - new Date(activeEntry.clock_in).getTime()) / (1000 * 60 * 60);
      const totalToday = (await getTodayCompletedHours(orgId, userId)) + elapsed;
      const atDepotMinutes = await minutesAtDepot(orgId, userId);

      if (atDepotMinutes >= 30 && totalToday >= 6) {
        try {
          const result = await clockOut(orgId, userId);
          await db('audit_log').insert({
            org_id: orgId,
            user_id: userId,
            action: 'auto_clock_out_depot',
            entity_type: 'clock_entry',
            details: JSON.stringify({
              lat,
              lon,
              minutesAtDepot: atDepotMinutes,
              hoursWorked: result.hoursWorked,
              totalToday: Math.round(totalToday * 100) / 100,
            }),
          });
          await sendEndOfDaySummary(orgId, userId, result.hoursWorked, result.entryId);
          logger.info('Auto clock-out at depot', { orgId, userId, atDepotMinutes, totalToday });
          return {
            action: 'auto_clock_out',
            details: { reason: 'depot_30min', hoursWorked: result.hoursWorked },
          };
        } catch {
          // Already clocked out or error — continue
        }
      }
    }
  }

  // --- AUTO CLOCK-IN (10 min at depot) ---
  if (geoCheck.insideZone && !activeEntry) {
    // Verify they've been in the zone for at least 10 minutes (avoid drive-throughs)
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
 * Confirm driver has been inside a work zone for at least 10 minutes
 * by checking the last 5 pings (every 2 min) were inside a zone.
 */
async function confirmZonePresence(
  orgId: string,
  userId: string,
  _lat: number,
  _lon: number,
): Promise<boolean> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

  const recentPings = await db('audit_log')
    .where({ org_id: orgId, user_id: userId, action: 'location_ping' })
    .where('created_at', '>', tenMinAgo)
    .orderBy('created_at', 'desc')
    .limit(5);

  // Need at least 5 recent pings (10 min at 2 min intervals)
  if (recentPings.length < 5) return false;

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

  // Check for missing weekdays (skip days with approved PTO/sick time)
  const workDays = new Set(entries.map((e) => new Date(e.clock_in).toISOString().split('T')[0]));
  const expectedDays = [];
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      expectedDays.push(d.toISOString().split('T')[0]);
    }
  }
  const missingDays: string[] = [];
  for (const day of expectedDays) {
    if (workDays.has(day)) continue;
    const hasTimeOff = await hasApprovedTimeOff(orgId, userId, day);
    if (!hasTimeOff) {
      missingDays.push(day);
    }
  }
  if (missingDays.length > 0) {
    anomalies.push(`Missing ${missingDays.length} workday(s): ${missingDays.join(', ')}`);
  }

  return anomalies;
}

/**
 * Check if the given coordinates are inside a depot-type work zone.
 */
async function isDepotZone(orgId: string, lat: number, lon: number): Promise<boolean> {
  const depots = await db('work_zones')
    .where({ org_id: orgId, type: 'depot', is_active: true })
    .select('lat', 'lon', 'radius_meters');

  for (const depot of depots) {
    const dLat = ((Number(depot.lat) - lat) * Math.PI) / 180;
    const dLon = ((Number(depot.lon) - lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((Number(depot.lat) * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist <= (depot.radius_meters || 200)) return true;
  }

  return false;
}

/**
 * How many minutes has the driver been at a depot-type zone based on recent pings.
 */
async function minutesAtDepot(orgId: string, userId: string): Promise<number> {
  const pings = await db('audit_log')
    .where({ org_id: orgId, user_id: userId, action: 'location_ping' })
    .orderBy('created_at', 'desc')
    .limit(20);

  if (pings.length < 2) return 0;

  // Walk backwards through pings — count consecutive depot pings
  let depotMinutes = 0;
  for (const ping of pings) {
    const details = typeof ping.details === 'string' ? JSON.parse(ping.details) : ping.details;
    const atDepot = await isDepotZone(orgId, details.lat, details.lon);
    if (!atDepot) break;
    depotMinutes += 2; // Pings are every 2 minutes
  }

  return depotMinutes;
}

/**
 * Get total completed (clocked-out) hours for a user today.
 */
async function getTodayCompletedHours(orgId: string, userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const entries = await db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .where('clock_in', '>=', today)
    .where('clock_in', '<', tomorrow)
    .whereNotNull('clock_out');

  let total = 0;
  for (const entry of entries) {
    total +=
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
  }
  return total;
}

/**
 * Midnight auto-close: close any open clock entries, log 8 hours, flag for review.
 * Runs as a scheduled job at midnight.
 */
export async function midnightAutoClose(): Promise<void> {
  // Find all open clock entries (forgot to clock out)
  const openEntries = await db('clock_entries')
    .whereNull('clock_out')
    .select('id', 'org_id', 'user_id', 'clock_in', 'route_id');

  for (const entry of openEntries) {
    const clockInTime = new Date(entry.clock_in);
    const now = new Date();

    // Only close entries from today or earlier (not future-dated)
    if (clockInTime > now) continue;

    // Set clock_out to give exactly 8 hours from clock_in
    const eightHoursLater = new Date(clockInTime.getTime() + 8 * 60 * 60 * 1000);
    const clockOutTime = eightHoursLater < now ? eightHoursLater : now;

    await db('clock_entries').where({ id: entry.id }).update({
      clock_out: clockOutTime,
    });

    // Flag for manager review
    await db('audit_log').insert({
      org_id: entry.org_id,
      user_id: entry.user_id,
      action: 'midnight_auto_close',
      entity_type: 'clock_entry',
      details: JSON.stringify({
        entryId: entry.id,
        clockIn: entry.clock_in,
        clockOut: clockOutTime,
        hoursLogged: 8,
        reason: 'Employee forgot to clock out. Auto-closed at midnight with 8h default.',
      }),
    });

    // Notify the manager via WebSocket
    emitToOrg(entry.org_id, 'review_needed', {
      type: 'midnight_auto_close',
      userId: entry.user_id,
      entryId: entry.id,
      message: 'Forgot to clock out — 8h auto-logged. Please review.',
    });

    // Notify the employee via SMS
    const user = await db('users').where({ id: entry.user_id }).first();
    if (user?.phone) {
      await enqueueNotification({
        type: 'sms',
        to: user.phone,
        body: `TimeKeeper: You forgot to clock out today. We've logged 8 hours for you. Your manager will review.`,
      });
    }

    logger.info('Midnight auto-close', {
      entryId: entry.id,
      userId: entry.user_id,
      hoursLogged: 8,
    });
  }

  if (openEntries.length > 0) {
    logger.info(`Midnight auto-close completed`, { count: openEntries.length });
  }
}

/**
 * Schedule-based check: if a driver hasn't clocked in by 2 hours after their
 * typical start time, create a pending entry and notify the manager.
 * Runs hourly.
 */
export async function checkMissingClockIns(): Promise<void> {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Skip weekends
  if (now.getDay() === 0 || now.getDay() === 6) return;

  // Only run between 7am-11am (drivers typically start 5am-9am, so check 7am-11am)
  if (now.getHours() < 7 || now.getHours() > 11) return;

  // Get all active employees
  const employees = await db('users')
    .where({ role: 'employee', is_active: true })
    .select('id', 'org_id', 'first_name', 'last_name');

  for (const emp of employees) {
    // Check if they have a clock entry today
    const todayEntry = await db('clock_entries')
      .where({ org_id: emp.org_id, user_id: emp.id })
      .where('clock_in', '>=', today)
      .first();

    if (todayEntry) continue; // Already clocked in

    // Check if they have approved time off today
    const dateStr = now.toISOString().split('T')[0];
    const timeOff = await db('time_off_requests')
      .where({ org_id: emp.org_id, user_id: emp.id, status: 'approved' })
      .where('start_date', '<=', dateStr)
      .where('end_date', '>=', dateStr)
      .first();

    if (timeOff) continue; // On approved time off

    // Check if we already flagged today
    const alreadyFlagged = await db('audit_log')
      .where({
        org_id: emp.org_id,
        user_id: emp.id,
        action: 'missing_clock_in',
      })
      .where('created_at', '>=', today)
      .first();

    if (alreadyFlagged) continue; // Already flagged today

    // Flag for manager
    await db('audit_log').insert({
      org_id: emp.org_id,
      user_id: emp.id,
      action: 'missing_clock_in',
      entity_type: 'clock_entry',
      details: JSON.stringify({
        date: dateStr,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        flaggedAt: now.toISOString(),
      }),
    });

    emitToOrg(emp.org_id, 'review_needed', {
      type: 'missing_clock_in',
      userId: emp.id,
      employeeName: `${emp.first_name} ${emp.last_name}`,
      message: `${emp.first_name} ${emp.last_name} hasn't clocked in today.`,
    });

    logger.info('Missing clock-in flagged', {
      userId: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
    });
  }
}
