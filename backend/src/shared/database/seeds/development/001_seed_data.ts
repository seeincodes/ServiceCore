import { Knex } from 'knex';
import bcrypt from 'bcrypt';

export async function seed(knex: Knex): Promise<void> {
  // Clean tables in reverse FK order
  await knex('audit_log').del();
  await knex('timesheet_approvals').del();
  await knex('timesheets').del();
  await knex('clock_entries').del();
  await knex('users').del();
  await knex('orgs').del();

  const passwordHash = await bcrypt.hash('password123', 10);

  // ============================================================
  // ORG 1: GreenWaste Solutions (Federal OT, 6 employees)
  // ============================================================
  const [org1] = await knex('orgs')
    .insert({
      name: 'GreenWaste Solutions',
      slug: 'greenwaste',
      branding: JSON.stringify({
        logo: '/assets/greenwaste-logo.png',
        primaryColor: '#2e7d32',
        secondaryColor: '#66bb6a',
      }),
      config: JSON.stringify({
        ot_rules: 'federal',
        work_week_start: 'monday',
        approval_required: true,
        sms_enabled: true,
        qb_enabled: false,
      }),
    })
    .returning('id');

  // ============================================================
  // ORG 2: Metro Disposal Co (California OT, 4 employees)
  // ============================================================
  const [org2] = await knex('orgs')
    .insert({
      name: 'Metro Disposal Co',
      slug: 'metro-disposal',
      branding: JSON.stringify({
        logo: '/assets/metro-logo.png',
        primaryColor: '#1565c0',
        secondaryColor: '#42a5f5',
      }),
      config: JSON.stringify({
        ot_rules: 'california',
        work_week_start: 'monday',
        approval_required: true,
        sms_enabled: true,
        qb_enabled: true,
      }),
    })
    .returning('id');

  // ============================================================
  // ORG 3: Sunrise Sanitation (small, free tier)
  // ============================================================
  const [org3] = await knex('orgs')
    .insert({
      name: 'Sunrise Sanitation',
      slug: 'sunrise',
      branding: JSON.stringify({
        logo: '/assets/sunrise-logo.png',
        primaryColor: '#e65100',
      }),
      config: JSON.stringify({
        ot_rules: 'federal',
        work_week_start: 'monday',
        approval_required: false,
        sms_enabled: false,
      }),
    })
    .returning('id');

  // ============================================================
  // USERS
  // ============================================================

  // Org 1 users
  const org1Users = await knex('users')
    .insert([
      {
        org_id: org1.id,
        email: 'admin@greenwaste.com',
        phone: '+15551000001',
        password_hash: passwordHash,
        first_name: 'Sarah',
        last_name: 'Chen',
        role: 'org_admin',
      },
      {
        org_id: org1.id,
        email: 'manager@greenwaste.com',
        phone: '+15551000002',
        password_hash: passwordHash,
        first_name: 'Mike',
        last_name: 'Rodriguez',
        role: 'manager',
      },
      {
        org_id: org1.id,
        email: 'payroll@greenwaste.com',
        phone: '+15551000003',
        password_hash: passwordHash,
        first_name: 'Lisa',
        last_name: 'Thompson',
        role: 'payroll_admin',
      },
      {
        org_id: org1.id,
        email: 'driver1@greenwaste.com',
        phone: '+15551000004',
        password_hash: passwordHash,
        first_name: 'John',
        last_name: 'Davis',
        role: 'employee',
      },
      {
        org_id: org1.id,
        email: 'driver2@greenwaste.com',
        phone: '+15551000005',
        password_hash: passwordHash,
        first_name: 'Jane',
        last_name: 'Wilson',
        role: 'employee',
      },
      {
        org_id: org1.id,
        email: 'driver3@greenwaste.com',
        phone: '+15551000006',
        password_hash: passwordHash,
        first_name: 'Bob',
        last_name: 'Martinez',
        role: 'employee',
      },
      {
        org_id: org1.id,
        email: 'driver4@greenwaste.com',
        phone: '+15551000007',
        password_hash: passwordHash,
        first_name: 'Alice',
        last_name: 'Johnson',
        role: 'employee',
      },
      {
        org_id: org1.id,
        email: 'driver5@greenwaste.com',
        phone: '+15551000008',
        password_hash: passwordHash,
        first_name: 'Tom',
        last_name: 'Brown',
        role: 'employee',
      },
      {
        org_id: org1.id,
        email: 'driver6@greenwaste.com',
        phone: '+15551000009',
        password_hash: passwordHash,
        first_name: 'Sam',
        last_name: 'Garcia',
        role: 'employee',
      },
    ])
    .returning(['id', 'role']);

  // Org 2 users
  const org2Users = await knex('users')
    .insert([
      {
        org_id: org2.id,
        email: 'admin@metrodisposal.com',
        phone: '+15552000001',
        password_hash: passwordHash,
        first_name: 'Tom',
        last_name: 'Nguyen',
        role: 'org_admin',
      },
      {
        org_id: org2.id,
        email: 'manager@metrodisposal.com',
        phone: '+15552000002',
        password_hash: passwordHash,
        first_name: 'Anna',
        last_name: 'Park',
        role: 'manager',
      },
      {
        org_id: org2.id,
        email: 'driver1@metrodisposal.com',
        phone: '+15552000003',
        password_hash: passwordHash,
        first_name: 'Carlos',
        last_name: 'Ruiz',
        role: 'employee',
      },
      {
        org_id: org2.id,
        email: 'driver2@metrodisposal.com',
        phone: '+15552000004',
        password_hash: passwordHash,
        first_name: 'Maria',
        last_name: 'Santos',
        role: 'employee',
      },
      {
        org_id: org2.id,
        email: 'driver3@metrodisposal.com',
        phone: '+15552000005',
        password_hash: passwordHash,
        first_name: 'Diego',
        last_name: 'Flores',
        role: 'employee',
      },
    ])
    .returning(['id', 'role']);

  // Org 3 users (small)
  const org3Users = await knex('users')
    .insert([
      {
        org_id: org3.id,
        email: 'owner@sunrise.com',
        phone: '+15553000001',
        password_hash: passwordHash,
        first_name: 'Ray',
        last_name: 'Harper',
        role: 'org_admin',
      },
      {
        org_id: org3.id,
        email: 'driver1@sunrise.com',
        phone: '+15553000002',
        password_hash: passwordHash,
        first_name: 'Eddie',
        last_name: 'Kim',
        role: 'employee',
      },
      {
        org_id: org3.id,
        email: 'driver2@sunrise.com',
        phone: '+15553000003',
        password_hash: passwordHash,
        first_name: 'Pat',
        last_name: "O'Brien",
        role: 'employee',
      },
    ])
    .returning(['id', 'role']);

  // ============================================================
  // PROJECTS (must be before clock entries for project_id FK)
  // ============================================================
  await knex('projects').del();
  const org1Projects = await knex('projects')
    .insert([
      { org_id: org1.id, code: 'RES-PICKUP', name: 'Residential Pickup', color: '#2e7d32' },
      { org_id: org1.id, code: 'COM-PICKUP', name: 'Commercial Pickup', color: '#1565c0' },
      { org_id: org1.id, code: 'RECYCLING', name: 'Recycling Collection', color: '#00897b' },
      { org_id: org1.id, code: 'BULK-WASTE', name: 'Bulk Waste Removal', color: '#6a1b9a' },
      { org_id: org1.id, code: 'YARD-WORK', name: 'Yard Maintenance', color: '#ef6c00' },
    ])
    .returning(['id', 'code']);
  const org1ProjectMap = new Map(org1Projects.map((p) => [p.code, p.id]));

  await knex('projects').insert([
    { org_id: org2.id, code: 'RES-PICKUP', name: 'Residential Pickup', color: '#2e7d32' },
    { org_id: org2.id, code: 'COM-PICKUP', name: 'Commercial Pickup', color: '#1565c0' },
    { org_id: org2.id, code: 'HAZ-WASTE', name: 'Hazardous Waste', color: '#c62828' },
    { org_id: org3.id, code: 'GENERAL', name: 'General Pickup', color: '#2e7d32' },
  ]);

  // ============================================================
  // CLOCK ENTRIES — Last 2 weeks of realistic data
  // ============================================================
  const now = new Date();
  const org1Drivers = org1Users.filter((u) => u.role === 'employee');
  const org2Drivers = org2Users.filter((u) => u.role === 'employee');
  const org3Drivers = org3Users.filter((u) => u.role === 'employee');

  const routes = ['RES-01', 'RES-02', 'COM-01', 'COM-02', 'RCY-01', 'BLK-01', 'YRD-01'];
  const org1ProjectCodes = ['RES-PICKUP', 'COM-PICKUP', 'RECYCLING', 'BULK-WASTE', 'YARD-WORK'];

  // Generate 2 weeks of clock entries for each driver
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const dayOfWeek = day.getDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Org 1 drivers
    for (const driver of org1Drivers) {
      const startHour = 6 + Math.floor(Math.random() * 2); // 6-7am
      const workHours = 7.5 + Math.random() * 2.5; // 7.5-10h
      const routeId = routes[Math.floor(Math.random() * routes.length)];

      const clockIn = new Date(day);
      clockIn.setHours(startHour, Math.floor(Math.random() * 30), 0, 0);

      const clockOut = new Date(clockIn);
      clockOut.setTime(clockIn.getTime() + workHours * 60 * 60 * 1000);

      const projectCode = org1ProjectCodes[Math.floor(Math.random() * org1ProjectCodes.length)];
      const projectId = org1ProjectMap.get(projectCode);

      await knex('clock_entries').insert({
        org_id: org1.id,
        user_id: driver.id,
        clock_in: clockIn,
        clock_out: clockOut,
        route_id: routeId,
        project_id: projectId,
        location_lat: 37.7749 + (Math.random() - 0.5) * 0.1,
        location_lon: -122.4194 + (Math.random() - 0.5) * 0.1,
        source: Math.random() > 0.8 ? 'sms' : 'app',
        synced_at: clockIn,
      });
    }

    // Org 2 drivers (California — some with >8h days)
    for (const driver of org2Drivers) {
      const startHour = 5 + Math.floor(Math.random() * 2); // 5-6am
      const workHours = 8 + Math.random() * 4; // 8-12h (CA OT territory)
      const routeId = routes[Math.floor(Math.random() * routes.length)];

      const clockIn = new Date(day);
      clockIn.setHours(startHour, Math.floor(Math.random() * 30), 0, 0);

      const clockOut = new Date(clockIn);
      clockOut.setTime(clockIn.getTime() + workHours * 60 * 60 * 1000);

      await knex('clock_entries').insert({
        org_id: org2.id,
        user_id: driver.id,
        clock_in: clockIn,
        clock_out: clockOut,
        route_id: routeId,
        source: 'app',
        synced_at: clockIn,
      });
    }

    // Org 3 drivers (small shop, shorter days)
    for (const driver of org3Drivers) {
      const startHour = 7;
      const workHours = 6 + Math.random() * 2;

      const clockIn = new Date(day);
      clockIn.setHours(startHour, 0, 0, 0);

      const clockOut = new Date(clockIn);
      clockOut.setTime(clockIn.getTime() + workHours * 60 * 60 * 1000);

      await knex('clock_entries').insert({
        org_id: org3.id,
        user_id: driver.id,
        clock_in: clockIn,
        clock_out: clockOut,
        route_id: 'R1',
        source: 'app',
        synced_at: clockIn,
      });
    }
  }

  // ============================================================
  // TIMESHEETS — Last week (submitted + some approved)
  // ============================================================
  const lastFriday = new Date(now);
  lastFriday.setDate(lastFriday.getDate() - ((now.getDay() + 2) % 7)); // Previous Friday
  const weekEnding = lastFriday.toISOString().split('T')[0];

  const org1Manager = org1Users.find((u) => u.role === 'manager')!;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const org2Manager = org2Users.find((u) => u.role === 'manager')!;

  // Org 1 timesheets
  for (let i = 0; i < org1Drivers.length; i++) {
    const hours = 38 + Math.random() * 8; // 38-46h
    const otHours = hours > 40 ? Math.round((hours - 40) * 100) / 100 : 0;
    const status = i < 3 ? 'approved' : i < 5 ? 'submitted' : 'draft';

    const [ts] = await knex('timesheets')
      .insert({
        org_id: org1.id,
        user_id: org1Drivers[i].id,
        week_ending: weekEnding,
        status,
        hours_worked: Math.round(hours * 100) / 100,
        ot_hours: otHours,
      })
      .returning('id');

    // Add approval record for approved timesheets
    if (status === 'approved') {
      await knex('timesheet_approvals').insert({
        org_id: org1.id,
        timesheet_id: ts.id,
        manager_id: org1Manager.id,
        status: 'approved',
        notes: 'Looks good',
      });
    }
  }

  // Org 2 timesheets (all submitted, pending approval)
  for (const driver of org2Drivers) {
    const hours = 40 + Math.random() * 10; // 40-50h (CA OT)
    await knex('timesheets').insert({
      org_id: org2.id,
      user_id: driver.id,
      week_ending: weekEnding,
      status: 'submitted',
      hours_worked: Math.round(hours * 100) / 100,
      ot_hours: Math.round((hours - 40) * 100) / 100,
    });
  }

  // ============================================================
  // AUDIT LOG — sample entries
  // ============================================================
  await knex('audit_log').insert([
    {
      org_id: org1.id,
      user_id: org1Manager.id,
      action: 'timesheet_approved:success',
      entity_type: 'timesheet',
      details: JSON.stringify({ notes: 'Looks good' }),
    },
    {
      org_id: org1.id,
      user_id: org1Users.find((u) => u.role === 'org_admin')!.id,
      action: 'user_created:success',
      entity_type: 'user',
      details: JSON.stringify({ email: 'driver6@greenwaste.com' }),
    },
    {
      org_id: org2.id,
      user_id: org2Users.find((u) => u.role === 'org_admin')!.id,
      action: 'branding_updated:success',
      entity_type: 'org',
      details: JSON.stringify({ field: 'primaryColor' }),
    },
  ]);
}
