import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../shared/database/connection';
import * as timesheetService from '../services/timesheet.service';
import { authenticate, AuthenticatedRequest, authorize } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

// GET /timesheets/my-entries — get driver's clock entries for current week with daily breakdown
router.get('/my-entries', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const weekOffset = Number(req.query.weekOffset) || 0;

    // Calculate week start (Monday) and end (Friday)
    const now = new Date();
    now.setDate(now.getDate() - weekOffset * 7);
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    const entries = await db('clock_entries')
      .where({ org_id: user.orgId, user_id: user.id })
      .where('clock_in', '>=', monday)
      .where('clock_in', '<', sunday)
      .orderBy('clock_in', 'asc');

    // Group by day
    const days: Record<
      string,
      { date: string; dayName: string; entries: any[]; totalHours: number }
    > = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let weekTotal = 0;
    for (const entry of entries) {
      const dateKey = new Date(entry.clock_in).toISOString().split('T')[0];
      if (!days[dateKey]) {
        const d = new Date(entry.clock_in);
        days[dateKey] = {
          date: dateKey,
          dayName: dayNames[d.getDay()],
          entries: [],
          totalHours: 0,
        };
      }

      const hours = entry.clock_out
        ? (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) /
          (1000 * 60 * 60)
        : null;

      days[dateKey].entries.push({
        id: entry.id,
        clockIn: entry.clock_in,
        clockOut: entry.clock_out,
        hours: hours !== null ? Math.round(hours * 100) / 100 : null,
        routeId: entry.route_id,
        source: entry.source,
      });

      if (hours !== null) {
        days[dateKey].totalHours = Math.round((days[dateKey].totalHours + hours) * 100) / 100;
        weekTotal += hours;
      }
    }

    // Get timesheet status
    const timesheetId = await timesheetService.getOrCreateTimesheet(user.orgId, user.id);
    const timesheet = await db('timesheets').where({ id: timesheetId }).first();

    sendSuccess(res, {
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: new Date(sunday.getTime() - 86400000).toISOString().split('T')[0],
      days: Object.values(days).sort((a, b) => a.date.localeCompare(b.date)),
      weekTotal: Math.round(weekTotal * 100) / 100,
      otHours: weekTotal > 40 ? Math.round((weekTotal - 40) * 100) / 100 : 0,
      timesheet: {
        id: timesheet.id,
        status: timesheet.status,
        weekEnding: timesheet.week_ending,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get entries';
    sendError(res, message);
  }
});

// GET /timesheets/history — past weeks for the driver
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const timesheets = await db('timesheets')
      .where({ org_id: user.orgId, user_id: user.id })
      .orderBy('week_ending', 'desc')
      .limit(12);

    sendSuccess(res, {
      timesheets: timesheets.map((ts) => ({
        id: ts.id,
        weekEnding: ts.week_ending,
        status: ts.status,
        hoursWorked: Number(ts.hours_worked),
        otHours: Number(ts.ot_hours),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get history';
    sendError(res, message);
  }
});

// GET /timesheets/mine — get current user's timesheet for this week
router.get('/mine', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const timesheetId = await timesheetService.getOrCreateTimesheet(user.orgId, user.id);
    sendSuccess(res, { timesheetId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get timesheet';
    sendError(res, message);
  }
});

// POST /timesheets/:id/submit
router.post('/:id/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const timesheetId = req.params.id as string;
    await timesheetService.submitTimesheet(user.orgId, timesheetId);
    sendSuccess(res, { status: 'submitted' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Submit failed';
    sendError(res, message, 400);
  }
});

const reviewSchema = z.object({
  action: z.enum(['approved', 'rejected', 'revision_requested']),
  notes: z.string().optional(),
});

// POST /timesheets/:id/approve
router.post(
  '/:id/approve',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const timesheetId = req.params.id as string;
      const data = reviewSchema.parse(req.body);

      await timesheetService.reviewTimesheet(
        user.orgId,
        timesheetId,
        user.id,
        data.action,
        data.notes,
      );

      sendSuccess(res, { status: data.action });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Review failed';
      sendError(res, message, 400);
    }
  },
);

// GET /manager/approvals/pending
router.get(
  '/approvals/pending',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const timesheets = await timesheetService.getPendingApprovals(user.orgId);
      sendSuccess(res, { timesheets });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get approvals';
      sendError(res, message);
    }
  },
);

export default router;
