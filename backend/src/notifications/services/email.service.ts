import sgMail from '@sendgrid/mail';
import logger from '../../shared/utils/logger';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@timekeeper.app';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<void> {
  if (!SENDGRID_API_KEY) {
    logger.warn('SENDGRID_API_KEY not set, skipping email', {
      to: params.to,
      subject: params.subject,
    });
    return;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: FROM_EMAIL,
      subject: params.subject,
      text: params.text,
      html: params.html || params.text,
    });
    logger.info('Email sent', { to: params.to, subject: params.subject });
  } catch (err) {
    logger.error('Email send failed', { to: params.to, error: (err as Error).message });
    throw err;
  }
}

export function buildTimesheetReminderEmail(
  employeeName: string,
  reminderType: 'thursday' | 'friday_morning' | 'friday_eod',
): { subject: string; text: string } {
  const subjects: Record<string, string> = {
    thursday: 'Reminder: Submit your timesheet tomorrow',
    friday_morning: 'Reminder: Timesheet due today',
    friday_eod: 'Final reminder: Submit your timesheet now',
  };

  const bodies: Record<string, string> = {
    thursday: `Hi ${employeeName},\n\nThis is a reminder that your weekly timesheet is due tomorrow (Friday) by end of day.\n\nPlease review your clock entries and submit your timesheet.\n\n- TimeKeeper`,
    friday_morning: `Hi ${employeeName},\n\nYour weekly timesheet is due today by end of day. Please review and submit.\n\n- TimeKeeper`,
    friday_eod: `Hi ${employeeName},\n\nThis is your final reminder. Your timesheet must be submitted today. Please submit now to avoid delays in payroll processing.\n\n- TimeKeeper`,
  };

  return {
    subject: subjects[reminderType],
    text: bodies[reminderType],
  };
}
