import db from '../../shared/database/connection';
import { enqueueNotification } from './queue.service';
import { emitToOrg } from '../../shared/websocket/socket';
import logger from '../../shared/utils/logger';

export type AlertPriority = 'critical' | 'warning' | 'info';

export interface ManagerAlert {
  orgId: string;
  type: string;
  priority: AlertPriority;
  title: string;
  message: string;
  userId?: string; // the employee this is about
  data?: Record<string, unknown>;
}

/**
 * Send an alert to all managers and admins in an org via WebSocket, email, and SMS.
 * Critical alerts also send SMS. Info alerts are WebSocket + email only.
 */
export async function notifyManagers(alert: ManagerAlert): Promise<void> {
  const { orgId, type, priority, title, message, userId, data } = alert;

  // Store the alert in audit_log for the review queue
  await db('audit_log').insert({
    org_id: orgId,
    user_id: userId || null,
    action: `manager_alert:${type}`,
    entity_type: 'notification',
    details: JSON.stringify({ type, priority, title, message, ...data }),
  });

  // Get all managers and admins for this org
  const managers = await db('users')
    .where({ org_id: orgId, is_active: true })
    .whereIn('role', ['manager', 'org_admin'])
    .select('id', 'email', 'phone', 'first_name');

  // Get employee name if userId provided
  let employeeName = '';
  if (userId) {
    const emp = await db('users').where({ id: userId }).select('first_name', 'last_name').first();
    if (emp) employeeName = `${emp.first_name} ${emp.last_name}`;
  }

  // WebSocket — immediate push to all connected managers
  emitToOrg(orgId, 'manager_alert', {
    type,
    priority,
    title,
    message,
    userId,
    employeeName,
    timestamp: new Date().toISOString(),
    ...data,
  });

  // Email all managers
  for (const mgr of managers) {
    try {
      await enqueueNotification({
        type: 'email',
        to: mgr.email,
        subject: `[TimeKeeper] ${priority === 'critical' ? '🔴 ' : ''}${title}`,
        body: `${message}\n\n${employeeName ? `Employee: ${employeeName}` : ''}\nTime: ${new Date().toLocaleString()}`,
      });
    } catch (err) {
      logger.error('Failed to email manager', { managerId: mgr.id, error: (err as Error).message });
    }
  }

  // SMS for critical alerts only
  if (priority === 'critical') {
    for (const mgr of managers) {
      if (!mgr.phone) continue;
      try {
        await enqueueNotification({
          type: 'sms',
          to: mgr.phone,
          body: `TimeKeeper: ${title} — ${message}`,
        });
      } catch (err) {
        logger.error('Failed to SMS manager', { managerId: mgr.id, error: (err as Error).message });
      }
    }
  }

  logger.info('Manager alert sent', { orgId, type, priority, managerCount: managers.length });
}
