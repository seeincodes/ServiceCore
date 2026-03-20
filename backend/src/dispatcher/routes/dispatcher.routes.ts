import { Router, Request, Response } from 'express';
import * as dispatcherService from '../services/dispatcher.service';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

// GET /dispatcher/routes
router.get('/routes', authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const routes = await dispatcherService.getCachedRoutes(user.orgId);
    sendSuccess(res, { routes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get routes';
    sendError(res, message);
  }
});

export default router;
