import { Router, Request, Response } from 'express';
import { z } from 'zod';
import db from '../../shared/database/connection';
import bcrypt from 'bcrypt';
import { authenticate, AuthenticatedRequest, authorize } from '../middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

// GET /admin/stats — org dashboard stats
router.get('/stats', authenticate, authorize('org_admin'), async (req: Request, res: Response) => {
  try {
    const { orgId } = (req as AuthenticatedRequest).user;

    const [employeeCount, activeToday, pendingApprovals] = await Promise.all([
      db('users')
        .where({ org_id: orgId, role: 'employee', is_active: true })
        .count('id as count')
        .first(),
      db('clock_entries')
        .where({ org_id: orgId })
        .whereNull('clock_out')
        .countDistinct('user_id as count')
        .first(),
      db('timesheets').where({ org_id: orgId, status: 'submitted' }).count('id as count').first(),
    ]);

    const totalUsers = await db('users')
      .where({ org_id: orgId, is_active: true })
      .count('id as count')
      .first();

    sendSuccess(res, {
      totalUsers: Number(totalUsers?.count || 0),
      employeeCount: Number(employeeCount?.count || 0),
      activeToday: Number(activeToday?.count || 0),
      pendingApprovals: Number(pendingApprovals?.count || 0),
    });
  } catch (err: unknown) {
    sendError(res, (err as Error).message);
  }
});

// GET /admin/users — list all org users
router.get('/users', authenticate, authorize('org_admin'), async (req: Request, res: Response) => {
  try {
    const { orgId } = (req as AuthenticatedRequest).user;

    const users = await db('users')
      .where({ org_id: orgId })
      .select(
        'id',
        'email',
        'first_name',
        'last_name',
        'role',
        'phone',
        'is_active',
        'created_at',
        'updated_at',
      )
      .orderBy('role')
      .orderBy('last_name');

    sendSuccess(res, { users });
  } catch (err: unknown) {
    sendError(res, (err as Error).message);
  }
});

// POST /admin/users — create a new user
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['employee', 'manager', 'payroll_admin', 'org_admin']),
  phone: z.string().optional(),
});

router.post('/users', authenticate, authorize('org_admin'), async (req: Request, res: Response) => {
  try {
    const { orgId } = (req as AuthenticatedRequest).user;
    const data = createUserSchema.parse(req.body);

    const existing = await db('users').where({ org_id: orgId, email: data.email }).first();
    if (existing) {
      sendError(res, 'A user with this email already exists', 409);
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const [user] = await db('users')
      .insert({
        org_id: orgId,
        email: data.email,
        password_hash: passwordHash,
        first_name: data.firstName,
        last_name: data.lastName,
        role: data.role,
        phone: data.phone || null,
      })
      .returning(['id', 'email', 'first_name', 'last_name', 'role', 'is_active']);

    sendSuccess(res, { user }, 201);
  } catch (err: unknown) {
    sendError(res, (err as Error).message, 400);
  }
});

// PUT /admin/users/:id — update a user
const updateUserSchema = z.object({
  role: z.enum(['employee', 'manager', 'payroll_admin', 'org_admin']).optional(),
  isActive: z.boolean().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
});

router.put(
  '/users/:id',
  authenticate,
  authorize('org_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = (req as AuthenticatedRequest).user;
      const userId = req.params.id as string;
      const data = updateUserSchema.parse(req.body);

      // Verify user belongs to this org
      const user = await db('users').where({ id: userId, org_id: orgId }).first();
      if (!user) {
        sendError(res, 'User not found', 404);
        return;
      }

      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (data.role !== undefined) updates.role = data.role;
      if (data.isActive !== undefined) updates.is_active = data.isActive;
      if (data.firstName !== undefined) updates.first_name = data.firstName;
      if (data.lastName !== undefined) updates.last_name = data.lastName;
      if (data.phone !== undefined) updates.phone = data.phone;

      await db('users').where({ id: userId }).update(updates);

      const updated = await db('users')
        .where({ id: userId })
        .select('id', 'email', 'first_name', 'last_name', 'role', 'phone', 'is_active')
        .first();

      sendSuccess(res, { user: updated });
    } catch (err: unknown) {
      sendError(res, (err as Error).message, 400);
    }
  },
);

// GET /admin/settings — get org branding and config
router.get(
  '/settings',
  authenticate,
  authorize('org_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = (req as AuthenticatedRequest).user;
      const org = await db('orgs').where({ id: orgId }).first();

      if (!org) {
        sendError(res, 'Org not found', 404);
        return;
      }

      sendSuccess(res, {
        name: org.name,
        slug: org.slug,
        branding: typeof org.branding === 'string' ? JSON.parse(org.branding) : org.branding,
        config: typeof org.config === 'string' ? JSON.parse(org.config) : org.config,
      });
    } catch (err: unknown) {
      sendError(res, (err as Error).message);
    }
  },
);

// PUT /admin/settings — update org branding and config
const settingsSchema = z.object({
  branding: z
    .object({
      logo: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
    })
    .optional(),
  config: z
    .object({
      ot_rules: z.string().optional(),
      approval_required: z.boolean().optional(),
      sms_enabled: z.boolean().optional(),
      qb_enabled: z.boolean().optional(),
    })
    .optional(),
});

router.put(
  '/settings',
  authenticate,
  authorize('org_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = (req as AuthenticatedRequest).user;
      const data = settingsSchema.parse(req.body);

      const org = await db('orgs').where({ id: orgId }).first();
      if (!org) {
        sendError(res, 'Org not found', 404);
        return;
      }

      const updates: Record<string, unknown> = { updated_at: new Date() };

      if (data.branding) {
        const existing =
          typeof org.branding === 'string' ? JSON.parse(org.branding) : org.branding || {};
        updates.branding = JSON.stringify({ ...existing, ...data.branding });
      }

      if (data.config) {
        const existing = typeof org.config === 'string' ? JSON.parse(org.config) : org.config || {};
        updates.config = JSON.stringify({ ...existing, ...data.config });
      }

      await db('orgs').where({ id: orgId }).update(updates);

      sendSuccess(res, { message: 'Settings updated' });
    } catch (err: unknown) {
      sendError(res, (err as Error).message, 400);
    }
  },
);

export default router;
