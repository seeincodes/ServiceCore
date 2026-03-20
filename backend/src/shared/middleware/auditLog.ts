import { Request, Response, NextFunction } from 'express';
import db from '../database/connection';
import { AuthenticatedRequest } from '../../auth/middleware/authenticate';

/**
 * Middleware to log API actions to the append-only audit_log table.
 */
export function auditLog(action: string, entityType?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalSend = res.send.bind(res);

    res.send = function (body: any) {
      // Log after response is sent
      const user = (req as AuthenticatedRequest).user;
      const statusCode = res.statusCode;
      const success = statusCode >= 200 && statusCode < 300;

      if (user) {
        db('audit_log')
          .insert({
            org_id: user.orgId,
            user_id: user.id,
            action: `${action}:${success ? 'success' : 'failure'}`,
            entity_type: entityType || null,
            entity_id: req.params.id || null,
            details: JSON.stringify({
              method: req.method,
              path: req.originalUrl,
              statusCode,
              userAgent: req.headers['user-agent'],
            }),
            ip_address: req.ip || req.socket.remoteAddress,
          })
          .catch(() => {}); // Fire and forget — audit should never break the request
      }

      return originalSend(body);
    };

    next();
  };
}
