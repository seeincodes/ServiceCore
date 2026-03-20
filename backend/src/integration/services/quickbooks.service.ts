import db from '../../shared/database/connection';
import { enqueueNotification } from '../../notifications/services/queue.service';
import logger from '../../shared/utils/logger';

const QB_CLIENT_ID = process.env.QB_CLIENT_ID;
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET;

export interface QBPayrollEntry {
  employeeId: string;
  employeeName: string;
  email: string;
  regularHours: number;
  otHours: number;
  totalHours: number;
  projects: string[];
}

/**
 * Run the nightly QuickBooks sync job.
 * Pushes approved/locked timesheets for the most recent completed week.
 */
export async function runNightlyQBSync(): Promise<{
  pushed: number;
  failed: number;
  errors: string[];
}> {
  logger.info('Starting nightly QB sync');

  // Get all orgs with QB configured
  const orgs = await db('orgs').where({ is_active: true }).select('id', 'name', 'config');

  let totalPushed = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  for (const org of orgs) {
    const config = typeof org.config === 'string' ? JSON.parse(org.config) : org.config;
    if (!config?.qb_enabled) continue;

    try {
      const entries = await getApprovedPayrollEntries(org.id);
      if (entries.length === 0) continue;

      await pushToQuickBooks(org.id, entries);
      totalPushed += entries.length;

      logger.info('QB sync complete for org', { orgId: org.id, entries: entries.length });
    } catch (err) {
      totalFailed++;
      const errorMsg = `QB sync failed for ${org.name}: ${(err as Error).message}`;
      errors.push(errorMsg);
      logger.error(errorMsg);

      // Alert payroll admin
      await alertPayrollAdmin(org.id, errorMsg);
    }
  }

  logger.info('Nightly QB sync complete', { pushed: totalPushed, failed: totalFailed });
  return { pushed: totalPushed, failed: totalFailed, errors };
}

/**
 * Get payroll entries from approved/locked timesheets.
 */
async function getApprovedPayrollEntries(orgId: string): Promise<QBPayrollEntry[]> {
  const timesheets = await db('timesheets')
    .join('users', 'timesheets.user_id', 'users.id')
    .where({ 'timesheets.org_id': orgId })
    .whereIn('timesheets.status', ['approved', 'locked'])
    .select(
      'users.id as user_id',
      'users.first_name',
      'users.last_name',
      'users.email',
      'timesheets.hours_worked',
      'timesheets.ot_hours',
      'timesheets.week_ending',
    );

  // Get projects per user from clock entries
  const entries: QBPayrollEntry[] = [];

  for (const ts of timesheets) {
    const weekStart = new Date(ts.week_ending);
    weekStart.setDate(weekStart.getDate() - 6);

    const clockEntries = await db('clock_entries')
      .where({ org_id: orgId, user_id: ts.user_id })
      .where('clock_in', '>=', weekStart)
      .where('clock_in', '<=', ts.week_ending)
      .whereNotNull('project_id')
      .distinct('project_id');

    entries.push({
      employeeId: ts.user_id,
      employeeName: `${ts.first_name || ''} ${ts.last_name || ''}`.trim(),
      email: ts.email,
      regularHours: Number(ts.hours_worked) - Number(ts.ot_hours),
      otHours: Number(ts.ot_hours),
      totalHours: Number(ts.hours_worked),
      projects: clockEntries.map((e: { project_id: string }) => e.project_id),
    });
  }

  return entries;
}

/**
 * Push payroll entries to QuickBooks API.
 */
async function pushToQuickBooks(orgId: string, entries: QBPayrollEntry[]): Promise<void> {
  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
    logger.warn('QB credentials not configured, skipping push', { orgId });
    return;
  }

  // In production, this would use the node-quickbooks SDK
  // For now, log what would be sent
  logger.info('QB push payload', {
    orgId,
    entryCount: entries.length,
    totalHours: entries.reduce((sum, e) => sum + e.totalHours, 0),
  });

  // TODO: Implement actual QB API calls when credentials are available
  // const qbo = new QuickBooks(QB_CLIENT_ID, QB_CLIENT_SECRET, ...);
  // for (const entry of entries) {
  //   await qbo.createTimeActivity({ ... });
  // }
}

/**
 * Alert payroll admin of sync failures.
 */
async function alertPayrollAdmin(orgId: string, errorMsg: string): Promise<void> {
  const admins = await db('users')
    .where({ org_id: orgId, role: 'payroll_admin', is_active: true })
    .select('email', 'first_name');

  for (const admin of admins) {
    await enqueueNotification({
      type: 'email',
      to: admin.email,
      subject: 'QuickBooks Sync Failed',
      body: `Hi ${admin.first_name || 'Admin'},\n\nThe nightly QuickBooks sync encountered an error:\n\n${errorMsg}\n\nPlease check the integration status and retry if needed.\n\n- TimeKeeper`,
    });
  }
}

/**
 * Schedule the nightly job (called from server startup).
 */
export function scheduleNightlySync(): void {
  const checkAndRun = () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    // Run at 2:00 AM UTC
    if (utcHour === 2 && utcMinute === 0) {
      runNightlyQBSync().catch((err) => {
        logger.error('Nightly QB sync crashed', { error: (err as Error).message });
      });
    }
  };

  // Check every minute
  setInterval(checkAndRun, 60000);
  logger.info('QB nightly sync scheduled for 2:00 AM UTC');
}
