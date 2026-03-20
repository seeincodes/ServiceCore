import db from '../../shared/database/connection';
import { enqueueNotification } from './queue.service';
import { buildTimesheetReminderEmail } from './email.service';
import logger from '../../shared/utils/logger';

type ReminderType = 'thursday' | 'friday_morning' | 'friday_eod';

export async function sendTimesheetReminders(reminderType: ReminderType): Promise<number> {
  // Get all active employees across all orgs that have approval_required
  const employees = await db('users')
    .join('orgs', 'users.org_id', 'orgs.id')
    .where({ 'users.role': 'employee', 'users.is_active': true, 'orgs.is_active': true })
    .whereRaw("orgs.config->>'approval_required' = 'true'")
    .select('users.email', 'users.first_name', 'users.last_name');

  let sent = 0;

  for (const emp of employees) {
    const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Team Member';
    const { subject, text } = buildTimesheetReminderEmail(name, reminderType);

    try {
      await enqueueNotification({
        type: 'email',
        to: emp.email,
        subject,
        body: text,
      });
      sent++;
    } catch (err) {
      logger.error('Failed to enqueue reminder', {
        email: emp.email,
        error: (err as Error).message,
      });
    }
  }

  logger.info(`Timesheet reminders sent`, { type: reminderType, count: sent });
  return sent;
}

/**
 * Determine which reminder to send based on current day/time.
 * Thu 4pm → 'thursday'
 * Fri 9am → 'friday_morning'
 * Fri 5pm → 'friday_eod'
 */
export function getReminderType(): ReminderType | null {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 4=Thu, 5=Fri
  const hour = now.getHours();

  if (day === 4 && hour >= 16) return 'thursday';
  if (day === 5 && hour >= 9 && hour < 12) return 'friday_morning';
  if (day === 5 && hour >= 17) return 'friday_eod';

  return null;
}
