import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedUser } from '../../shared/types';
import { sendError } from '../../shared/utils/response';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401);
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (roles.length > 0 && !roles.includes(user.role)) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }

    next();
  };
}
