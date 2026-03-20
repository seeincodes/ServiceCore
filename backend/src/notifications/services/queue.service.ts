import AWS from 'aws-sdk';
import logger from '../../shared/utils/logger';

const sqs = new AWS.SQS({
  region: process.env.AWS_REGION || 'us-east-1',
});

const NOTIFICATION_QUEUE_URL = process.env.SQS_NOTIFICATION_QUEUE_URL;

export interface NotificationMessage {
  type: 'email' | 'sms';
  to: string;
  subject?: string;
  body: string;
  html?: string;
  attempt?: number;
  maxAttempts?: number;
}

export async function enqueueNotification(message: NotificationMessage): Promise<void> {
  if (!NOTIFICATION_QUEUE_URL) {
    logger.warn('SQS_NOTIFICATION_QUEUE_URL not set, processing inline', {
      type: message.type,
      to: message.to,
    });
    // Process inline when SQS is not configured (local dev)
    await processNotificationInline(message);
    return;
  }

  const msg = {
    ...message,
    attempt: message.attempt || 1,
    maxAttempts: message.maxAttempts || 3,
  };

  try {
    await sqs
      .sendMessage({
        QueueUrl: NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify(msg),
        MessageGroupId: message.type,
        MessageDeduplicationId: `${message.type}-${message.to}-${Date.now()}`,
      })
      .promise();
    logger.info('Notification enqueued', { type: message.type, to: message.to });
  } catch (err) {
    logger.error('Failed to enqueue notification', { error: (err as Error).message });
    // Fall back to inline processing
    await processNotificationInline(message);
  }
}

export async function processNotification(message: NotificationMessage): Promise<void> {
  const attempt = message.attempt || 1;
  const maxAttempts = message.maxAttempts || 3;

  try {
    if (message.type === 'email') {
      const { sendEmail } = await import('./email.service');
      await sendEmail({
        to: message.to,
        subject: message.subject || 'TimeKeeper Notification',
        text: message.body,
        html: message.html,
      });
    } else if (message.type === 'sms') {
      const { sendSms } = await import('./sms.service');
      await sendSms(message.to, message.body);
    }
  } catch (err) {
    if (attempt < maxAttempts) {
      const delay = getBackoffDelay(attempt);
      logger.warn(
        `Notification failed, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`,
        {
          type: message.type,
          to: message.to,
        },
      );
      await sleep(delay);
      await processNotification({ ...message, attempt: attempt + 1 });
    } else {
      logger.error(`Notification failed after ${maxAttempts} attempts`, {
        type: message.type,
        to: message.to,
        error: (err as Error).message,
      });
      throw err;
    }
  }
}

async function processNotificationInline(message: NotificationMessage): Promise<void> {
  await processNotification(message);
}

function getBackoffDelay(attempt: number): number {
  // Exponential backoff: 1s, 4s, 9s
  return attempt * attempt * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
