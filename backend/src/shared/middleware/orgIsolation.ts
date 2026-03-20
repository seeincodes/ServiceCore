import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export function enforceOrgIsolation(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (!user?.orgId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  const requestOrgId = req.params.orgId || req.body?.orgId || req.query.orgId;
  if (requestOrgId && requestOrgId !== user.orgId) {
    sendError(res, 'Forbidden: org_id mismatch', 403);
    return;
  }

  next();
}
