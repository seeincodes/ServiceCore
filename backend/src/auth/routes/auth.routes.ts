import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import * as authService from '../services/auth.service';
import { authenticate, AuthenticatedRequest } from '../middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';
import logger from '../../shared/utils/logger';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    success: false,
    data: null,
    error: 'Too many login attempts. Try again in 15 minutes.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  orgId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['employee', 'manager', 'payroll_admin', 'org_admin']),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

// POST /auth/login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth/refresh',
    });

    sendSuccess(res, {
      user: result.user,
      token: result.tokens.token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    logger.warn('Login failed', { email: req.body?.email, error: message });
    sendError(res, message, 401);
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      sendError(res, 'Refresh token required', 401);
      return;
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });

    sendSuccess(res, { token: tokens.token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Refresh failed';
    sendError(res, message, 401);
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = (req as AuthenticatedRequest).user;
    const user = await authService.getUserById(id);

    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    sendSuccess(res, { user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch user';
    sendError(res, message);
  }
});

// POST /auth/register
router.post('/register', authenticate, async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const caller = (req as AuthenticatedRequest).user;

    // Only org_admin can register new users
    if (caller.role !== 'org_admin') {
      sendError(res, 'Only org admins can register users', 403);
      return;
    }

    // Can only register users in own org
    if (data.orgId !== caller.orgId) {
      sendError(res, 'Cannot register users in another organization', 403);
      return;
    }

    const user = await authService.registerUser(
      data.orgId,
      data.email,
      data.password,
      data.role,
      data.firstName,
      data.lastName,
      data.phone,
    );

    sendSuccess(res, { user }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    sendError(res, message, 400);
  }
});

// PUT /auth/profile — update profile fields
const profileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
});

router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = (req as AuthenticatedRequest).user;
    const data = profileSchema.parse(req.body);

    const updates: Record<string, string> = {};
    if (data.firstName !== undefined) updates.first_name = data.firstName;
    if (data.lastName !== undefined) updates.last_name = data.lastName;
    if (data.phone !== undefined) updates.phone = data.phone;

    if (Object.keys(updates).length === 0) {
      sendError(res, 'No fields to update', 400);
      return;
    }

    await import('../../shared/database/connection').then(({ default: db }) =>
      db('users')
        .where({ id })
        .update({ ...updates, updated_at: new Date() }),
    );

    const user = await authService.getUserById(id);
    sendSuccess(res, { user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Profile update failed';
    sendError(res, message, 400);
  }
});

// PUT /auth/password — change password
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.put('/password', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = (req as AuthenticatedRequest).user;
    const { currentPassword, newPassword } = passwordSchema.parse(req.body);

    const { default: db } = await import('../../shared/database/connection');
    const { default: bcrypt } = await import('bcrypt');

    const user = await db('users').where({ id }).first();
    if (!user) {
      sendError(res, 'User not found', 404);
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      sendError(res, 'Current password is incorrect', 401);
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id }).update({ password_hash: newHash, updated_at: new Date() });

    sendSuccess(res, { message: 'Password updated' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Password change failed';
    sendError(res, message, 400);
  }
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('refreshToken', { path: '/auth/refresh' });
  sendSuccess(res, { message: 'Logged out' });
});

export default router;
