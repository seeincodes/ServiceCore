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
        'hourly_rate',
        'ot_multiplier',
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
  hourlyRate: z.number().min(0).optional(),
  otMultiplier: z.number().min(1).max(3).optional(),
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
      if (data.hourlyRate !== undefined) updates.hourly_rate = data.hourlyRate;
      if (data.otMultiplier !== undefined) updates.ot_multiplier = data.otMultiplier;

      await db('users').where({ id: userId }).update(updates);

      const updated = await db('users')
        .where({ id: userId })
        .select(
          'id',
          'email',
          'first_name',
          'last_name',
          'role',
          'phone',
          'is_active',
          'hourly_rate',
          'ot_multiplier',
        )
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

// GET /admin/stats/trends — daily active users + weekly hours totals
router.get(
  '/stats/trends',
  authenticate,
  authorize('org_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = (req as AuthenticatedRequest).user;

      // Daily active users for the last 30 days
      const dailyActive = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayStart = `${dateStr}T00:00:00.000Z`;
        const dayEnd = `${dateStr}T23:59:59.999Z`;

        const result = await db('clock_entries')
          .where({ org_id: orgId })
          .where('clock_in', '>=', dayStart)
          .where('clock_in', '<=', dayEnd)
          .countDistinct('user_id as count')
          .first();

        dailyActive.push({
          date: dateStr,
          count: Number(result?.count || 0),
        });
      }

      // Weekly hours totals for the last 8 weeks
      const weeklyHours = [];
      for (let i = 0; i < 8; i++) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const sundayOffset = -dayOfWeek - i * 7;
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + sundayOffset);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        const weekEndingStr = weekEnd.toISOString().split('T')[0];

        const result = await db('clock_entries')
          .where({ org_id: orgId })
          .where('clock_in', '>=', weekStart.toISOString())
          .where('clock_in', '<=', weekEnd.toISOString())
          .whereNotNull('clock_out')
          .select(
            db.raw(
              'COALESCE(SUM(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600), 0) as total_hours',
            ),
          )
          .first();

        weeklyHours.push({
          weekEnding: weekEndingStr,
          hours: Math.round(Number(result?.total_hours || 0) * 100) / 100,
        });
      }

      sendSuccess(res, { dailyActive, weeklyHours });
    } catch (err: unknown) {
      sendError(res, (err as Error).message);
    }
  },
);

// ============================================================
// WORK ZONES (Depots / Locations)
// ============================================================

// GET /admin/zones — list all work zones
router.get('/zones', authenticate, authorize('org_admin'), async (req: Request, res: Response) => {
  try {
    const { orgId } = (req as AuthenticatedRequest).user;
    const zones = await db('work_zones').where({ org_id: orgId }).orderBy('name');
    sendSuccess(res, { zones });
  } catch (err: unknown) {
    sendError(res, (err as Error).message);
  }
});

// POST /admin/zones — create a work zone
const createZoneSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['depot', 'route_start', 'job_site', 'landfill', 'transfer_station']),
  lat: z.number(),
  lon: z.number(),
  radiusMeters: z.number().min(50).max(10000).default(200),
  address: z.string().optional(),
});

router.post('/zones', authenticate, authorize('org_admin'), async (req: Request, res: Response) => {
  try {
    const { orgId } = (req as AuthenticatedRequest).user;
    const data = createZoneSchema.parse(req.body);

    const [zone] = await db('work_zones')
      .insert({
        org_id: orgId,
        name: data.name,
        type: data.type,
        lat: data.lat,
        lon: data.lon,
        radius_meters: data.radiusMeters,
        address: data.address,
      })
      .returning('*');

    sendSuccess(res, { zone }, 201);
  } catch (err: unknown) {
    sendError(res, (err as Error).message, 400);
  }
});

