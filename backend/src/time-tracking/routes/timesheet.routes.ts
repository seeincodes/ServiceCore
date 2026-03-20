import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as timesheetService from '../services/timesheet.service';
import { authenticate, AuthenticatedRequest, authorize } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

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
