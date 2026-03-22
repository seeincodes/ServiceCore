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

// POST /manager/alerts/:id/resolve — resolve an alert
router.post(
  '/alerts/:id/resolve',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const alertId = req.params.id as string;

      const alert = await db('audit_log').where({ id: alertId, org_id: user.orgId }).first();

      if (!alert) {
        sendError(res, 'Alert not found', 404);
        return;
      }

      const details = typeof alert.details === 'string' ? JSON.parse(alert.details) : alert.details;
      details.resolved_at = new Date().toISOString();
      details.resolved_by = user.id;

      await db('audit_log')
        .where({ id: alertId })
        .update({ details: JSON.stringify(details) });

      sendSuccess(res, { message: 'Alert resolved' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve alert';
      sendError(res, message);
    }
  },
);

// GET /manager/reports/attendance — daily attendance summary
router.get(
  '/reports/attendance',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const days = parseInt(req.query.days as string) || 14;

      const totalActiveResult = await db('users')
        .where({ org_id: user.orgId, role: 'employee', is_active: true })
        .count('id as count')
        .first();
      const totalDrivers = Number(totalActiveResult?.count || 0);

      const results = [];
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayStart = `${dateStr}T00:00:00.000Z`;
        const dayEnd = `${dateStr}T23:59:59.999Z`;

        const presentResult = await db('clock_entries')
          .where({ org_id: user.orgId })
          .where('clock_in', '>=', dayStart)
          .where('clock_in', '<=', dayEnd)
          .countDistinct('user_id as count')
          .first();

        const avgResult = await db('clock_entries')
          .where({ org_id: user.orgId })
          .where('clock_in', '>=', dayStart)
          .where('clock_in', '<=', dayEnd)
          .whereNotNull('clock_out')
          .select(db.raw('AVG(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600) as avg_hours'))
          .first();

        const presentCount = Number(presentResult?.count || 0);

        results.push({
          date: dateStr,
          totalDrivers,
          presentCount,
          absentCount: totalDrivers - presentCount,
          avgHours: Math.round((Number(avgResult?.avg_hours) || 0) * 100) / 100,
        });
      }

      sendSuccess(res, results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Attendance report failed';
      sendError(res, message);
    }
  },
);

// GET /manager/reports/overtime-trends — weekly OT data
router.get(
  '/reports/overtime-trends',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const weeks = parseInt(req.query.weeks as string) || 8;

      const results = [];
      for (let i = 0; i < weeks; i++) {
        const now = new Date();
        // Find this week's Sunday (end of week)
        const dayOfWeek = now.getDay();
        const sundayOffset = -dayOfWeek - i * 7;
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + sundayOffset);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        const weekEndingStr = weekEnd.toISOString().split('T')[0];

        // Get total hours per employee for this week
        const employeeHours = await db('clock_entries')
          .where({ org_id: user.orgId })
          .where('clock_in', '>=', weekStart.toISOString())
          .where('clock_in', '<=', weekEnd.toISOString())
          .whereNotNull('clock_out')
          .groupBy('user_id')
          .select(
            'user_id',
            db.raw('SUM(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600) as total_hours'),
          );

        let totalOtHours = 0;
        let driversWithOt = 0;

        for (const emp of employeeHours) {
          const hours = Number(emp.total_hours);
          if (hours > 40) {
            totalOtHours += hours - 40;
            driversWithOt++;
          }
        }

        results.push({
          weekEnding: weekEndingStr,
          totalOtHours: Math.round(totalOtHours * 100) / 100,
          driversWithOt,
          avgOtPerDriver:
            driversWithOt > 0 ? Math.round((totalOtHours / driversWithOt) * 100) / 100 : 0,
        });
      }

      sendSuccess(res, results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Overtime trends failed';
      sendError(res, message);
    }
  },
);

// GET /manager/reports/per-driver — hours summary per driver
router.get(
  '/reports/per-driver',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const rows = await db('clock_entries')
        .join('users', 'clock_entries.user_id', 'users.id')
        .where({ 'clock_entries.org_id': user.orgId })
        .where('clock_in', '>=', startDate.toISOString())
        .where('clock_in', '<=', endDate.toISOString())
        .whereNotNull('clock_out')
        .groupBy('clock_entries.user_id', 'users.first_name', 'users.last_name')
        .select(
          'clock_entries.user_id',
          'users.first_name',
          'users.last_name',
          db.raw('SUM(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600) as total_hours'),
          db.raw('COUNT(DISTINCT DATE(clock_in)) as days_worked'),
        );

      const results = rows.map((r: any) => {
        const totalHours = Math.round(Number(r.total_hours) * 100) / 100;
        const daysWorked = Number(r.days_worked);
        const otHours = Math.max(0, Math.round((totalHours - 40) * 100) / 100);
        return {
          userId: r.user_id,
          name: `${r.first_name} ${r.last_name}`,
          totalHours,
          otHours,
          daysWorked,
          avgDailyHours: daysWorked > 0 ? Math.round((totalHours / daysWorked) * 100) / 100 : 0,
        };
      });

      sendSuccess(res, results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Per-driver report failed';
      sendError(res, message);
    }
  },
);