// PUT /admin/zones/:id — update a work zone
router.put(
  '/zones/:id',
  authenticate,
  authorize('org_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = (req as AuthenticatedRequest).user;
      const zoneId = req.params.id as string;
      const data = req.body;

      const zone = await db('work_zones').where({ id: zoneId, org_id: orgId }).first();
      if (!zone) {
        sendError(res, 'Zone not found', 404);
        return;
      }

      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (data.name) updates.name = data.name;
      if (data.type) updates.type = data.type;
      if (data.lat !== undefined) updates.lat = data.lat;
      if (data.lon !== undefined) updates.lon = data.lon;
      if (data.radiusMeters !== undefined) updates.radius_meters = data.radiusMeters;
      if (data.address !== undefined) updates.address = data.address;
      if (data.isActive !== undefined) updates.is_active = data.isActive;

      await db('work_zones').where({ id: zoneId }).update(updates);
      const updated = await db('work_zones').where({ id: zoneId }).first();
      sendSuccess(res, { zone: updated });
    } catch (err: unknown) {
      sendError(res, (err as Error).message, 400);
    }
  },
);

// DELETE /admin/zones/:id — delete a work zone
router.delete(
  '/zones/:id',
  authenticate,
  authorize('org_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = (req as AuthenticatedRequest).user;
      const zoneId = req.params.id as string;

      const deleted = await db('work_zones').where({ id: zoneId, org_id: orgId }).del();

      if (!deleted) {
        sendError(res, 'Zone not found', 404);
        return;
      }
      sendSuccess(res, { status: 'deleted' });
    } catch (err: unknown) {
      sendError(res, (err as Error).message);
    }
  },
);

// ============================================================
// PROJECTS
// ============================================================

// GET /admin/projects — list all projects
router.get('/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const { orgId } = (req as AuthenticatedRequest).user;
    const projects = await db('projects').where({ org_id: orgId }).orderBy('code');
    sendSuccess(res, { projects });
  } catch (err: unknown) {
    sendError(res, (err as Error).message);
  }
});

// POST /admin/projects — create a project
const createProjectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  budgetedHours: z.number().min(0).optional(),
  budgetAmount: z.number().min(0).optional(),
});

router.post(
  '/projects',
  authenticate,
  authorize('org_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = (req as AuthenticatedRequest).user;
      const data = createProjectSchema.parse(req.body);
      const insert: Record<string, unknown> = {
        org_id: orgId,
        code: data.code,
        name: data.name,
        description: data.description,
        color: data.color,
      };
      if (data.budgetedHours !== undefined) insert.budgeted_hours = data.budgetedHours;
      if (data.budgetAmount !== undefined) insert.budget_amount = data.budgetAmount;
      const [project] = await db('projects').insert(insert).returning('*');
      sendSuccess(res, { project }, 201);
    } catch (err: unknown) {
      sendError(res, (err as Error).message, 400);
    }
  },
);

// PUT /admin/projects/:id — update a project (managers can update budgets)
router.put(
  '/projects/:id',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = (req as AuthenticatedRequest).user;
      const id = req.params.id as string;
      const data = req.body;

      const project = await db('projects').where({ id, org_id: orgId }).first();
      if (!project) {
        sendError(res, 'Project not found', 404);
        return;
      }

      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (data.name) updates.name = data.name;
      if (data.code) updates.code = data.code;
      if (data.description !== undefined) updates.description = data.description;
      if (data.color !== undefined) updates.color = data.color;
      if (data.budgetedHours !== undefined) updates.budgeted_hours = data.budgetedHours;
      if (data.budgetAmount !== undefined) updates.budget_amount = data.budgetAmount;
      if (data.isActive !== undefined) updates.is_active = data.isActive;

      await db('projects').where({ id }).update(updates);
      const updated = await db('projects').where({ id }).first();
      sendSuccess(res, { project: updated });
    } catch (err: unknown) {
      sendError(res, (err as Error).message, 400);
    }
  },
);

// DELETE /admin/projects/:id
router.delete(
  '/projects/:id',
  authenticate,
  authorize('org_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = (req as AuthenticatedRequest).user;
      const deleted = await db('projects')
        .where({ id: req.params.id as string, org_id: orgId })
        .del();
      if (!deleted) {
        sendError(res, 'Project not found', 404);
        return;
      }
      sendSuccess(res, { status: 'deleted' });
    } catch (err: unknown) {
      sendError(res, (err as Error).message);
    }
  },
);

export default router;
