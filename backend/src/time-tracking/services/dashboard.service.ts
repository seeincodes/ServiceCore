import db from '../../shared/database/connection';

export interface ScheduleDay {
  date: string;
  dayLabel: string;
  projectId: string | null;
  projectName: string | null;
  routeId: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
}

export interface DriverStatus {
  id: string;
  name: string;
  status: 'clocked_in' | 'clocked_out';
  hours: number;
  route: string | null;
  projectId: string | null;
  projectName: string | null;
  lastUpdate: string;
  scheduledProjectId?: string | null;
  scheduledProjectName?: string | null;
  scheduledRouteId?: string | null;
  scheduledShiftStart?: string | null;
  scheduledShiftEnd?: string | null;
  weekSchedule?: ScheduleDay[];
}

export interface DriverDayDetail {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
  routeId: string | null;
  projectId: string | null;
  source: string;
}

export async function getDashboard(orgId: string): Promise<DriverStatus[]> {
  // Get all employees in the org
  const employees = await db('users')
    .where({ org_id: orgId, role: 'employee', is_active: true })
    .select('id', 'first_name', 'last_name');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const drivers: DriverStatus[] = [];

  for (const emp of employees) {
    // Check for open clock entry
    const openEntry = await db('clock_entries')
      .where({ org_id: orgId, user_id: emp.id })
      .whereNull('clock_out')
      .orderBy('clock_in', 'desc')
      .first();

    // Get today's total hours from completed entries
    const completedEntries = await db('clock_entries')
      .where({ org_id: orgId, user_id: emp.id })
      .where('clock_in', '>=', today)
      .whereNotNull('clock_out');

    let totalHours = 0;
    let lastUpdate = '';

    for (const entry of completedEntries) {
      totalHours +=
        (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) /
        (1000 * 60 * 60);
      if (!lastUpdate || new Date(entry.clock_out) > new Date(lastUpdate)) {
        lastUpdate = entry.clock_out;
      }
    }

    if (openEntry) {
      const elapsed = (Date.now() - new Date(openEntry.clock_in).getTime()) / (1000 * 60 * 60);
      totalHours += elapsed;
      lastUpdate = openEntry.clock_in;
    }

    drivers.push({
      id: emp.id,
      name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
      status: openEntry ? 'clocked_in' : 'clocked_out',
      hours: Math.round(totalHours * 100) / 100,
      route: openEntry?.route_id || null,
      projectId: openEntry?.project_id || null,
      projectName: null,
      lastUpdate: lastUpdate || '',
    });
  }

  // Look up this week's schedule (Mon–Sun) for all employees
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weekSchedules = await db('schedules')
    .where({ org_id: orgId })
    .where('date', '>=', weekStartStr)
    .where('date', '<=', weekEndStr)
    .select('user_id', 'project_id', 'route_id', 'shift_start', 'shift_end', 'date')
    .orderBy('date');

  // Group schedules by user
  const schedulesByUser = new Map<string, any[]>();
  for (const sched of weekSchedules) {
    const list = schedulesByUser.get(sched.user_id) || [];
    list.push(sched);
    schedulesByUser.set(sched.user_id, list);
  }

  for (const driver of drivers) {
    const scheds = schedulesByUser.get(driver.id) || [];

    // Set today's schedule on the legacy fields for backward compat
    const todaySched = scheds.find((s: any) => String(s.date).startsWith(todayStr));
    if (todaySched) {
      driver.scheduledProjectId = todaySched.project_id;
      driver.scheduledRouteId = todaySched.route_id;
      driver.scheduledShiftStart = todaySched.shift_start
        ? String(todaySched.shift_start).slice(0, 5)
        : null;
      driver.scheduledShiftEnd = todaySched.shift_end
        ? String(todaySched.shift_end).slice(0, 5)
        : null;
    }

    // Full week schedule
    driver.weekSchedule = scheds.map((s: any) => {
      const d = new Date(s.date);
      return {
        date: String(s.date).split('T')[0],
        dayLabel: d.toISOString().split('T')[0] === todayStr ? 'Today' : dayNames[d.getDay()],
        projectId: s.project_id,
        projectName: null,
        routeId: s.route_id,
        shiftStart: s.shift_start ? String(s.shift_start).slice(0, 5) : null,
        shiftEnd: s.shift_end ? String(s.shift_end).slice(0, 5) : null,
      };
    });
  }

  // Resolve project names (active, scheduled, and week schedule)
  const allProjectIds = [
    ...new Set([
      ...drivers.map((d) => d.projectId).filter(Boolean),
      ...drivers.map((d) => d.scheduledProjectId).filter(Boolean),
      ...drivers.flatMap((d) => (d.weekSchedule || []).map((s) => s.projectId)).filter(Boolean),
    ]),
  ] as string[];
  if (allProjectIds.length > 0) {
    const projects = await db('projects').whereIn('id', allProjectIds).select('id', 'name', 'code');
    const projectMap = new Map(projects.map((p: any) => [p.id, `${p.code} — ${p.name}`]));
    for (const driver of drivers) {
      if (driver.projectId) {
        driver.projectName = projectMap.get(driver.projectId) || null;
      }
      if (driver.scheduledProjectId) {
        driver.scheduledProjectName = projectMap.get(driver.scheduledProjectId) || null;
      }
      for (const sched of driver.weekSchedule || []) {
        if (sched.projectId) {
          sched.projectName = projectMap.get(sched.projectId) || null;
        }
      }
    }
  }

  return drivers;
}

