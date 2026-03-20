import { Router, Request, Response } from 'express';
import db from '../../shared/database/connection';
import * as clockService from '../services/clock.service';
import { sendSms } from '../../notifications/services/sms.service';
import logger from '../../shared/utils/logger';

const router = Router();

// POST /sms/webhook — Twilio incoming SMS webhook
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { Body, From } = req.body;
    const messageBody = (Body || '').trim().toUpperCase();
    const phoneNumber = normalizePhone(From);

    logger.info('SMS received', { from: phoneNumber, body: messageBody });

    // Map phone number to user
    const user = await db('users').where({ phone: phoneNumber, is_active: true }).first();

    if (!user) {
      // Unknown number — respond gracefully
      await sendSms(
        From,
        'This number is not registered with TimeKeeper. Please contact your administrator.',
      );
      res.type('text/xml').send('<Response></Response>');
      return;
    }

    if (messageBody === 'IN') {
      try {
        const result = await clockService.clockIn({
          orgId: user.org_id,
          userId: user.id,
          source: 'sms',
        });

        const time = new Date(result.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const route = result.routeId ? ` Route #${result.routeId}` : '';
        await sendSms(From, `Clocked in at ${time}.${route}`);
      } catch (err) {
        await sendSms(From, (err as Error).message);
      }
    } else if (messageBody === 'OUT') {
      try {
        const result = await clockService.clockOut(user.org_id, user.id);

        const time = new Date(result.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        await sendSms(From, `Clocked out at ${time}. Total: ${result.hoursWorked}h`);
      } catch (err) {
        await sendSms(From, (err as Error).message);
      }
    } else if (messageBody === 'STATUS') {
      const entry = await clockService.getActiveEntry(user.org_id, user.id);
      if (entry) {
        const elapsed = (Date.now() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
        const hours = Math.floor(elapsed);
        const minutes = Math.floor((elapsed - hours) * 60);
        const route = entry.route_id ? ` on Route #${entry.route_id}` : '';
        await sendSms(From, `Clocked in for ${hours}h ${minutes}m${route}.`);
      } else {
        await sendSms(From, 'You are not currently clocked in.');
      }
    } else {
      await sendSms(
        From,
        'TimeKeeper: Text IN to clock in, OUT to clock out, or STATUS to check your hours.',
      );
    }

    // Respond with empty TwiML
    res.type('text/xml').send('<Response></Response>');
  } catch (err) {
    logger.error('SMS webhook error', { error: (err as Error).message });
    res.type('text/xml').send('<Response></Response>');
  }
});

function normalizePhone(phone: string): string {
  // Ensure +1 prefix for US numbers
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export default router;
