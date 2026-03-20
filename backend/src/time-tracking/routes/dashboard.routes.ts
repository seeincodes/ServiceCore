import { Router, Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware/authenticate';
import { authorize } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

// GET /manager/dashboard
router.get(
  '/dashboard',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const drivers = await dashboardService.getDashboard(user.orgId);
      sendSuccess(res, { drivers });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Dashboard failed';
      sendError(res, message);
    }
  },
);

// GET /manager/driver/:userId/day
router.get(
  '/driver/:userId/day',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const userId = req.params.userId as string;
      const date = req.query.date ? new Date(req.query.date as string) : undefined;

      const entries = await dashboardService.getDriverDayDetail(user.orgId, userId, date);
      sendSuccess(res, { entries });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Driver detail failed';
      sendError(res, message);
    }
  },
);

export default router;
