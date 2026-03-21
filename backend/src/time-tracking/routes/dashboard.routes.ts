import { Router, Request, Response } from 'express';
import db from '../../shared/database/connection';
import * as dashboardService from '../services/dashboard.service';
import * as overtimeService from '../services/overtime.service';
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

// GET /manager/driver/:userId/overtime
router.get(
  '/driver/:userId/overtime',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const userId = req.params.userId as string;
      const weekEnding = req.query.weekEnding
        ? new Date(req.query.weekEnding as string)
        : undefined;

      const result = await overtimeService.calculateOvertime(
        user.orgId,
        userId,
        weekEnding || new Date(),
      );
      sendSuccess(res, result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'OT calculation failed';
      sendError(res, message);
    }
  },
);

// GET /manager/project-allocation
router.get(
  '/project-allocation',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const allocation = await dashboardService.getProjectAllocation(user.orgId);
      sendSuccess(res, { allocation });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Project allocation failed';
      sendError(res, message);
    }
  },
);

// GET /manager/alerts — get pending manager alerts (review queue)
router.get(
  '/alerts',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;

      const alerts = await db('audit_log')
        .where({ org_id: user.orgId })
        .where('action', 'like', 'manager_alert:%')
        .orderBy('created_at', 'desc')
        .limit(50)
        .select('id', 'user_id', 'action', 'details', 'created_at');

      // Attach employee names
      const userIds = [...new Set(alerts.map((a: any) => a.user_id).filter(Boolean))];
      const users = await db('users')
        .whereIn('id', userIds)
        .select('id', 'first_name', 'last_name');
      const userMap = new Map(users.map((u: any) => [u.id, `${u.first_name} ${u.last_name}`]));

      const formatted = alerts.map((a: any) => {
        const details = typeof a.details === 'string' ? JSON.parse(a.details) : a.details;
        return {
          id: a.id,
          type: details.type,
          priority: details.priority,
          title: details.title,
          message: details.message,
          employeeName: a.user_id ? userMap.get(a.user_id) || 'Unknown' : null,
          userId: a.user_id,
          timestamp: a.created_at,
          data: details,
        };
      });

      // Count unread (today's alerts)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const unreadCount = formatted.filter((a: any) => new Date(a.timestamp) >= today).length;

      sendSuccess(res, { alerts: formatted, unreadCount });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get alerts';
      sendError(res, message);
    }
  },
);

export default router;
