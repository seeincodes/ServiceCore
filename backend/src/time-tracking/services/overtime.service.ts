import db from '../../shared/database/connection';
import _logger from '../../shared/utils/logger';
import { emitToOrg } from '../../shared/websocket/socket';

export interface OTConfig {
  otRules: 'federal' | 'california' | string;
  weeklyThreshold: number; // default 40
  dailyThreshold?: number; // California: 8h regular, 12h double
  dailyDoubleThreshold?: number; // California: >12h = double time
}

export interface OTResult {
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  totalHours: number;
  alerts: OTAlert[];
}

export interface OTAlert {
  type: 'approaching' | 'threshold' | 'exceeded';
  hours: number;
  message: string;
}

const DEFAULT_CONFIG: OTConfig = {
  otRules: 'federal',
  weeklyThreshold: 40,
};

/**
 * Get OT config for an org from the org's config JSONB.
 */
export async function getOrgOTConfig(orgId: string): Promise<OTConfig> {
  const org = await db('orgs').where({ id: orgId }).select('config').first();
  if (!org?.config) return DEFAULT_CONFIG;

  const config = typeof org.config === 'string' ? JSON.parse(org.config) : org.config;

  return {
    otRules: config.ot_rules || 'federal',
    weeklyThreshold: config.weekly_threshold || 40,
    dailyThreshold: config.daily_threshold || 8,
    dailyDoubleThreshold: config.daily_double_threshold || 12,
  };
}

/**
 * Calculate overtime for a user for a given week.
 */
export async function calculateOvertime(
  orgId: string,
  userId: string,
  weekEnding: Date,
): Promise<OTResult> {
  const config = await getOrgOTConfig(orgId);

  const weekStart = new Date(weekEnding);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekEnding);
  weekEnd.setHours(23, 59, 59, 999);

  const entries = await db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .where('clock_in', '>=', weekStart)
    .where('clock_in', '<=', weekEnd)
    .whereNotNull('clock_out')
    .orderBy('clock_in', 'asc');

  if (config.otRules === 'california') {
    return calculateCaliforniaOT(entries, config);
  }

  return calculateFederalOT(entries, config);
}

/**
 * Federal OT: >40h/week = overtime.
 */
function calculateFederalOT(entries: any[], config: OTConfig): OTResult {
  let totalHours = 0;
  for (const entry of entries) {
    totalHours +=
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
  }

  totalHours = round(totalHours);
  const overtimeHours =
    totalHours > config.weeklyThreshold ? round(totalHours - config.weeklyThreshold) : 0;
  const regularHours = round(totalHours - overtimeHours);

  return {
    regularHours,
    overtimeHours,
    doubleTimeHours: 0,
    totalHours,
    alerts: generateAlerts(totalHours, config.weeklyThreshold),
  };
}

/**
 * California OT:
 * - >8h/day = 1.5x overtime
 * - >12h/day = 2x double time
 * - >40h/week = 1.5x overtime (for remaining hours)
 * - 7th consecutive day: first 8h at 1.5x, >8h at 2x
 */
function calculateCaliforniaOT(entries: any[], config: OTConfig): OTResult {
  const dailyThreshold = config.dailyThreshold || 8;
  const doubleThreshold = config.dailyDoubleThreshold || 12;

  // Group entries by day
  const dailyHours = new Map<string, number>();

  for (const entry of entries) {
    const dayKey = new Date(entry.clock_in).toISOString().split('T')[0];
    const hours =
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
    dailyHours.set(dayKey, (dailyHours.get(dayKey) || 0) + hours);
  }

  let totalRegular = 0;
  let totalOT = 0;
  let totalDouble = 0;

  for (const [, hours] of dailyHours) {
    if (hours > doubleThreshold) {
      totalRegular += dailyThreshold;
      totalOT += doubleThreshold - dailyThreshold;
      totalDouble += hours - doubleThreshold;
    } else if (hours > dailyThreshold) {
      totalRegular += dailyThreshold;
      totalOT += hours - dailyThreshold;
    } else {
      totalRegular += hours;
    }
  }

  // Also check weekly threshold for any remaining regular hours
  const totalHours = round(totalRegular + totalOT + totalDouble);
  if (totalRegular > config.weeklyThreshold) {
    const weeklyOT = totalRegular - config.weeklyThreshold;
    totalRegular = config.weeklyThreshold;
    totalOT += weeklyOT;
  }

  return {
    regularHours: round(totalRegular),
    overtimeHours: round(totalOT),
    doubleTimeHours: round(totalDouble),
    totalHours,
    alerts: generateAlerts(totalHours, config.weeklyThreshold),
  };
}

/**
 * Check current week hours and emit OT alerts via WebSocket.
 */
export async function checkAndEmitOTAlerts(orgId: string, userId: string): Promise<void> {
  const weekEnding = getNextFriday();
  const result = await calculateOvertime(orgId, userId, weekEnding);

  for (const alert of result.alerts) {
    emitToOrg(orgId, 'ot_alert', {
      userId,
      hours: result.totalHours,
      alertType: alert.type,
      message: alert.message,
    });
  }
}

function generateAlerts(totalHours: number, threshold: number): OTAlert[] {
  const alerts: OTAlert[] = [];

  if (totalHours >= threshold + 5) {
    alerts.push({
      type: 'exceeded',
      hours: totalHours,
      message: `${round(totalHours)}h worked — ${round(totalHours - threshold)}h overtime`,
    });
  } else if (totalHours >= threshold) {
    alerts.push({
      type: 'threshold',
      hours: totalHours,
      message: `At overtime threshold: ${round(totalHours)}h`,
    });
  } else if (totalHours >= threshold - 2) {
    alerts.push({
      type: 'approaching',
      hours: totalHours,
      message: `Approaching overtime: ${round(totalHours)}h of ${threshold}h`,
    });
  }

  return alerts;
}

function getNextFriday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day <= 5 ? 5 - day : 5 - day + 7;
  const friday = new Date(d);
  friday.setDate(d.getDate() + diff);
  return friday;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