export async function getDriverDayDetail(
  orgId: string,
  userId: string,
  date?: Date,
): Promise<DriverDayDetail[]> {
  const day = date || new Date();
  const startOfDay = new Date(day);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const entries = await db('clock_entries')
    .where({ org_id: orgId, user_id: userId })
    .where('clock_in', '>=', startOfDay)
    .where('clock_in', '<', endOfDay)
    .orderBy('clock_in', 'asc');

  return entries.map((entry: any) => {
    const hours = entry.clock_out
      ? (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) /
        (1000 * 60 * 60)
      : null;

    return {
      id: entry.id,
      clockIn: entry.clock_in,
      clockOut: entry.clock_out,
      hours: hours !== null ? Math.round(hours * 100) / 100 : null,
      routeId: entry.route_id,
      projectId: entry.project_id,
      source: entry.source,
    };
  });
}

export interface ProjectAllocation {
  project: string;
  hours: number;
  percentage: number;
  driverCount: number;
  cost: number;
}

/**
 * Get time allocation breakdown by project/route for the current week.
 * Includes labor cost based on each driver's hourly rate.
 */
export async function getProjectAllocation(orgId: string): Promise<ProjectAllocation[]> {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  weekStart.setDate(now.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);

  const entries = await db('clock_entries')
    .where({ org_id: orgId })
    .where('clock_in', '>=', weekStart)
    .whereNotNull('clock_out')
    .select('route_id', 'project_id', 'user_id', 'clock_in', 'clock_out');

  // Load hourly rates for cost calculation
  const userIds = [...new Set(entries.map((e: any) => e.user_id))];
  const users =
    userIds.length > 0 ? await db('users').whereIn('id', userIds).select('id', 'hourly_rate') : [];
  const rateMap = new Map(users.map((u: any) => [u.id, Number(u.hourly_rate) || 0]));

  const projectMap = new Map<string, { hours: number; cost: number; drivers: Set<string> }>();
  let totalHours = 0;

  for (const entry of entries) {
    const hours =
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
    const key = entry.project_id || entry.route_id || 'Unassigned';
    const rate = rateMap.get(entry.user_id) || 0;
    const cost = hours * rate;

    const existing = projectMap.get(key);
    if (existing) {
      existing.hours += hours;
      existing.cost += cost;
      existing.drivers.add(entry.user_id);
    } else {
      projectMap.set(key, { hours, cost, drivers: new Set([entry.user_id]) });
    }
    totalHours += hours;
  }

  // Resolve project IDs to names
  const projectIds = [...projectMap.keys()].filter((k) => k !== 'Unassigned');
  const projectRecords =
    projectIds.length > 0
      ? await db('projects')
          .whereIn('id', projectIds)
          .select('id', 'name', 'code', 'color', 'budgeted_hours', 'budget_amount')
      : [];
  const projectNameMap = new Map(projectRecords.map((p) => [p.id, p]));

  return Array.from(projectMap.entries())
    .map(([projectId, data]) => {
      const proj = projectNameMap.get(projectId);
      return {
        projectId: projectId !== 'Unassigned' ? projectId : null,
        project: proj ? `${proj.code} — ${proj.name}` : projectId,
        projectCode: proj?.code || null,
        color: proj?.color || null,
        hours: Math.round(data.hours * 10) / 10,
        percentage: totalHours > 0 ? Math.round((data.hours / totalHours) * 100) : 0,
        driverCount: data.drivers.size,
        cost: Math.round(data.cost * 100) / 100,
        budgetedHours: proj?.budgeted_hours ? Number(proj.budgeted_hours) : null,
        budgetAmount: proj?.budget_amount ? Number(proj.budget_amount) : null,
      };
    })
    .sort((a, b) => b.hours - a.hours);
}
