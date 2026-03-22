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

// POST /timesheets/bulk-approve
const bulkReviewSchema = z.object({
  timesheetIds: z.array(z.string()).min(1),
  action: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
});

router.post(
  '/bulk-approve',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const data = bulkReviewSchema.parse(req.body);

      let processed = 0;
      const errors: string[] = [];

      for (const timesheetId of data.timesheetIds) {
        try {
          await timesheetService.reviewTimesheet(
            user.orgId,
            timesheetId,
            user.id,
            data.action,
            data.notes,
          );
          processed++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`Timesheet ${timesheetId}: ${msg}`);
        }
      }

      sendSuccess(res, { processed, errors });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bulk approve failed';
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

// ============================================================
// TIME EDIT REQUESTS (driver self-service)
// ============================================================

const editRequestSchema = z.object({
  type: z.enum(['add', 'edit']),
  clockEntryId: z.string().uuid().optional(),
  proposedClockIn: z.string(),
  proposedClockOut: z.string(),
  projectId: z.string().optional(),
  reason: z.string().min(1, 'A reason is required'),
});

// POST /timesheets/edit-requests — driver submits an add/edit request
router.post('/edit-requests', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const data = editRequestSchema.parse(req.body);

    // Validate clock_entry belongs to user if editing
    if (data.type === 'edit' && data.clockEntryId) {
      const entry = await db('clock_entries')
        .where({ id: data.clockEntryId, org_id: user.orgId, user_id: user.id })
        .first();
      if (!entry) {
        return sendError(res, 'Clock entry not found', 404);
      }
    }

    // Validate proposed times
    const clockIn = new Date(data.proposedClockIn);
    const clockOut = new Date(data.proposedClockOut);
    if (clockOut <= clockIn) {
      return sendError(res, 'Clock out must be after clock in', 400);
    }
    const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    if (hours > 16) {
      return sendError(res, 'Entry cannot exceed 16 hours', 400);
    }

    const [request] = await db('time_edit_requests')
      .insert({
        org_id: user.orgId,
        user_id: user.id,
        type: data.type,
        clock_entry_id: data.clockEntryId || null,
        proposed_clock_in: data.proposedClockIn,
        proposed_clock_out: data.proposedClockOut,
        project_id: data.projectId || null,
        reason: data.reason,
        status: 'pending',
      })
      .returning('*');

    sendSuccess(res, { request }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit edit request';
    sendError(res, message, 400);
  }
});

// GET /timesheets/edit-requests — driver views their own requests
router.get('/edit-requests', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const requests = await db('time_edit_requests')
      .where({ user_id: user.id, org_id: user.orgId })
      .orderBy('created_at', 'desc')
      .limit(20);

    sendSuccess(res, {
      requests: requests.map((r: any) => ({
        id: r.id,
        type: r.type,
        clockEntryId: r.clock_entry_id,
        proposedClockIn: r.proposed_clock_in,
        proposedClockOut: r.proposed_clock_out,
        projectId: r.project_id,
        reason: r.reason,
        status: r.status,
        reviewNotes: r.review_notes,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get edit requests';
    sendError(res, message);
  }
});

// GET /manager/approvals/edit-requests — manager views pending edit requests
router.get(
  '/approvals/edit-requests',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const requests = await db('time_edit_requests')
        .join('users', 'time_edit_requests.user_id', 'users.id')
        .where({ 'time_edit_requests.org_id': user.orgId, 'time_edit_requests.status': 'pending' })
        .select('time_edit_requests.*', 'users.first_name', 'users.last_name', 'users.email')
        .orderBy('time_edit_requests.created_at', 'asc');

      sendSuccess(res, {
        requests: requests.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          employeeName: `${r.first_name} ${r.last_name}`,
          employeeEmail: r.email,
          type: r.type,
          clockEntryId: r.clock_entry_id,
          proposedClockIn: r.proposed_clock_in,
          proposedClockOut: r.proposed_clock_out,
          projectId: r.project_id,
          reason: r.reason,
          status: r.status,
          createdAt: r.created_at,
        })),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get edit requests';
      sendError(res, message);
    }
  },
);

// POST /manager/approvals/edit-requests/:id/review — manager approves/rejects
const editReviewSchema = z.object({
  action: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
});

router.post(
  '/approvals/edit-requests/:id/review',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const requestId = req.params.id;
      const data = editReviewSchema.parse(req.body);

      const editRequest = await db('time_edit_requests')
        .where({ id: requestId, org_id: user.orgId, status: 'pending' })
        .first();

      if (!editRequest) {
        return sendError(res, 'Edit request not found or already reviewed', 404);
      }

      // Update request status
      await db('time_edit_requests')
        .where({ id: requestId })
        .update({
          status: data.action,
          reviewed_by: user.id,
          review_notes: data.notes || null,
          reviewed_at: new Date(),
        });

      // If approved, apply the change
      if (data.action === 'approved') {
        if (editRequest.type === 'add') {
          // Create new clock entry
          await db('clock_entries').insert({
            org_id: editRequest.org_id,
            user_id: editRequest.user_id,
            clock_in: editRequest.proposed_clock_in,
            clock_out: editRequest.proposed_clock_out,
            project_id: editRequest.project_id,
            source: 'app',
          });
        } else if (editRequest.type === 'edit' && editRequest.clock_entry_id) {
          // Log old values for audit
          const oldEntry = await db('clock_entries')
            .where({ id: editRequest.clock_entry_id })
            .first();

          await db('clock_entries')
            .where({ id: editRequest.clock_entry_id })
            .update({
              clock_in: editRequest.proposed_clock_in,
              clock_out: editRequest.proposed_clock_out,
              project_id: editRequest.project_id || oldEntry?.project_id,
            });

          // Audit log
          await db('audit_log').insert({
            org_id: editRequest.org_id,
            user_id: user.id,
            action: 'clock_entry_edited',
            entity_type: 'clock_entry',
            entity_id: editRequest.clock_entry_id,
            details: JSON.stringify({
              edit_request_id: requestId,
              requested_by: editRequest.user_id,
              approved_by: user.id,
              old_values: { clock_in: oldEntry?.clock_in, clock_out: oldEntry?.clock_out },
              new_values: {
                clock_in: editRequest.proposed_clock_in,
                clock_out: editRequest.proposed_clock_out,
              },
            }),
          });
        }
      }

      sendSuccess(res, { status: data.action });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Review failed';
      sendError(res, message, 400);
    }
  },
);

export default router;