// GET /manager/reports/per-project — hours summary per project
router.get(
  '/reports/per-project',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const rows = await db('clock_entries')
        .join('projects', 'clock_entries.project_id', 'projects.id')
        .where({ 'clock_entries.org_id': user.orgId })
        .where('clock_in', '>=', startDate.toISOString())
        .where('clock_in', '<=', endDate.toISOString())
        .whereNotNull('clock_out')
        .whereNotNull('clock_entries.project_id')
        .groupBy('projects.id', 'projects.name', 'projects.code', 'projects.color')
        .select(
          'projects.id as project_id',
          'projects.name as project_name',
          'projects.code as project_code',
          'projects.color',
          db.raw('SUM(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600) as total_hours'),
          db.raw('COUNT(DISTINCT clock_entries.user_id) as driver_count'),
        );

      const results = rows.map((r: any) => ({
        projectId: r.project_id,
        projectName: r.project_name,
        projectCode: r.project_code,
        color: r.color,
        totalHours: Math.round(Number(r.total_hours) * 100) / 100,
        driverCount: Number(r.driver_count),
      }));

      sendSuccess(res, results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Per-project report failed';
      sendError(res, message);
    }
  },
);

// PUT /manager/driver/:userId/entries/:entryId — edit a clock entry
router.put(
  '/driver/:userId/entries/:entryId',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { userId, entryId } = req.params;
      const { clockIn, clockOut } = req.body;

      // Verify entry belongs to org and user
      const entry = await db('clock_entries')
        .where({ id: entryId, org_id: user.orgId, user_id: userId })
        .first();

      if (!entry) {
        sendError(res, 'Clock entry not found', 404);
        return;
      }

      const updates: Record<string, unknown> = {};
      const oldValues: Record<string, unknown> = {};

      if (clockIn) {
        oldValues.clock_in = entry.clock_in;
        updates.clock_in = new Date(clockIn);
      }
      if (clockOut) {
        oldValues.clock_out = entry.clock_out;
        updates.clock_out = new Date(clockOut);
      }

      if (Object.keys(updates).length === 0) {
        sendError(res, 'No updates provided', 400);
        return;
      }

      await db('clock_entries').where({ id: entryId }).update(updates);

      // Log the edit in audit_log
      await db('audit_log').insert({
        org_id: user.orgId,
        user_id: userId,
        action: 'clock_entry_edited',
        entity_type: 'clock_entry',
        details: JSON.stringify({
          entry_id: entryId,
          edited_by: user.id,
          old_values: oldValues,
          new_values: updates,
        }),
      });

      const updated = await db('clock_entries').where({ id: entryId }).first();
      sendSuccess(res, { entry: updated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update entry';
      sendError(res, message);
    }
  },
);

// POST /manager/driver/:userId/assign-project — assign a project to a driver's active clock entry
router.post(
  '/driver/:userId/assign-project',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { userId } = req.params;
      const { projectId } = req.body;

      // Find the driver's active clock entry
      const entry = await db('clock_entries')
        .where({ org_id: user.orgId, user_id: userId })
        .whereNull('clock_out')
        .first();

      if (!entry) {
        sendError(res, 'Driver is not currently clocked in', 400);
        return;
      }

      // Verify project belongs to org
      if (projectId) {
        const project = await db('projects').where({ id: projectId, org_id: user.orgId }).first();
        if (!project) {
          sendError(res, 'Project not found', 404);
          return;
        }
      }

      await db('clock_entries')
        .where({ id: entry.id })
        .update({ project_id: projectId || null });

      // Audit log
      await db('audit_log').insert({
        org_id: user.orgId,
        user_id: userId,
        action: 'project_assigned',
        entity_type: 'clock_entry',
        details: JSON.stringify({
          entryId: entry.id,
          oldProjectId: entry.project_id,
          newProjectId: projectId,
          assignedBy: user.id,
        }),
      });

      sendSuccess(res, { entryId: entry.id, projectId: projectId || null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Assignment failed';
      sendError(res, message);
    }
  },
);

export default router;
