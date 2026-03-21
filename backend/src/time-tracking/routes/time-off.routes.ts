import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as timeOffService from '../services/time-off.service';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

const requestSchema = z.object({
  type: z.enum(['pto', 'sick', 'personal', 'bereavement', 'jury_duty']),
  startDate: z.string(),
  endDate: z.string(),
  hoursRequested: z.number().positive(),
  notes: z.string().optional(),
});

// POST /time-off/request — submit a time-off request
router.post('/request', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const data = requestSchema.parse(req.body);
    const result = await timeOffService.submitRequest({
      orgId: user.orgId,
      userId: user.id,
      ...data,
    });
    sendSuccess(res, result, 201);
  } catch (err: unknown) {
    sendError(res, (err as Error).message, 400);
  }
});

// POST /time-off/:id/approve — approve a request (manager/admin only)
router.post('/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (user.role !== 'manager' && user.role !== 'org_admin') {
      sendError(res, 'Only managers can approve time-off requests', 403);
      return;
    }
    await timeOffService.approveRequest(
      user.orgId,
      req.params.id as string,
      user.id,
      req.body.notes,
    );
    sendSuccess(res, { status: 'approved' });
  } catch (err: unknown) {
    sendError(res, (err as Error).message, 400);
  }
});

// POST /time-off/:id/deny — deny a request (manager/admin only)
router.post('/:id/deny', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (user.role !== 'manager' && user.role !== 'org_admin') {
      sendError(res, 'Only managers can deny time-off requests', 403);
      return;
    }
    await timeOffService.denyRequest(user.orgId, req.params.id as string, user.id, req.body.notes);
    sendSuccess(res, { status: 'denied' });
  } catch (err: unknown) {
    sendError(res, (err as Error).message, 400);
  }
});

// POST /time-off/:id/cancel — cancel own pending request
router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    await timeOffService.cancelRequest(user.orgId, req.params.id as string, user.id);
    sendSuccess(res, { status: 'cancelled' });
  } catch (err: unknown) {
    sendError(res, (err as Error).message, 400);
  }
});

// GET /time-off/requests — list requests (filtered by role)
router.get('/requests', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const filters: any = {};

    // Drivers only see their own requests
    if (user.role === 'employee') {
      filters.userId = user.id;
    }

    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.userId && user.role !== 'employee') filters.userId = req.query.userId as string;

    const requests = await timeOffService.listRequests(user.orgId, filters);
    sendSuccess(res, { requests });
  } catch (err: unknown) {
    sendError(res, (err as Error).message);
  }
});

// GET /time-off/balances — get own balances
router.get('/balances', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const targetUserId = (req.query.userId as string) || user.id;

    // Drivers can only see their own balances
    if (user.role === 'employee' && targetUserId !== user.id) {
      sendError(res, "Cannot view other employees' balances", 403);
      return;
    }

    const balances = await timeOffService.getAllBalances(user.orgId, targetUserId);
    sendSuccess(res, { balances });
  } catch (err: unknown) {
    sendError(res, (err as Error).message);
  }
});

// PUT /time-off/balances — admin updates an employee's PTO/sick balance
const updateBalanceSchema = z.object({
  userId: z.string(),
  type: z.enum(['pto', 'sick', 'personal', 'bereavement', 'jury_duty']),
  totalHours: z.number().min(0),
  year: z.number().optional(),
});

router.put('/balances', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (user.role !== 'org_admin') {
      sendError(res, 'Only admins can update balances', 403);
      return;
    }
    const data = updateBalanceSchema.parse(req.body);
    await timeOffService.updateBalance(
      user.orgId,
      data.userId,
      data.type,
      data.totalHours,
      data.year,
    );
    sendSuccess(res, { status: 'updated' });
  } catch (err: unknown) {
    sendError(res, (err as Error).message, 400);
  }
});

export default router;
