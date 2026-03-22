import { Router, Request, Response } from 'express';
import db from '../../shared/database/connection';
import { authenticate, AuthenticatedRequest, authorize } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

// GET /manager/schedule?weekStart=YYYY-MM-DD
router.get(
  '/schedule',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const weekStart = req.query.weekStart as string;

      if (!weekStart) {
        sendError(res, 'weekStart query parameter is required', 400);
        return;
      }

      const startDate = new Date(weekStart);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      const schedules = await db('schedules')
        .leftJoin('users', 'schedules.user_id', 'users.id')
        .leftJoin('projects', 'schedules.project_id', 'projects.id')
        .where({ 'schedules.org_id': user.orgId })
        .where('schedules.date', '>=', weekStart)
        .where('schedules.date', '<=', endDate.toISOString().split('T')[0])
        .select(
          'schedules.id',
          'schedules.user_id',
          db.raw("users.first_name || ' ' || users.last_name as user_name"),
          'schedules.date',
          'schedules.project_id',
          'projects.name as project_name',
          'schedules.route_id',
          'schedules.shift_start',
          'schedules.shift_end',
          'schedules.template_id',
          'schedules.notes',
        );

      sendSuccess(res, {
        schedules: schedules.map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          userName: s.user_name,
          date: s.date,
          projectId: s.project_id,
          projectName: s.project_name,
          routeId: s.route_id,
          shiftStart: s.shift_start,
          shiftEnd: s.shift_end,
          templateId: s.template_id,
          notes: s.notes,
        })),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get schedules';
      sendError(res, message);
    }
  },
);

// POST /manager/schedule
router.post(
  '/schedule',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { userId, date, projectId, routeId, shiftStart, shiftEnd, templateId, notes } =
        req.body;

      if (!userId || !date) {
        sendError(res, 'userId and date are required', 400);
        return;
      }

      // Upsert: if schedule exists for user+date, update it
      const existing = await db('schedules')
        .where({ org_id: user.orgId, user_id: userId, date })
        .first();

      if (existing) {
        await db('schedules')
          .where({ id: existing.id })
          .update({
            project_id: projectId || null,
            route_id: routeId || null,
            shift_start: shiftStart || null,
            shift_end: shiftEnd || null,
            template_id: templateId || null,
            notes: notes || null,
            updated_at: new Date(),
          });

        const updated = await db('schedules').where({ id: existing.id }).first();
        sendSuccess(res, { schedule: updated });
      } else {
        const [schedule] = await db('schedules')
          .insert({
            org_id: user.orgId,
            user_id: userId,
            date,
            project_id: projectId || null,
            route_id: routeId || null,
            shift_start: shiftStart || null,
            shift_end: shiftEnd || null,
            template_id: templateId || null,
            notes: notes || null,
          })
          .returning('*');

        sendSuccess(res, { schedule }, 201);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save schedule';
      sendError(res, message);
    }
  },
);

// DELETE /manager/schedule/:id
router.delete(
  '/schedule/:id',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const deleted = await db('schedules').where({ id: req.params.id, org_id: user.orgId }).del();

      if (!deleted) {
        sendError(res, 'Schedule not found', 404);
        return;
      }
      sendSuccess(res, { status: 'deleted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete schedule';
      sendError(res, message);
    }
  },
);

// GET /manager/shift-templates
router.get(
  '/shift-templates',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const templates = await db('shift_templates')
        .where({ org_id: user.orgId, is_active: true })
        .orderBy('name');

      sendSuccess(res, { templates });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to get templates';
      sendError(res, message);
    }
  },
);

// POST /manager/shift-templates
router.post(
  '/shift-templates',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { name, shiftStart, shiftEnd, projectId, routeId, color } = req.body;

      if (!name || !shiftStart || !shiftEnd) {
        sendError(res, 'name, shiftStart, and shiftEnd are required', 400);
        return;
      }

      const [template] = await db('shift_templates')
        .insert({
          org_id: user.orgId,
          name,
          shift_start: shiftStart,
          shift_end: shiftEnd,
          project_id: projectId || null,
          route_id: routeId || null,
          color: color || null,
        })
        .returning('*');

      sendSuccess(res, { template }, 201);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create template';
      sendError(res, message);
    }
  },
);

// PUT /manager/shift-templates/:id
router.put(
  '/shift-templates/:id',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const templateId = req.params.id;
      const { name, shiftStart, shiftEnd, projectId, routeId, color } = req.body;

      const existing = await db('shift_templates')
        .where({ id: templateId, org_id: user.orgId })
        .first();

      if (!existing) {
        sendError(res, 'Template not found', 404);
        return;
      }

      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (name !== undefined) updates.name = name;
      if (shiftStart !== undefined) updates.shift_start = shiftStart;
      if (shiftEnd !== undefined) updates.shift_end = shiftEnd;
      if (projectId !== undefined) updates.project_id = projectId || null;
      if (routeId !== undefined) updates.route_id = routeId || null;
      if (color !== undefined) updates.color = color || null;

      await db('shift_templates').where({ id: templateId }).update(updates);
      const updated = await db('shift_templates').where({ id: templateId }).first();

      sendSuccess(res, { template: updated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update template';
      sendError(res, message);
    }
  },
);

// DELETE /manager/shift-templates/:id
router.delete(
  '/shift-templates/:id',
  authenticate,
  authorize('manager', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const deleted = await db('shift_templates')
        .where({ id: req.params.id, org_id: user.orgId })
        .del();

      if (!deleted) {
        sendError(res, 'Template not found', 404);
        return;
      }
      sendSuccess(res, { status: 'deleted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete template';
      sendError(res, message);
    }
  },
);

export default router;
