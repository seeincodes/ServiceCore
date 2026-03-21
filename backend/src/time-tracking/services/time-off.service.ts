import db from '../../shared/database/connection';
import { emitToOrg } from '../../shared/websocket/socket';
import { enqueueNotification } from '../../notifications/services/queue.service';
import logger from '../../shared/utils/logger';

export type TimeOffType = 'pto' | 'sick' | 'personal' | 'bereavement' | 'jury_duty';
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export interface TimeOffRequest {
  orgId: string;
  userId: string;
  type: TimeOffType;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  hoursRequested: number;
  notes?: string;
}

/**
 * Submit a time-off request. Validates balance availability.
 */
export async function submitRequest(req: TimeOffRequest): Promise<{ requestId: string }> {
  const year = new Date(req.startDate).getFullYear();

  // Check balance (skip for bereavement/jury duty — no balance needed)
  if (req.type !== 'bereavement' && req.type !== 'jury_duty') {
    const balance = await getBalance(req.orgId, req.userId, req.type, year);
    if (balance.available < req.hoursRequested) {
      throw new Error(
        `Insufficient ${req.type.toUpperCase()} balance. Available: ${balance.available}h, Requested: ${req.hoursRequested}h`,
      );
    }
  }

  const [request] = await db('time_off_requests')
    .insert({
      org_id: req.orgId,
      user_id: req.userId,
      type: req.type,
      start_date: req.startDate,
      end_date: req.endDate,
      hours_requested: req.hoursRequested,
      notes: req.notes,
      status: 'pending',
    })
    .returning('id');

  // Notify managers
  emitToOrg(req.orgId, 'time_off_request', {
    requestId: request.id,
    userId: req.userId,
    type: req.type,
    startDate: req.startDate,
    endDate: req.endDate,
    hours: req.hoursRequested,
  });

  logger.info('Time-off request submitted', {
    requestId: request.id,
    userId: req.userId,
    type: req.type,
  });

  return { requestId: request.id };
}

/**
 * Approve a time-off request. Deducts from balance.
 */
export async function approveRequest(
  orgId: string,
  requestId: string,
  managerId: string,
  reviewNotes?: string,
): Promise<void> {
  const request = await db('time_off_requests').where({ id: requestId, org_id: orgId }).first();

  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error(`Request already ${request.status}`);

  const year = new Date(request.start_date).getFullYear();

  await db.transaction(async (trx) => {
    // Update request status
    await trx('time_off_requests').where({ id: requestId }).update({
      status: 'approved',
      reviewed_by: managerId,
      review_notes: reviewNotes,
      reviewed_at: new Date(),
    });

    // Deduct from balance
    await trx('time_off_balances')
      .where({
        org_id: orgId,
        user_id: request.user_id,
        type: request.type,
        year,
      })
      .increment('used_hours', request.hours_requested);
  });

  // Notify the employee
  const user = await db('users').where({ id: request.user_id }).first();
  if (user?.phone) {
    await enqueueNotification({
      type: 'sms',
      to: user.phone,
      body: `TimeKeeper: Your ${request.type.toUpperCase()} request for ${request.start_date} to ${request.end_date} has been approved.`,
    });
  }

  emitToOrg(orgId, 'time_off_approved', { requestId, userId: request.user_id });

  logger.info('Time-off request approved', { requestId, managerId });
}

/**
 * Deny a time-off request.
 */
export async function denyRequest(
  orgId: string,
  requestId: string,
  managerId: string,
  reviewNotes?: string,
): Promise<void> {
  const request = await db('time_off_requests').where({ id: requestId, org_id: orgId }).first();

  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error(`Request already ${request.status}`);

  await db('time_off_requests').where({ id: requestId }).update({
    status: 'denied',
    reviewed_by: managerId,
    review_notes: reviewNotes,
    reviewed_at: new Date(),
  });

  const user = await db('users').where({ id: request.user_id }).first();
  if (user?.phone) {
    await enqueueNotification({
      type: 'sms',
      to: user.phone,
      body: `TimeKeeper: Your ${request.type.toUpperCase()} request for ${request.start_date} to ${request.end_date} was denied.${reviewNotes ? ` Note: ${reviewNotes}` : ''}`,
    });
  }

  emitToOrg(orgId, 'time_off_denied', { requestId, userId: request.user_id });
}

/**
 * Cancel a pending request (by the employee).
 */
