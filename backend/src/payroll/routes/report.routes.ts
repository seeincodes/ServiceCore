import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as reportService from '../services/report.service';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware/authenticate';
import { authorize } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

const generateSchema = z.object({
  period: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly']),
  endDate: z.string().optional(),
  format: z.enum(['csv']).optional().default('csv'),
});

// POST /manager/reports/generate
router.post(
  '/reports/generate',
  authenticate,
  authorize('manager', 'payroll_admin', 'org_admin'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const data = generateSchema.parse(req.body);

      const result = await reportService.generateReport({
        orgId: user.orgId,
        period: data.period,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        format: data.format,
      });

      // If no S3 URL, return CSV directly
      if (!result.url) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.reportId}.csv"`);
        res.send(result.csv);
        return;
      }

      sendSuccess(res, {
        reportId: result.reportId,
        url: result.url,
        rowCount: result.rowCount,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Report generation failed';
      sendError(res, message);
    }
  },
);

export default router;
