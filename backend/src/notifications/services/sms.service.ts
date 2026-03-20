import twilio from 'twilio';
import logger from '../../shared/utils/logger';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!client) {
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }
    client = twilio(accountSid, authToken);
  }
  return client;
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (!fromNumber) {
    logger.warn('TWILIO_PHONE_NUMBER not set, skipping SMS', { to });
    return;
  }

  try {
    await getClient().messages.create({
      body,
      from: fromNumber,
      to,
    });
    logger.info('SMS sent', { to, bodyLength: body.length });
  } catch (err) {
    logger.error('SMS send failed', { to, error: (err as Error).message });
    throw err;
  }
}
