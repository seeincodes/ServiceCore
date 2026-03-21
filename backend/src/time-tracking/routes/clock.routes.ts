import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../shared/database/connection';
import * as clockService from '../services/clock.service';
import { getTodayHours } from '../services/clock.service';
import * as syncService from '../services/sync.service';
import { processLocationPing } from '../services/zero-touch.service';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';
import logger from '../../shared/utils/logger';

const router = Router();

const clockInSchema = z.object({
  projectId: z.string().optional(),
  routeId: z.string().optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
    })
    .optional(),
  idempotencyKey: z.string().optional(),
});

const clockOutSchema = z.object({
  entryId: z.string().uuid().optional(),
});

// POST /timesheets/clock-in
router.post('/clock-in', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const data = clockInSchema.parse(req.body);

    const result = await clockService.clockIn({
      orgId: user.orgId,
      userId: user.id,
      projectId: data.projectId,
      routeId: data.routeId,
      locationLat: data.location?.lat,
      locationLon: data.location?.lon,
      idempotencyKey: data.idempotencyKey,
    });

    logger.info('Clock in', { userId: user.id, orgId: user.orgId, entryId: result.entryId });
    sendSuccess(res, result, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Clock-in failed';
    sendError(res, message, 400);
  }
});

// POST /timesheets/clock-out
router.post('/clock-out', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const data = clockOutSchema.parse(req.body);

    const result = await clockService.clockOut(user.orgId, user.id, data.entryId);

    logger.info('Clock out', {
      userId: user.id,
      orgId: user.orgId,
      entryId: result.entryId,
      hours: result.hoursWorked,
    });
    sendSuccess(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Clock-out failed';
    sendError(res, message, 400);
  }
});

// GET /timesheets/status — check if user is currently clocked in
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const entry = await clockService.getActiveEntry(user.orgId, user.id);

    const todayHours = await getTodayHours(user.orgId, user.id);

    if (entry) {
      const elapsed = (Date.now() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
      sendSuccess(res, {
        clockedIn: true,
        entryId: entry.id,
        clockInTime: entry.clock_in,
        elapsedHours: Math.round(elapsed * 100) / 100,
        todayHours: Math.round((todayHours + elapsed) * 100) / 100,
        routeId: entry.route_id,
        projectId: entry.project_id,
      });
    } else {
      sendSuccess(res, {
        clockedIn: false,
        todayHours: Math.round(todayHours * 100) / 100,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Status check failed';
    sendError(res, message);
  }
});

// POST /timesheets/sync — batch sync offline entries
const syncSchema = z.array(
  z.object({
    action: z.enum(['clock_in', 'clock_out']),
    timestamp: z.string(),
    projectId: z.string().optional(),
    routeId: z.string().optional(),
    locationLat: z.number().optional(),
    locationLon: z.number().optional(),
    idempotencyKey: z.string(),
    entryId: z.string().optional(),
  }),
);

router.post('/sync', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const entries = syncSchema.parse(req.body);

    const result = await syncService.syncBatch(user.orgId, user.id, entries);

    logger.info('Batch sync', {
      userId: user.id,
      orgId: user.orgId,
      synced: result.syncedCount,
      errors: result.errors.length,
    });
    sendSuccess(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    sendError(res, message, 400);
  }
});

// POST /timesheets/location-ping — silent GPS ping from driver's device
router.post('/location-ping', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { lat, lon } = req.body;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      sendError(res, 'lat and lon are required', 400);
      return;
    }

    const result = await processLocationPing(user.orgId, user.id, lat, lon);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Location ping failed';
    sendError(res, message);
  }
});

// POST /timesheets/undo-clock-out — reopen a recently closed clock entry (within 5 min)
router.post('/undo-clock-out', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { entryId } = req.body;

    if (!entryId) {
      sendError(res, 'entryId is required', 400);
      return;
    }

    // Find the entry — must belong to this user and have been clocked out recently
    const entry = await db('clock_entries')
      .where({ id: entryId, org_id: user.orgId, user_id: user.id })
      .whereNotNull('clock_out')
      .first();

    if (!entry) {
      sendError(res, 'Entry not found or already open', 404);
      return;
    }

    // Only allow undo within 5 minutes of clock-out
    const clockOutTime = new Date(entry.clock_out).getTime();
    const fiveMinAgo = Date.now() - 2 * 60 * 1000;
    if (clockOutTime < fiveMinAgo) {
      sendError(res, 'Undo window expired (2 minutes)', 400);
      return;
    }

    // Check no new entry has been created since
    const newerEntry = await db('clock_entries')
      .where({ org_id: user.orgId, user_id: user.id })
      .where('clock_in', '>', entry.clock_out)
      .first();

    if (newerEntry) {
      sendError(res, 'Cannot undo — a new clock entry exists', 400);
      return;
    }

    // Reopen the entry
    await db('clock_entries').where({ id: entryId }).update({ clock_out: null });

    await db('audit_log').insert({
      org_id: user.orgId,
      user_id: user.id,
      action: 'undo_clock_out',
      entity_type: 'clock_entry',
      details: JSON.stringify({ entryId }),
    });

    sendSuccess(res, { status: 'undone', entryId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Undo failed';
    sendError(res, message);
  }
});

export default router;
