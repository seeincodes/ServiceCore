import db from '../../shared/database/connection';
import { emitToOrg } from '../../shared/websocket/socket';
import { enqueueNotification } from '../../notifications/services/queue.service';
import { checkGeofence } from './location.service';
import logger from '../../shared/utils/logger';

/**
 * Check if a driver is inside a work zone and hasn't clocked in.
 * If so, send a reminder notification via SMS/push and WebSocket.
 */
export async function checkSmartClockIn(
  orgId: string,
  userId: string,
  lat: number,
  lon: number,
): Promise<{ reminderSent: boolean; zoneName?: string }> {
  // Check if already clocked in
  const openEntry = await db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .whereNull('clock_out')
    .first();

  if (openEntry) {
    return { reminderSent: false }; // Already clocked in
  }

  // Check if inside a work zone
  const geoCheck = await checkGeofence(orgId, lat, lon);
  if (!geoCheck.insideZone) {
    return { reminderSent: false }; // Not in a work zone
  }

  // Check if we already sent a reminder in the last 30 minutes (avoid spamming)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const recentReminder = await db('audit_log')
    .where({ org_id: orgId, user_id: userId, action: 'smart_clockin_reminder' })
    .where('created_at', '>', thirtyMinAgo)
    .first();

  if (recentReminder) {
    return { reminderSent: false }; // Already reminded recently
  }

  // Get user info for notification
  const user = await db('users').where({ id: userId }).first();
  if (!user) return { reminderSent: false };

  // Log the reminder
  await db('audit_log').insert({
    org_id: orgId,
    user_id: userId,
    action: 'smart_clockin_reminder',
    entity_type: 'clock_entry',
    details: JSON.stringify({ lat, lon, zone: geoCheck.zoneName }),
  });

  // Send WebSocket notification to the driver
  emitToOrg(orgId, 'clock_in_reminder', {
    userId,
    zoneName: geoCheck.zoneName,
    message: `It looks like you're at ${geoCheck.zoneName || 'a work zone'}. Forgot to clock in?`,
    lat,
    lon,
  });

  // Send SMS if phone is available
  if (user.phone) {
    await enqueueNotification({
      type: 'sms',
      to: user.phone,
      body: `TimeKeeper: It looks like you're at ${geoCheck.zoneName || 'a work zone'}. Forgot to clock in? Reply IN to clock in now.`,
    });
  }

  logger.info('Smart clock-in reminder sent', {
    userId,
    orgId,
    zone: geoCheck.zoneName,
    lat,
    lon,
  });

  return { reminderSent: true, zoneName: geoCheck.zoneName };
}
