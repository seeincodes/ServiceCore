import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as clockService from '../services/clock.service';
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

    if (entry) {
      const elapsed = (Date.now() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
      sendSuccess(res, {
        clockedIn: true,
        entryId: entry.id,
        clockInTime: entry.clock_in,
        elapsedHours: Math.round(elapsed * 100) / 100,
        routeId: entry.route_id,
        projectId: entry.project_id,
      });
    } else {
      sendSuccess(res, { clockedIn: false });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Status check failed';
    sendError(res, message);
  }
});

export default router;
