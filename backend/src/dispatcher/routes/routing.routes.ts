import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as routingService from '../services/routing.service';
import { checkSmartClockIn } from '../../time-tracking/services/smart-clockin.service';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

const optimizeSchema = z.object({
  stops: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        lat: z.number(),
        lon: z.number(),
      }),
    )
    .min(2),
});

// POST /routes/optimize — optimize stop order for a route
router.post('/optimize', authenticate, async (req: Request, res: Response) => {
  try {
    const data = optimizeSchema.parse(req.body);
    const result = await routingService.optimizeRoute(data.stops);
    sendSuccess(res, result);
  } catch (err: unknown) {
    sendError(res, (err as Error).message, 400);
  }
});

const directionsSchema = z.object({
  stops: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        lat: z.number(),
        lon: z.number(),
      }),
    )
    .min(2),
});

// POST /routes/directions — get directions between ordered stops
router.post('/directions', authenticate, async (req: Request, res: Response) => {
  try {
    const data = directionsSchema.parse(req.body);
    const result = await routingService.getDirections(data.stops);
    if (!result) {
      sendError(res, 'Could not compute directions', 400);
      return;
    }
    sendSuccess(res, result);
  } catch (err: unknown) {
    sendError(res, (err as Error).message, 400);
  }
});

// POST /routes/check-location — driver sends location, system checks for smart clock-in
router.post('/check-location', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { lat, lon } = req.body;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      sendError(res, 'lat and lon are required', 400);
      return;
    }

    const result = await checkSmartClockIn(user.orgId, user.id, lat, lon);
    sendSuccess(res, result);
  } catch (err: unknown) {
    sendError(res, (err as Error).message);
  }
});

export default router;
