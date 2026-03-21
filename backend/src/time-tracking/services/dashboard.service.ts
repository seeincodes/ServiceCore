import db from '../../shared/database/connection';

export interface DriverStatus {
  id: string;
  name: string;
  status: 'clocked_in' | 'clocked_out';
  hours: number;
  route: string | null;
  lastUpdate: string;
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
      lastUpdate: lastUpdate || '',
    });
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
}

/**
 * Get time allocation breakdown by project/route for the current week.
 */
export async function getProjectAllocation(orgId: string): Promise<ProjectAllocation[]> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);

  const entries = await db('clock_entries')
    .where({ org_id: orgId })
    .where('clock_in', '>=', weekStart)
    .whereNotNull('clock_out')
    .select('route_id', 'project_id', 'user_id', 'clock_in', 'clock_out');

  const projectMap = new Map<string, { hours: number; drivers: Set<string> }>();
  let totalHours = 0;

  for (const entry of entries) {
    const hours =
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);
    const key = entry.project_id || entry.route_id || 'Unassigned';

    const existing = projectMap.get(key);
    if (existing) {
      existing.hours += hours;
      existing.drivers.add(entry.user_id);
    } else {
      projectMap.set(key, { hours, drivers: new Set([entry.user_id]) });
    }
    totalHours += hours;
  }

  return Array.from(projectMap.entries())
    .map(([project, data]) => ({
      project,
      hours: Math.round(data.hours * 10) / 10,
      percentage: totalHours > 0 ? Math.round((data.hours / totalHours) * 100) : 0,
      driverCount: data.drivers.size,
    }))
    .sort((a, b) => b.hours - a.hours);
}
