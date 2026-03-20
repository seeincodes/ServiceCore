import db from '../../shared/database/connection';
import logger from '../../shared/utils/logger';

export interface SyncEntry {
  action: 'clock_in' | 'clock_out';
  timestamp: string;
  projectId?: string;
  routeId?: string;
  locationLat?: number;
  locationLon?: number;
  idempotencyKey: string;
  entryId?: string; // for clock_out
}

export interface SyncResult {
  syncedCount: number;
  errors: { index: number; error: string }[];
}

export async function syncBatch(
  orgId: string,
  userId: string,
  entries: SyncEntry[],
): Promise<SyncResult> {
  let syncedCount = 0;
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      if (entry.action === 'clock_in') {
        await syncClockIn(orgId, userId, entry);
      } else {
        await syncClockOut(orgId, userId, entry);
      }
      syncedCount++;
    } catch (err) {
      errors.push({ index: i, error: (err as Error).message });
      logger.warn('Sync entry failed', { index: i, error: (err as Error).message });
    }
  }

  logger.info('Batch sync complete', { orgId, userId, syncedCount, errorCount: errors.length });
  return { syncedCount, errors };
}

async function syncClockIn(orgId: string, userId: string, entry: SyncEntry): Promise<void> {
  // Deduplication via idempotency key
  const existing = await db('clock_entries')
    .where({ idempotency_key: entry.idempotencyKey })
    .first();

  if (existing) {
    // Last-write-wins: if the offline entry has a newer timestamp, update
    const offlineTime = new Date(entry.timestamp).getTime();
    const serverTime = new Date(existing.clock_in).getTime();

    if (offlineTime > serverTime) {
      await db('clock_entries')
        .where({ id: existing.id })
        .update({
          clock_in: new Date(entry.timestamp),
          project_id: entry.projectId || existing.project_id,
          route_id: entry.routeId || existing.route_id,
          location_lat: entry.locationLat || existing.location_lat,
          location_lon: entry.locationLon || existing.location_lon,
          synced_at: new Date(),
        });
      logger.info('Sync: updated existing entry (last-write-wins)', {
        entryId: existing.id,
        idempotencyKey: entry.idempotencyKey,
      });
    }
    return;
  }

  // Check if already clocked in (no clock_out) — skip if so
  const openEntry = await db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .whereNull('clock_out')
    .first();

  if (openEntry) {
    throw new Error('Already clocked in. Skipping duplicate clock-in.');
  }

  await db('clock_entries').insert({
    org_id: orgId,
    user_id: userId,
    clock_in: new Date(entry.timestamp),
    project_id: entry.projectId,
    route_id: entry.routeId,
    location_lat: entry.locationLat,
    location_lon: entry.locationLon,
    source: 'app',
    synced_at: new Date(),
    idempotency_key: entry.idempotencyKey,
  });
}

async function syncClockOut(orgId: string, userId: string, entry: SyncEntry): Promise<void> {
  // Find the open entry
  const query = db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .whereNull('clock_out');

  if (entry.entryId) {
    query.andWhere({ id: entry.entryId });
  }

  const openEntry = await query.first();

  if (!openEntry) {
    throw new Error('No active clock-in found for clock-out.');
  }

  const clockOutTime = new Date(entry.timestamp);

  // Last-write-wins: only update if this clock-out is newer than any existing
  if (openEntry.clock_out) {
    const existingOut = new Date(openEntry.clock_out).getTime();
    if (clockOutTime.getTime() <= existingOut) {
      return; // Server has a newer clock-out, skip
    }
  }

  await db('clock_entries').where({ id: openEntry.id }).update({
    clock_out: clockOutTime,
    synced_at: new Date(),
  });
}
