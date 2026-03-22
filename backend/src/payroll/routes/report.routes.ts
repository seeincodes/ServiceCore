import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as reportService from '../services/report.service';
import * as exportService from '../services/export.service';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware/authenticate';
import { authorize } from '../../auth/middleware/authenticate';
import { sendSuccess, sendError } from '../../shared/utils/response';

const router = Router();

const generateSchema = z.object({
  period: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly', 'custom']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  format: z.enum(['csv', 'pdf', 'xlsx']).optional().default('csv'),
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
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      });

      if (data.format === 'pdf') {
        const rows = parseCsvToRows(result.csv);
        const { startDate, endDate } = getDateRangeFromCsv(result.csv);
        const pdfBuffer = await exportService.generatePdf(rows, startDate, endDate);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.reportId}.pdf"`);
        res.send(pdfBuffer);
        return;
      }

      if (data.format === 'xlsx') {
        const rows = parseCsvToRows(result.csv);
        const { startDate, endDate } = getDateRangeFromCsv(result.csv);
        const xlsxBuffer = await exportService.generateExcel(rows, startDate, endDate);
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${result.reportId}.xlsx"`);
        res.send(xlsxBuffer);
        return;
      }

      // CSV (default)
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

function parseCsvToRows(csv: string) {
  const lines = csv.split('\n').filter((l) => l && !l.startsWith('#'));
  const [, ...dataLines] = lines; // skip header

  return dataLines
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.split(',');
      return {
        employeeId: parts[0],
        employeeName: (parts[1] || '').replace(/"/g, ''),
        email: parts[2],
        regularHours: Number(parts[3]),
        otHours: Number(parts[4]),
        totalHours: Number(parts[5]),
        projects: (parts[6] || '').replace(/"/g, ''),
      };
    });
}

function getDateRangeFromCsv(csv: string): { startDate: Date; endDate: Date } {
  const metaLine = csv.split('\n').find((l) => l.startsWith('#'));
  if (metaLine) {
    const match = metaLine.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
    if (match) {
      return { startDate: new Date(match[1]), endDate: new Date(match[2]) };
    }
  }
  return { startDate: new Date(), endDate: new Date() };
}

export default router;
