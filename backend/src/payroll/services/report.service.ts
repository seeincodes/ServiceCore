import db from '../../shared/database/connection';
import AWS from 'aws-sdk';
import logger from '../../shared/utils/logger';

const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-east-1' });
const S3_BUCKET = process.env.S3_EXPORTS_BUCKET;

export type PayPeriod = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export interface ReportParams {
  orgId: string;
  period: PayPeriod;
  endDate?: Date;
  format?: 'csv';
}

export interface ReportResult {
  reportId: string;
  url: string | null;
  csv: string;
  rowCount: number;
}

interface PayrollRow {
  employeeId: string;
  employeeName: string;
  email: string;
  regularHours: number;
  otHours: number;
  totalHours: number;
  projects: string;
}

export async function generateReport(params: ReportParams): Promise<ReportResult> {
  const { orgId, period, endDate } = params;
  const { startDate, periodEnd } = getDateRange(period, endDate);

  // Get all completed clock entries in range for org
  const entries = await db('clock_entries')
    .join('users', 'clock_entries.user_id', 'users.id')
    .where({ 'clock_entries.org_id': orgId })
    .where('clock_entries.clock_in', '>=', startDate)
    .where('clock_entries.clock_in', '<', periodEnd)
    .whereNotNull('clock_entries.clock_out')
    .select(
      'users.id as user_id',
      'users.first_name',
      'users.last_name',
      'users.email',
      'clock_entries.clock_in',
      'clock_entries.clock_out',
      'clock_entries.project_id',
    );

  // Aggregate by employee
  const employeeMap = new Map<string, PayrollRow>();

  for (const entry of entries) {
    const hours =
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);

    const existing = employeeMap.get(entry.user_id);
    if (existing) {
      existing.totalHours += hours;
      if (entry.project_id && !existing.projects.includes(entry.project_id)) {
        existing.projects += existing.projects ? `;${entry.project_id}` : entry.project_id;
      }
    } else {
      employeeMap.set(entry.user_id, {
        employeeId: entry.user_id,
        employeeName: `${entry.first_name || ''} ${entry.last_name || ''}`.trim(),
        email: entry.email,
        regularHours: 0,
        otHours: 0,
        totalHours: hours,
        projects: entry.project_id || '',
      });
    }
  }

  // Calculate OT (federal: >40h regular, rest is OT)
  for (const row of employeeMap.values()) {
    row.totalHours = Math.round(row.totalHours * 100) / 100;
    if (row.totalHours > 40) {
      row.regularHours = 40;
      row.otHours = Math.round((row.totalHours - 40) * 100) / 100;
    } else {
      row.regularHours = row.totalHours;
      row.otHours = 0;
    }
  }

  const rows = Array.from(employeeMap.values());
  const csv = generateCsv(rows, startDate, periodEnd);
  const reportId = `report-${orgId}-${periodEnd.toISOString().split('T')[0]}-${Date.now()}`;

  // Upload to S3 if configured
  let url: string | null = null;
  if (S3_BUCKET) {
    url = await uploadToS3(reportId, csv);
  }

  return { reportId, url, csv, rowCount: rows.length };
}

function generateCsv(rows: PayrollRow[], startDate: Date, endDate: Date): string {
  const header = 'Employee ID,Employee Name,Email,Regular Hours,OT Hours,Total Hours,Projects';
  const lines = rows.map(
    (r) =>
      `${r.employeeId},"${r.employeeName}",${r.email},${r.regularHours},${r.otHours},${r.totalHours},"${r.projects}"`,
  );

  const meta = `# Payroll Report: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
  return `${meta}\n${header}\n${lines.join('\n')}\n`;
}

async function uploadToS3(key: string, csv: string): Promise<string> {
  const s3Key = `exports/${key}.csv`;
  try {
    await s3
      .putObject({
        Bucket: S3_BUCKET!,
        Key: s3Key,
        Body: csv,
        ContentType: 'text/csv',
      })
      .promise();
    logger.info('Report uploaded to S3', { key: s3Key });
    return `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
  } catch (err) {
    logger.error('S3 upload failed', { error: (err as Error).message });
    throw err;
  }
}

function getDateRange(period: PayPeriod, endDate?: Date): { startDate: Date; periodEnd: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);

  switch (period) {
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'biweekly':
      start.setDate(start.getDate() - 14);
      break;
    case 'semimonthly':
      start.setDate(start.getDate() - 15);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
  }

  start.setHours(0, 0, 0, 0);
  return { startDate: start, periodEnd: end };
}
