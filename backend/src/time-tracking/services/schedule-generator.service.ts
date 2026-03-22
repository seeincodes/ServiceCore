import db from '../../shared/database/connection';
import logger from '../../shared/utils/logger';

/**
 * Generates schedules for the upcoming week by copying the previous week's
 * schedules forward. Skips any org+user+date combos that already exist.
 * Runs automatically Sunday night and on startup if the current week is empty.
 */
export async function generateWeeklySchedules(): Promise<void> {
  try {
    const orgs = await db('orgs').select('id');

    for (const org of orgs) {
      await generateForOrg(org.id);
    }
  } catch (err) {
    logger.error('Schedule generation failed', { error: err });
  }
}

/**
 * Ensures the current week has schedules. If not, copies from last week.
 * Called on server startup.
 */
export async function ensureCurrentWeekSchedules(): Promise<void> {
  try {
    const orgs = await db('orgs').select('id');

    for (const org of orgs) {
      const { weekStart, weekEnd } = getCurrentWeekRange();

      const count = await db('schedules')
        .where({ org_id: org.id })
        .where('date', '>=', weekStart)
        .where('date', '<=', weekEnd)
        .count('id as count')
        .first();

      if (Number(count?.count) === 0) {
        logger.info(`No schedules for current week in org ${org.id}, generating from last week`);
        await copyWeekForward(org.id, getPreviousWeekRange(), { weekStart, weekEnd });
      }
    }
  } catch (err) {
    logger.error('Startup schedule check failed', { error: err });
  }
}

async function generateForOrg(orgId: string): Promise<void> {
  const source = getCurrentWeekRange();
  const target = getNextWeekRange();

  // Check if target week already has schedules
  const existing = await db('schedules')
    .where({ org_id: orgId })
    .where('date', '>=', target.weekStart)
    .where('date', '<=', target.weekEnd)
    .count('id as count')
    .first();

  if (Number(existing?.count) > 0) {
    logger.info(`Org ${orgId} already has schedules for next week, skipping`);
    return;
  }

  await copyWeekForward(orgId, source, target);
}

async function copyWeekForward(
  orgId: string,
  source: { weekStart: string; weekEnd: string },
  target: { weekStart: string; weekEnd: string },
): Promise<void> {
  const sourceSchedules = await db('schedules')
    .where({ org_id: orgId })
    .where('date', '>=', source.weekStart)
    .where('date', '<=', source.weekEnd)
    .select(
      'user_id',
      'date',
      'project_id',
      'route_id',
      'shift_start',
      'shift_end',
      'template_id',
      'notes',
    );

  if (sourceSchedules.length === 0) {
    logger.info(`No source schedules for org ${orgId} in ${source.weekStart}–${source.weekEnd}`);
    return;
  }

  const sourceMonday = new Date(source.weekStart);
  const targetMonday = new Date(target.weekStart);

  const inserts = sourceSchedules.map((s: any) => {
    const sourceDate = new Date(typeof s.date === 'string' ? s.date.split('T')[0] : s.date);
    const dayOffset = Math.round(
      (sourceDate.getTime() - sourceMonday.getTime()) / (1000 * 60 * 60 * 24),
    );
    const targetDate = new Date(targetMonday);
    targetDate.setDate(targetMonday.getDate() + dayOffset);

    return {
      org_id: orgId,
      user_id: s.user_id,
      date: targetDate.toISOString().split('T')[0],
      project_id: s.project_id,
      route_id: s.route_id,
      shift_start: s.shift_start,
      shift_end: s.shift_end,
      template_id: s.template_id,
      notes: s.notes,
    };
  });

  // Insert in batches, skip conflicts (unique on org_id, user_id, date)
  for (const insert of inserts) {
    try {
      await db('schedules').insert(insert).onConflict(['org_id', 'user_id', 'date']).ignore();
    } catch {
      // Skip individual insert failures
    }
  }

  logger.info(
    `Generated ${inserts.length} schedule entries for org ${orgId} (${target.weekStart}–${target.weekEnd})`,
  );
}

function getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0],
  };
}

function getPreviousWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);
  const prevMonday = new Date(thisMonday);
  prevMonday.setDate(thisMonday.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);
  return {
    weekStart: prevMonday.toISOString().split('T')[0],
    weekEnd: prevSunday.toISOString().split('T')[0],
  };
}

function getNextWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(thisMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  return {
    weekStart: nextMonday.toISOString().split('T')[0],
    weekEnd: nextSunday.toISOString().split('T')[0],
  };
}
