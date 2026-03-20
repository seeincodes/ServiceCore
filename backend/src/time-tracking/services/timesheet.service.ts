import db from '../../shared/database/connection';
import logger from '../../shared/utils/logger';

export interface TimesheetSummary {
  id: string;
  userId: string;
  userName: string;
  weekEnding: string;
  status: string;
  hoursWorked: number;
  otHours: number;
}

export interface TimesheetDetail extends TimesheetSummary {
  entries: {
    id: string;
    clockIn: string;
    clockOut: string | null;
    hours: number | null;
    routeId: string | null;
  }[];
  approvals: {
    id: string;
    managerId: string;
    managerName: string;
    status: string;
    notes: string | null;
    createdAt: string;
  }[];
}

/**
 * Get or create a timesheet for a user for the current week.
 */
export async function getOrCreateTimesheet(orgId: string, userId: string): Promise<string> {
  const weekEnding = getWeekEnding();

  const existing = await db('timesheets')
    .where({ org_id: orgId, user_id: userId, week_ending: weekEnding })
    .first();

  if (existing) return existing.id;

  const [ts] = await db('timesheets')
    .insert({
      org_id: orgId,
      user_id: userId,
      week_ending: weekEnding,
      status: 'draft',
    })
    .returning('id');

  return ts.id;
}

/**
 * Submit a timesheet — aggregates hours from clock entries.
 */
export async function submitTimesheet(orgId: string, timesheetId: string): Promise<void> {
  const ts = await db('timesheets').where({ id: timesheetId, org_id: orgId }).first();

  if (!ts) throw new Error('Timesheet not found');
  if (ts.status !== 'draft') throw new Error(`Cannot submit: timesheet is ${ts.status}`);

  // Calculate hours from clock entries for the week
  const weekStart = new Date(ts.week_ending);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(ts.week_ending);
  weekEnd.setHours(23, 59, 59, 999);

  const entries = await db('clock_entries')
    .where({ org_id: orgId, user_id: ts.user_id })
    .where('clock_in', '>=', weekStart)
    .where('clock_in', '<=', weekEnd)
    .whereNotNull('clock_out');

  let totalHours = 0;
  for (const entry of entries) {
    totalHours +=
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
  }

  totalHours = Math.round(totalHours * 100) / 100;
  const otHours = totalHours > 40 ? Math.round((totalHours - 40) * 100) / 100 : 0;

  await db('timesheets').where({ id: timesheetId }).update({
    status: 'submitted',
    hours_worked: totalHours,
    ot_hours: otHours,
    updated_at: new Date(),
  });

  logger.info('Timesheet submitted', { timesheetId, totalHours, otHours });
}

/**
 * Auto-submit all draft timesheets for the current week (Friday 5pm job).
 */
export async function autoSubmitDraftTimesheets(): Promise<number> {
  const weekEnding = getWeekEnding();

  const drafts = await db('timesheets').where({ week_ending: weekEnding, status: 'draft' });

  let submitted = 0;
  for (const ts of drafts) {
    try {
      await submitTimesheet(ts.org_id, ts.id);
      submitted++;
    } catch (err) {
      logger.warn('Auto-submit failed', { timesheetId: ts.id, error: (err as Error).message });
    }
  }

  logger.info('Auto-submit complete', { weekEnding, submitted });
  return submitted;
}

/**
 * Approve, reject, or request revision on a timesheet.
 */
export async function reviewTimesheet(
  orgId: string,
  timesheetId: string,
  managerId: string,
  action: 'approved' | 'rejected' | 'revision_requested',
  notes?: string,
): Promise<void> {
  const ts = await db('timesheets').where({ id: timesheetId, org_id: orgId }).first();

  if (!ts) throw new Error('Timesheet not found');
  if (ts.status === 'locked') throw new Error('Timesheet is locked and cannot be modified');
  if (ts.status !== 'submitted') throw new Error(`Cannot review: timesheet is ${ts.status}`);

  // Create approval record
  await db('timesheet_approvals').insert({
    org_id: orgId,
    timesheet_id: timesheetId,
    manager_id: managerId,
    status: action,
    notes: notes || null,
  });

  // Update timesheet status
  let newStatus: string;
  if (action === 'approved') {
    newStatus = 'approved';
  } else if (action === 'revision_requested') {
    newStatus = 'draft'; // Send back to draft for revision
  } else {
    newStatus = 'draft'; // Rejected also goes back to draft
  }

  await db('timesheets').where({ id: timesheetId }).update({
    status: newStatus,
    updated_at: new Date(),
  });

  // Log to audit trail
  await db('audit_log').insert({
    org_id: orgId,
    user_id: managerId,
    action: `timesheet_${action}`,
    entity_type: 'timesheet',
    entity_id: timesheetId,
    details: JSON.stringify({ notes, previousStatus: ts.status }),
  });

  logger.info('Timesheet reviewed', { timesheetId, action, managerId });
}

/**
 * Lock approved timesheets (makes them immutable).
 */
export async function lockApprovedTimesheets(orgId: string): Promise<number> {
  const result = await db('timesheets')
    .where({ org_id: orgId, status: 'approved' })
    .update({ status: 'locked', updated_at: new Date() });

  if (result > 0) {
    logger.info('Timesheets locked', { orgId, count: result });
  }
  return result;
}

/**
 * Get pending approvals for a manager's org.
 */
export async function getPendingApprovals(orgId: string): Promise<TimesheetSummary[]> {
  const timesheets = await db('timesheets')
    .join('users', 'timesheets.user_id', 'users.id')
    .where({ 'timesheets.org_id': orgId, 'timesheets.status': 'submitted' })
    .select(
      'timesheets.id',
      'timesheets.user_id',
      'users.first_name',
      'users.last_name',
      'timesheets.week_ending',
      'timesheets.status',
      'timesheets.hours_worked',
      'timesheets.ot_hours',
    )
    .orderBy('timesheets.week_ending', 'desc');

  return timesheets.map((ts) => ({
    id: ts.id,
    userId: ts.user_id,
    userName: `${ts.first_name || ''} ${ts.last_name || ''}`.trim(),
    weekEnding: ts.week_ending,
    status: ts.status,
    hoursWorked: Number(ts.hours_worked),
    otHours: Number(ts.ot_hours),
  }));
}

/**
 * Get the Friday date for the current week ending.
 */
function getWeekEnding(date?: Date): string {
  const d = date || new Date();
  const day = d.getDay();
  const diff = day <= 5 ? 5 - day : 5 - day + 7; // Next Friday or today if Friday
  const friday = new Date(d);
  friday.setDate(d.getDate() + diff);
  return friday.toISOString().split('T')[0];
}