export async function cancelRequest(
  orgId: string,
  requestId: string,
  userId: string,
): Promise<void> {
  const request = await db('time_off_requests')
    .where({ id: requestId, org_id: orgId, user_id: userId })
    .first();

  if (!request) throw new Error('Request not found');
  if (request.status !== 'pending') throw new Error('Can only cancel pending requests');

  await db('time_off_requests').where({ id: requestId }).update({ status: 'cancelled' });
}

/**
 * Get time-off balance for a user.
 */
export async function getBalance(
  orgId: string,
  userId: string,
  type: TimeOffType,
  year?: number,
): Promise<{ total: number; used: number; available: number }> {
  const y = year || new Date().getFullYear();

  let balance = await db('time_off_balances')
    .where({ org_id: orgId, user_id: userId, type, year: y })
    .first();

  // Auto-create balance record if it doesn't exist
  if (!balance) {
    const defaults = getDefaultAccrual(type);
    [balance] = await db('time_off_balances')
      .insert({
        org_id: orgId,
        user_id: userId,
        type,
        year: y,
        balance_hours: defaults.annual,
        accrued_hours: defaults.annual,
        used_hours: 0,
      })
      .returning('*');
  }

  return {
    total: Number(balance.balance_hours),
    used: Number(balance.used_hours),
    available: Number(balance.balance_hours) - Number(balance.used_hours),
  };
}

/**
 * Admin: set an employee's total balance hours for a given type/year.
 */
export async function updateBalance(
  orgId: string,
  userId: string,
  type: TimeOffType,
  totalHours: number,
  year?: number,
): Promise<void> {
  const y = year || new Date().getFullYear();

  const existing = await db('time_off_balances')
    .where({ org_id: orgId, user_id: userId, type, year: y })
    .first();

  if (existing) {
    await db('time_off_balances')
      .where({ id: existing.id })
      .update({ balance_hours: totalHours, accrued_hours: totalHours });
  } else {
    await db('time_off_balances').insert({
      org_id: orgId,
      user_id: userId,
      type,
      year: y,
      balance_hours: totalHours,
      accrued_hours: totalHours,
      used_hours: 0,
    });
  }

  logger.info('Balance updated by admin', { orgId, userId, type, totalHours, year: y });
}

/**
 * Get all balances for a user.
 */
export async function getAllBalances(
  orgId: string,
  userId: string,
  year?: number,
): Promise<Record<TimeOffType, { total: number; used: number; available: number }>> {
  const types: TimeOffType[] = ['pto', 'sick', 'personal', 'bereavement', 'jury_duty'];
  const result: any = {};

  for (const type of types) {
    result[type] = await getBalance(orgId, userId, type, year);
  }

  return result;
}

/**
 * List time-off requests for an org (manager view) or user.
 */
export async function listRequests(
  orgId: string,
  filters?: { userId?: string; status?: RequestStatus; startDate?: string; endDate?: string },
): Promise<any[]> {
  const query = db('time_off_requests').where({ org_id: orgId }).orderBy('created_at', 'desc');

  if (filters?.userId) query.andWhere({ user_id: filters.userId });
  if (filters?.status) query.andWhere({ status: filters.status });
  if (filters?.startDate) query.andWhere('start_date', '>=', filters.startDate);
  if (filters?.endDate) query.andWhere('end_date', '<=', filters.endDate);

  const requests = await query;

  // Attach user names
  const userIds = [...new Set(requests.map((r) => r.user_id))];
  const users = await db('users').whereIn('id', userIds).select('id', 'first_name', 'last_name');
  const userMap = new Map(users.map((u) => [u.id, `${u.first_name} ${u.last_name}`]));

  return requests.map((r) => ({
    ...r,
    userName: userMap.get(r.user_id) || 'Unknown',
  }));
}

/**
 * Check if a user has approved time off on a given date.
 */
export async function hasApprovedTimeOff(
  orgId: string,
  userId: string,
  date: string,
): Promise<boolean> {
  const request = await db('time_off_requests')
    .where({ org_id: orgId, user_id: userId, status: 'approved' })
    .where('start_date', '<=', date)
    .where('end_date', '>=', date)
    .first();

  return !!request;
}

function getDefaultAccrual(type: TimeOffType): { annual: number } {
  switch (type) {
    case 'pto':
      return { annual: 80 }; // 10 days
    case 'sick':
      return { annual: 40 }; // 5 days
    case 'personal':
      return { annual: 24 }; // 3 days
    case 'bereavement':
      return { annual: 24 }; // 3 days
    case 'jury_duty':
      return { annual: 40 }; // 5 days
    default:
      return { annual: 0 };
  }
}
