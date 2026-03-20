import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, authorize } from './authenticate';

jest.mock('jsonwebtoken');

const mockSendError = jest.fn();
jest.mock('../../shared/utils/response', () => ({
  sendError: (res: Response, message: string, status?: number) =>
    mockSendError(res, message, status),
}));

describe('authenticate middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('calls sendError when no Authorization header', () => {
    authenticate(req as Request, res as Response, next);

    expect(mockSendError).toHaveBeenCalledWith(res, 'Authentication required', 401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls sendError when Authorization is not Bearer', () => {
    req.headers = { authorization: 'Basic xyz' };
    authenticate(req as Request, res as Response, next);

    expect(mockSendError).toHaveBeenCalledWith(res, 'Authentication required', 401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls sendError when token is invalid', () => {
    req.headers = { authorization: 'Bearer invalid' };
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid');
    });

    authenticate(req as Request, res as Response, next);

    expect(mockSendError).toHaveBeenCalledWith(res, 'Invalid or expired token', 401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user and calls next when token valid', () => {
    req.headers = { authorization: 'Bearer valid-token' };
    const payload = { id: 'u1', orgId: 'o1', email: 'u@x.com', role: 'manager' };
    (jwt.verify as jest.Mock).mockReturnValue(payload);

    authenticate(req as Request, res as Response, next);

    expect((req as { user?: unknown }).user).toEqual(payload);
    expect(next).toHaveBeenCalled();
    expect(mockSendError).not.toHaveBeenCalled();
  });
});

describe('authorize middleware', () => {
  let req: Partial<Request & { user?: { id: string; orgId: string; email: string; role: string } }>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: 'u1', orgId: 'o1', email: 'u@x.com', role: 'manager' } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('calls sendError when no user on request', () => {
    delete req.user;
    const middleware = authorize('manager');
    middleware(req as Request, res as Response, next);

    expect(mockSendError).toHaveBeenCalledWith(res, 'Authentication required', 401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls sendError when user role not in allowed list', () => {
    const middleware = authorize('org_admin', 'payroll_admin');
    middleware(req as Request, res as Response, next);

    expect(mockSendError).toHaveBeenCalledWith(res, 'Insufficient permissions', 403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user role is allowed', () => {
    const middleware = authorize('manager', 'org_admin');
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockSendError).not.toHaveBeenCalled();
  });

  it('allows any authenticated user when no roles specified', () => {
    const middleware = authorize();
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockSendError).not.toHaveBeenCalled();
  });
});
