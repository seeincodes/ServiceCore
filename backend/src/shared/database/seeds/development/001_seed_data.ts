import { Knex } from 'knex';
import bcrypt from 'bcrypt';

export async function seed(knex: Knex): Promise<void> {
  // Clean tables in reverse FK order (safe deletes for tables that may not exist yet)
  const safeDelete = async (table: string) => {
    const exists = await knex.schema.hasTable(table);
    if (exists) await knex(table).del();
  };

  await knex('audit_log').del();
  await safeDelete('notifications');
  await safeDelete('schedules');
  await safeDelete('shift_templates');
  await knex('time_off_requests').del();
  await knex('time_off_balances').del();
  await knex('timesheet_approvals').del();
  await knex('timesheets').del();
  await knex('clock_entries').del();
  await knex('projects').del();
  await knex('work_zones').del();
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
        hourly_rate: 22.5,
        ot_multiplier: 1.5,
      },
      {
        org_id: org1.id,
        email: 'driver2@greenwaste.com',
        phone: '+15551000005',
        password_hash: passwordHash,
        first_name: 'Jane',
        last_name: 'Wilson',
        role: 'employee',
        hourly_rate: 24.0,
        ot_multiplier: 1.5,
      },
      {
        org_id: org1.id,
        email: 'driver3@greenwaste.com',
        phone: '+15551000006',
        password_hash: passwordHash,
        first_name: 'Bob',
        last_name: 'Martinez',
        role: 'employee',
        hourly_rate: 21.0,
        ot_multiplier: 1.5,
      },
      {
        org_id: org1.id,
        email: 'driver4@greenwaste.com',
        phone: '+15551000007',
        password_hash: passwordHash,
        first_name: 'Alice',
        last_name: 'Johnson',
        role: 'employee',
        hourly_rate: 23.0,
        ot_multiplier: 1.5,
      },
      {
        org_id: org1.id,
        email: 'driver5@greenwaste.com',
        phone: '+15551000008',
        password_hash: passwordHash,
        first_name: 'Tom',
        last_name: 'Brown',
        role: 'employee',
        hourly_rate: 20.0,
        ot_multiplier: 1.5,
      },
      {
        org_id: org1.id,
        email: 'driver6@greenwaste.com',
        phone: '+15551000009',
        password_hash: passwordHash,
        first_name: 'Sam',
        last_name: 'Garcia',
        role: 'employee',
        hourly_rate: 25.0,
        ot_multiplier: 1.5,
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
        hourly_rate: 26.0,
        ot_multiplier: 1.5,
      },
      {
        org_id: org2.id,
        email: 'driver2@metrodisposal.com',
        phone: '+15552000004',
        password_hash: passwordHash,
        first_name: 'Maria',
        last_name: 'Santos',
        role: 'employee',
        hourly_rate: 27.5,
        ot_multiplier: 1.5,
      },
      {
        org_id: org2.id,
        email: 'driver3@metrodisposal.com',
        phone: '+15552000005',
        password_hash: passwordHash,
        first_name: 'Diego',
        last_name: 'Flores',
        role: 'employee',
        hourly_rate: 24.0,
        ot_multiplier: 1.5,
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
  const org1Projects = await knex('projects')
    .insert([
      {
        org_id: org1.id,
        code: 'RES-PICKUP',
        name: 'Residential Pickup',
        color: '#2e7d32',
        budgeted_hours: 120,
        budget_amount: 2800,
      },
      {
        org_id: org1.id,
        code: 'COM-PICKUP',
        name: 'Commercial Pickup',
        color: '#1565c0',
        budgeted_hours: 80,
        budget_amount: 2000,
      },
      {
        org_id: org1.id,
        code: 'RECYCLING',
        name: 'Recycling Collection',
        color: '#00897b',
        budgeted_hours: 60,
        budget_amount: 1400,
      },
      {
        org_id: org1.id,
        code: 'BULK-WASTE',
        name: 'Bulk Waste Removal',
        color: '#6a1b9a',
        budgeted_hours: 40,
        budget_amount: 1000,
      },
      {
        org_id: org1.id,
        code: 'YARD-WORK',
        name: 'Yard Maintenance',
        color: '#ef6c00',
        budgeted_hours: 30,
        budget_amount: 700,
      },
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
  // CLOCK ENTRIES — Last 6 weeks of realistic data
  // ============================================================
  const now = new Date();
  const org1Drivers = org1Users.filter((u) => u.role === 'employee');
  const org2Drivers = org2Users.filter((u) => u.role === 'employee');
  const org3Drivers = org3Users.filter((u) => u.role === 'employee');

  const routes = ['RES-01', 'RES-02', 'COM-01', 'COM-02', 'RCY-01', 'BLK-01', 'YRD-01'];
  const org1ProjectCodes = ['RES-PICKUP', 'COM-PICKUP', 'RECYCLING', 'BULK-WASTE', 'YARD-WORK'];
  const sources: ('app' | 'sms')[] = ['app', 'app', 'app', 'app', 'sms'];

  // Generate 6 weeks of clock entries for each driver
  for (let dayOffset = 41; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const dayOfWeek = day.getDay();

    // Drivers can work any day of the week
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Org 1 drivers — all 7 days, lighter weekend crews
    {
      for (let dIdx = 0; dIdx < org1Drivers.length; dIdx++) {
        const driver = org1Drivers[dIdx];

        // On weekends, only 4 of 6 drivers work
        if (isWeekend && dIdx >= 4) continue;

        // 10% chance a driver is absent (except first 2 drivers who are always present)
        if (dIdx >= 2 && Math.random() < 0.1) continue;

        const startHour = 5 + Math.floor(Math.random() * 3); // 5-7am
        const startMin = Math.floor(Math.random() * 45);

        // Some drivers do split shifts (break in the middle)
        const doSplitShift = Math.random() < 0.25;

        if (doSplitShift) {
          // Morning shift
          const morningHours = 3.5 + Math.random() * 1.5; // 3.5-5h
          const clockIn1 = new Date(day);
          clockIn1.setHours(startHour, startMin, 0, 0);
          const clockOut1 = new Date(clockIn1);
          clockOut1.setTime(clockIn1.getTime() + morningHours * 3600000);

          const projectCode1 =
            org1ProjectCodes[Math.floor(Math.random() * org1ProjectCodes.length)];
          await knex('clock_entries').insert({
            org_id: org1.id,
            user_id: driver.id,
            clock_in: clockIn1,
            clock_out: clockOut1,
            route_id: routes[Math.floor(Math.random() * routes.length)],
            project_id: org1ProjectMap.get(projectCode1),
            location_lat: 37.7749 + (Math.random() - 0.5) * 0.1,
            location_lon: -122.4194 + (Math.random() - 0.5) * 0.1,
            source: sources[Math.floor(Math.random() * sources.length)],
            synced_at: clockIn1,
          });

          // Afternoon shift (30-60 min break)
          const breakMin = 30 + Math.floor(Math.random() * 30);
          const clockIn2 = new Date(clockOut1);
          clockIn2.setTime(clockOut1.getTime() + breakMin * 60000);
          const afternoonHours = 3 + Math.random() * 2; // 3-5h
          const clockOut2 = new Date(clockIn2);
          clockOut2.setTime(clockIn2.getTime() + afternoonHours * 3600000);

          const projectCode2 =
            org1ProjectCodes[Math.floor(Math.random() * org1ProjectCodes.length)];
          await knex('clock_entries').insert({
            org_id: org1.id,
            user_id: driver.id,
            clock_in: clockIn2,
            clock_out: clockOut2,
            route_id: routes[Math.floor(Math.random() * routes.length)],
            project_id: org1ProjectMap.get(projectCode2),
            location_lat: 37.7749 + (Math.random() - 0.5) * 0.1,
            location_lon: -122.4194 + (Math.random() - 0.5) * 0.1,
            source: sources[Math.floor(Math.random() * sources.length)],
            synced_at: clockIn2,
          });
        } else {
          // Single shift
          const workHours = 7 + Math.random() * 3.5; // 7-10.5h
          const clockIn = new Date(day);
          clockIn.setHours(startHour, startMin, 0, 0);
          const clockOut = new Date(clockIn);
          clockOut.setTime(clockIn.getTime() + workHours * 3600000);

          const projectCode = org1ProjectCodes[Math.floor(Math.random() * org1ProjectCodes.length)];
          await knex('clock_entries').insert({
            org_id: org1.id,
            user_id: driver.id,
            clock_in: clockIn,
            clock_out: clockOut,
            route_id: routes[Math.floor(Math.random() * routes.length)],
            project_id: org1ProjectMap.get(projectCode),
            location_lat: 37.7749 + (Math.random() - 0.5) * 0.1,
            location_lon: -122.4194 + (Math.random() - 0.5) * 0.1,
            source: sources[Math.floor(Math.random() * sources.length)],
            synced_at: clockIn,
          });
        }
      }
    }

    // Org 2 drivers — California OT, includes some Saturdays
    if (!isWeekend || Math.random() < 0.3) {
      for (const driver of org2Drivers) {
        if (isWeekend && Math.random() < 0.5) continue; // half show up on Saturday

        const startHour = 5 + Math.floor(Math.random() * 2);
        const workHours = isWeekend
          ? 4 + Math.random() * 3 // 4-7h on Saturday
          : 8 + Math.random() * 4; // 8-12h weekdays (CA OT territory)
        const routeId = routes[Math.floor(Math.random() * routes.length)];

        const clockIn = new Date(day);
        clockIn.setHours(startHour, Math.floor(Math.random() * 30), 0, 0);
        const clockOut = new Date(clockIn);
        clockOut.setTime(clockIn.getTime() + workHours * 3600000);

        await knex('clock_entries').insert({
          org_id: org2.id,
          user_id: driver.id,
          clock_in: clockIn,
          clock_out: clockOut,
          route_id: routeId,
          source: Math.random() > 0.9 ? 'sms' : 'app',
          synced_at: clockIn,
        });
      }
    }

    // Org 3 drivers — small shop, weekdays only
    if (!isWeekend) {
      for (const driver of org3Drivers) {
        if (Math.random() < 0.08) continue; // occasional absence
        const workHours = 6 + Math.random() * 2.5;
        const clockIn = new Date(day);
        clockIn.setHours(7, Math.floor(Math.random() * 15), 0, 0);
        const clockOut = new Date(clockIn);
        clockOut.setTime(clockIn.getTime() + workHours * 3600000);

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
  }

  // ============================================================
  // TIMESHEETS — Last 4 weeks (mix of statuses)
  // ============================================================
  const org1Manager = org1Users.find((u) => u.role === 'manager')!;
  const org2Manager = org2Users.find((u) => u.role === 'manager')!;

  for (let weekBack = 0; weekBack < 4; weekBack++) {
    const friday = new Date(now);
    friday.setDate(friday.getDate() - friday.getDay() - 2 - weekBack * 7); // Previous Fridays
    const weekEnding = friday.toISOString().split('T')[0];

    // Org 1 timesheets
    for (let i = 0; i < org1Drivers.length; i++) {
      const baseHours = 36 + Math.random() * 12; // 36-48h range
      const hours = Math.round(baseHours * 100) / 100;
      const otHours = hours > 40 ? Math.round((hours - 40) * 100) / 100 : 0;

      // Older weeks more likely approved, recent weeks more pending
      let status: string;
      if (weekBack >= 2) {
        status = 'approved';
      } else if (weekBack === 1) {
        status = i < 4 ? 'approved' : 'submitted';
      } else {
        status = i < 2 ? 'approved' : i < 4 ? 'submitted' : 'draft';
      }

      const [ts] = await knex('timesheets')
        .insert({
          org_id: org1.id,
          user_id: org1Drivers[i].id,
          week_ending: weekEnding,
          status,
          hours_worked: hours,
          ot_hours: otHours,
        })
        .returning('id');

      if (status === 'approved') {
        await knex('timesheet_approvals').insert({
          org_id: org1.id,
          timesheet_id: ts.id,
          manager_id: org1Manager.id,
          status: 'approved',
          notes: ['Looks good', 'Approved', 'All checks out', 'OK'][Math.floor(Math.random() * 4)],
        });
      }
    }

    // Org 2 timesheets
    for (const driver of org2Drivers) {
      const hours = 40 + Math.random() * 12; // 40-52h (heavy OT)
      const status = weekBack >= 1 ? 'approved' : 'submitted';
      const [ts] = await knex('timesheets')
        .insert({
          org_id: org2.id,
          user_id: driver.id,
          week_ending: weekEnding,
          status,
          hours_worked: Math.round(hours * 100) / 100,
          ot_hours: Math.round((hours - 40) * 100) / 100,
        })
        .returning('id');

      if (status === 'approved') {
        await knex('timesheet_approvals').insert({
          org_id: org2.id,
          timesheet_id: ts.id,
          manager_id: org2Manager.id,
          status: 'approved',
          notes: 'Reviewed and approved',
        });
      }
    }
  }

  // ============================================================
  // WORK ZONES — Depots and job sites
  // ============================================================
  await knex('work_zones').del();
  await knex('work_zones').insert([
    {
      org_id: org1.id,
      name: 'Main Depot',
      type: 'depot',
      lat: 37.7749,
      lon: -122.4194,
      radius_meters: 200,
      address: '100 Recycling Way, San Francisco, CA',
    },
    {
      org_id: org1.id,
      name: 'North Yard',
      type: 'depot',
      lat: 37.8044,
      lon: -122.2712,
      radius_meters: 150,
      address: '500 Industrial Blvd, Oakland, CA',
    },
    {
      org_id: org1.id,
      name: 'Bayview Transfer Station',
      type: 'transfer_station',
      lat: 37.7295,
      lon: -122.3925,
      radius_meters: 300,
      address: '1 Transfer Rd, San Francisco, CA',
    },
    {
      org_id: org1.id,
      name: 'Sunset Landfill',
      type: 'landfill',
      lat: 37.7559,
      lon: -122.4945,
      radius_meters: 500,
      address: '2000 Landfill Dr, Daly City, CA',
    },
    {
      org_id: org2.id,
      name: 'Metro HQ',
      type: 'depot',
      lat: 34.0522,
      lon: -118.2437,
      radius_meters: 200,
      address: '1 Metro Plaza, Los Angeles, CA',
    },
    {
      org_id: org2.id,
      name: 'East LA Yard',
      type: 'depot',
      lat: 34.0236,
      lon: -118.1699,
      radius_meters: 250,
      address: '800 E Industrial, East LA, CA',
    },
    {
      org_id: org3.id,
      name: 'Sunrise Base',
      type: 'depot',
      lat: 40.7128,
      lon: -74.006,
      radius_meters: 200,
      address: '10 Sunrise Lane, Newark, NJ',
    },
  ]);

  // ============================================================
  // TIME-OFF REQUESTS
  // ============================================================
  await knex('time_off_requests').del();

  // A few approved, a few pending
  const twoWeeksOut = new Date(now);
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);

  await knex('time_off_requests').insert([
    {
      org_id: org1.id,
      user_id: org1Drivers[0].id,
      type: 'pto',
      start_date: nextWeek.toISOString().split('T')[0],
      end_date: new Date(nextWeek.getTime() + 2 * 86400000).toISOString().split('T')[0],
      hours_requested: 24,
      status: 'pending',
      notes: 'Family vacation',
    },
    {
      org_id: org1.id,
      user_id: org1Drivers[1].id,
      type: 'sick',
      start_date: lastWeek.toISOString().split('T')[0],
      end_date: lastWeek.toISOString().split('T')[0],
      hours_requested: 8,
      status: 'approved',
      notes: 'Doctor appointment',
    },
    {
      org_id: org1.id,
      user_id: org1Drivers[2].id,
      type: 'personal',
      start_date: twoWeeksOut.toISOString().split('T')[0],
      end_date: twoWeeksOut.toISOString().split('T')[0],
      hours_requested: 8,
      status: 'pending',
      notes: 'Moving day',
    },
    {
      org_id: org1.id,
      user_id: org1Drivers[3].id,
      type: 'pto',
      start_date: lastWeek.toISOString().split('T')[0],
      end_date: new Date(lastWeek.getTime() + 4 * 86400000).toISOString().split('T')[0],
      hours_requested: 40,
      status: 'approved',
      notes: 'Spring break with kids',
    },
    {
      org_id: org2.id,
      user_id: org2Drivers[0].id,
      type: 'jury_duty',
      start_date: nextWeek.toISOString().split('T')[0],
      end_date: new Date(nextWeek.getTime() + 4 * 86400000).toISOString().split('T')[0],
      hours_requested: 40,
      status: 'pending',
      notes: 'Jury duty summons',
    },
  ]);

  // ============================================================
  // TIME-OFF BALANCES
  // ============================================================
  await knex('time_off_balances').del();
  const currentYear = now.getFullYear();

  for (const driver of org1Drivers) {
    const ptoUsed = 16 + Math.floor(Math.random() * 24);
    const sickUsed = Math.floor(Math.random() * 16);
    const persUsed = Math.floor(Math.random() * 8);
    await knex('time_off_balances').insert([
      {
        org_id: org1.id,
        user_id: driver.id,
        type: 'pto',
        year: currentYear,
        accrued_hours: 80,
        balance_hours: 80 - ptoUsed,
        used_hours: ptoUsed,
      },
      {
        org_id: org1.id,
        user_id: driver.id,
        type: 'sick',
        year: currentYear,
        accrued_hours: 40,
        balance_hours: 40 - sickUsed,
        used_hours: sickUsed,
      },
      {
        org_id: org1.id,
        user_id: driver.id,
        type: 'personal',
        year: currentYear,
        accrued_hours: 24,
        balance_hours: 24 - persUsed,
        used_hours: persUsed,
      },
    ]);
  }
  for (const driver of org2Drivers) {
    const ptoUsed = Math.floor(Math.random() * 32);
    const sickUsed = Math.floor(Math.random() * 16);
    await knex('time_off_balances').insert([
      {
        org_id: org2.id,
        user_id: driver.id,
        type: 'pto',
        year: currentYear,
        accrued_hours: 80,
        balance_hours: 80 - ptoUsed,
        used_hours: ptoUsed,
      },
      {
        org_id: org2.id,
        user_id: driver.id,
        type: 'sick',
        year: currentYear,
        accrued_hours: 48,
        balance_hours: 48 - sickUsed,
        used_hours: sickUsed,
      },
    ]);
  }

  // ============================================================
  // AUDIT LOG — Rich alert data for review queue
  // ============================================================
  const alertTypes = [
    {
      action: 'manager_alert:midnight_auto_close',
      make: (userId: string) => ({
        type: 'midnight_auto_close',
        priority: 'critical',
        title: 'Forgot to clock out',
        message: '8 hours auto-logged. Please review and adjust if needed.',
        userId,
      }),
    },
    {
      action: 'manager_alert:missing_clock_in',
      make: (userId: string) => ({
        type: 'missing_clock_in',
        priority: 'warning',
        title: 'Missing clock-in',
        message: "Employee hasn't clocked in today.",
        userId,
      }),
    },
    {
      action: 'manager_alert:timesheet_flagged',
      make: (userId: string) => ({
        type: 'timesheet_flagged',
        priority: 'warning',
        title: 'Timesheet anomaly',
        message: 'Unusual hours pattern detected. 3 days with >10h.',
        userId,
      }),
    },
    {
      action: 'manager_alert:overtime_exceeded',
      make: (userId: string) => ({
        type: 'overtime_exceeded',
        priority: 'critical',
        title: 'Overtime limit exceeded',
        message: 'Employee has worked over 50 hours this week.',
        userId,
      }),
    },
    {
      action: 'manager_alert:late_arrival',
      make: (userId: string) => ({
        type: 'late_arrival',
        priority: 'info',
        title: 'Late arrival',
        message: 'Employee clocked in 2+ hours after typical start time.',
        userId,
      }),
    },
  ];

  const auditEntries: any[] = [];

  // Generate alerts spread over the last 2 weeks
  for (let dayBack = 0; dayBack < 14; dayBack++) {
    const alertDate = new Date(now);
    alertDate.setDate(alertDate.getDate() - dayBack);
    if (alertDate.getDay() === 0 || alertDate.getDay() === 6) continue;

    // 1-3 alerts per day for org1
    const alertCount = 1 + Math.floor(Math.random() * 3);
    for (let a = 0; a < alertCount; a++) {
      const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const targetDriver = org1Drivers[Math.floor(Math.random() * org1Drivers.length)];
      alertDate.setHours(7 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));

      auditEntries.push({
        org_id: org1.id,
        user_id: targetDriver.id,
        action: alertType.action,
        entity_type: 'clock_entry',
        details: JSON.stringify(alertType.make(targetDriver.id)),
        created_at: new Date(alertDate),
      });
    }

    // Fewer alerts for org2
    if (Math.random() < 0.5) {
      const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      const targetDriver = org2Drivers[Math.floor(Math.random() * org2Drivers.length)];
      auditEntries.push({
        org_id: org2.id,
        user_id: targetDriver.id,
        action: alertType.action,
        entity_type: 'clock_entry',
        details: JSON.stringify(alertType.make(targetDriver.id)),
        created_at: new Date(alertDate),
      });
    }
  }

  // General audit entries (non-alert)
  auditEntries.push(
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
  );

  // Batch insert audit log entries
  for (let i = 0; i < auditEntries.length; i += 50) {
    await knex('audit_log').insert(auditEntries.slice(i, i + 50));
  }

  // ============================================================
  // SHIFT TEMPLATES + SCHEDULES + NOTIFICATIONS (only if tables exist)
  // ============================================================
  const hasTemplates = await knex.schema.hasTable('shift_templates');
  const hasSchedules = await knex.schema.hasTable('schedules');
  const hasNotifications = await knex.schema.hasTable('notifications');

  if (hasTemplates) {
    const org1Templates = await knex('shift_templates')
      .insert([
        {
          org_id: org1.id,
          name: 'Early Morning Residential',
          shift_start: '05:30',
          shift_end: '13:30',
          project_id: org1ProjectMap.get('RES-PICKUP'),
          route_id: 'RES-01',
          color: '#2e7d32',
        },
        {
          org_id: org1.id,
          name: 'Late Morning Commercial',
          shift_start: '07:00',
          shift_end: '15:00',
          project_id: org1ProjectMap.get('COM-PICKUP'),
          route_id: 'COM-01',
          color: '#1565c0',
        },
        {
          org_id: org1.id,
          name: 'Recycling Route',
          shift_start: '06:00',
          shift_end: '14:00',
          project_id: org1ProjectMap.get('RECYCLING'),
          route_id: 'RCY-01',
          color: '#00897b',
        },
        {
          org_id: org1.id,
          name: 'Bulk Pickup Afternoon',
          shift_start: '10:00',
          shift_end: '18:00',
          project_id: org1ProjectMap.get('BULK-WASTE'),
          route_id: 'BLK-01',
          color: '#6a1b9a',
        },
        {
          org_id: org1.id,
          name: 'Yard Maintenance',
          shift_start: '07:00',
          shift_end: '15:30',
          project_id: org1ProjectMap.get('YARD-WORK'),
          color: '#ef6c00',
        },
      ])
      .returning(['id', 'project_id', 'route_id', 'shift_start', 'shift_end']);

    if (hasSchedules) {
      const thisMonday = new Date(now);
      thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));
      thisMonday.setHours(0, 0, 0, 0);

      const nextMonday = new Date(thisMonday);
      nextMonday.setDate(nextMonday.getDate() + 7);

      // Each driver has a primary assignment that reflects their actual work
      // John Davis — Residential pickup, early morning, RES-01/RES-02
      // Jane Wilson — Commercial pickup, late morning, COM-01/COM-02
      // Bob Martinez — Recycling collection, early morning, RCY-01
      // Alice Johnson — Residential pickup, early morning, RES-02 (covers different area)
      // Tom Brown — Bulk waste removal, afternoon shift, BLK-01
      // Sam Garcia — Yard maintenance + fill-in, varies by day

      const driverSchedules = [
        { driver: org1Drivers[0], primary: org1Templates[0], altRoute: 'RES-02', offDay: -1 }, // John — residential daily
        { driver: org1Drivers[1], primary: org1Templates[1], altRoute: 'COM-02', offDay: -1 }, // Jane — commercial daily
        { driver: org1Drivers[2], primary: org1Templates[2], altRoute: null, offDay: 4 }, // Bob — recycling Mon-Thu, off Fri
        { driver: org1Drivers[3], primary: org1Templates[0], altRoute: 'RES-02', offDay: -1 }, // Alice — residential daily (RES-02)
        { driver: org1Drivers[4], primary: org1Templates[3], altRoute: null, offDay: -1 }, // Tom — bulk waste daily
        { driver: org1Drivers[5], primary: null, altRoute: null, offDay: -1 }, // Sam — varies by day
      ];

      // Sam's rotating schedule — different project each day
      const samRotation = [
        org1Templates[4], // Mon: Yard
        org1Templates[0], // Tue: Residential (fill-in)
        org1Templates[4], // Wed: Yard
        org1Templates[2], // Thu: Recycling (fill-in for Bob area)
        org1Templates[1], // Fri: Commercial (fill-in)
      ];

      // Weekend drivers — drivers can work any day of the week
      // Saturday crew: John (residential), Bob (recycling), Tom (bulk), Sam (yard)
      // Sunday crew: Jane (commercial), Alice (residential), Sam (yard)
      const weekendSchedules = [
        // Saturday
        {
          driver: org1Drivers[0],
          template: org1Templates[0],
          route: 'RES-01',
          dayOffset: 5,
          notes: 'Saturday crew',
        },
        {
          driver: org1Drivers[2],
          template: org1Templates[2],
          route: 'RCY-01',
          dayOffset: 5,
          notes: 'Saturday crew',
        },
        {
          driver: org1Drivers[4],
          template: org1Templates[3],
          route: 'BLK-01',
          dayOffset: 5,
          notes: 'Saturday crew',
        },
        {
          driver: org1Drivers[5],
          template: org1Templates[4],
          route: 'YRD-01',
          dayOffset: 5,
          notes: 'Saturday crew',
        },
        // Sunday
        {
          driver: org1Drivers[1],
          template: org1Templates[1],
          route: 'COM-01',
          dayOffset: 6,
          notes: 'Sunday crew',
        },
        {
          driver: org1Drivers[3],
          template: org1Templates[0],
          route: 'RES-02',
          dayOffset: 6,
          notes: 'Sunday crew',
        },
        {
          driver: org1Drivers[5],
          template: org1Templates[4],
          route: 'YRD-01',
          dayOffset: 6,
          notes: 'Sunday crew',
        },
      ];

      for (const monday of [thisMonday, nextMonday]) {
        // Mon-Fri schedules
        for (let dayOff = 0; dayOff < 5; dayOff++) {
          const schedDate = new Date(monday);
          schedDate.setDate(schedDate.getDate() + dayOff);
          const dateStr = schedDate.toISOString().split('T')[0];

          for (let dIdx = 0; dIdx < driverSchedules.length; dIdx++) {
            const ds = driverSchedules[dIdx];

            // Skip if this is the driver's day off
            if (ds.offDay === dayOff) continue;

            let template;
            let routeId;
            let notes: string | null = null;

            if (dIdx === 5) {
              // Sam — rotating schedule
              template = samRotation[dayOff];
              routeId = template.route_id;
              notes = dayOff === 1 || dayOff === 3 || dayOff === 4 ? 'Fill-in' : null;
            } else {
              template = ds.primary!;
              // Alternate route on Wed/Fri for drivers with alt routes
              routeId =
                ds.altRoute && (dayOff === 2 || dayOff === 4) ? ds.altRoute : template.route_id;
            }

            await knex('schedules').insert({
              org_id: org1.id,
              user_id: ds.driver.id,
              date: dateStr,
              project_id: template.project_id,
              route_id: routeId,
              shift_start: template.shift_start,
              shift_end: template.shift_end,
              template_id: template.id,
              notes,
            });
          }
        }

        // Weekend schedules (Sat = +5, Sun = +6 from Monday)
        for (const ws of weekendSchedules) {
          const schedDate = new Date(monday);
          schedDate.setDate(schedDate.getDate() + ws.dayOffset);
          const dateStr = schedDate.toISOString().split('T')[0];

          await knex('schedules').insert({
            org_id: org1.id,
            user_id: ws.driver.id,
            date: dateStr,
            project_id: ws.template.project_id,
            route_id: ws.route,
            shift_start: ws.template.shift_start,
            shift_end: ws.template.shift_end,
            template_id: ws.template.id,
            notes: ws.notes,
          });
        }
      }
    }
  }

  if (hasNotifications) {
    const managerUserId = org1Manager.id;
    await knex('notifications').insert([
      {
        org_id: org1.id,
        user_id: managerUserId,
        type: 'timesheet_submitted',
        title: 'Timesheet submitted',
        message: 'John Davis submitted their timesheet for review.',
        data: JSON.stringify({ userId: org1Drivers[0].id }),
      },
      {
        org_id: org1.id,
        user_id: managerUserId,
        type: 'ot_alert',
        title: 'Overtime threshold reached',
        message: 'Bob Martinez has worked 42 hours this week.',
        data: JSON.stringify({ userId: org1Drivers[2].id, hours: 42 }),
      },
      {
        org_id: org1.id,
        user_id: managerUserId,
        type: 'time_off_request',
        title: 'Time-off request',
        message: 'Alice Johnson requested 3 days PTO starting next Monday.',
        data: JSON.stringify({ userId: org1Drivers[3].id }),
      },
      {
        org_id: org1.id,
        user_id: managerUserId,
        type: 'missing_clock_in',
        title: 'Missing clock-in',
        message: 'Sam Garcia has not clocked in today.',
        data: JSON.stringify({ userId: org1Drivers[5].id }),
      },
      {
        org_id: org1.id,
        user_id: managerUserId,
        type: 'schedule_conflict',
        title: 'Schedule conflict',
        message: 'Tom Brown is scheduled for two overlapping shifts on Friday.',
        data: JSON.stringify({ userId: org1Drivers[4].id }),
      },
    ]);
  }

  // ============================================================
  // LIVE DEMO DATA — Active clock entries right now
  // Creates clocked-in drivers matching the schedule for the current day
  // ============================================================
  const currentDayOfWeek = now.getDay(); // 0=Sun, 6=Sat

  // Weekday crew (Mon-Fri): John, Jane, Bob, Tom clocked in; Alice & Sam off
  // Saturday crew: John, Bob, Tom clocked in
  // Sunday crew: Jane, Alice clocked in
  let demoStartTimes: { driver: any; hoursAgo: number; route: string; project: string }[];

  if (currentDayOfWeek === 6) {
    // Saturday
    demoStartTimes = [
      { driver: org1Drivers[0], hoursAgo: 3.5, route: 'RES-01', project: 'RES-PICKUP' }, // John
      { driver: org1Drivers[2], hoursAgo: 4.0, route: 'RCY-01', project: 'RECYCLING' }, // Bob
      { driver: org1Drivers[4], hoursAgo: 1.5, route: 'BLK-01', project: 'BULK-WASTE' }, // Tom
    ];
  } else if (currentDayOfWeek === 0) {
    // Sunday
    demoStartTimes = [
      { driver: org1Drivers[1], hoursAgo: 2.0, route: 'COM-01', project: 'COM-PICKUP' }, // Jane
      { driver: org1Drivers[3], hoursAgo: 3.0, route: 'RES-02', project: 'RES-PICKUP' }, // Alice
    ];
  } else {
    // Weekdays
    demoStartTimes = [
      { driver: org1Drivers[0], hoursAgo: 3.5, route: 'RES-01', project: 'RES-PICKUP' }, // John
      { driver: org1Drivers[1], hoursAgo: 2.0, route: 'COM-01', project: 'COM-PICKUP' }, // Jane
      { driver: org1Drivers[2], hoursAgo: 4.0, route: 'RCY-01', project: 'RECYCLING' }, // Bob
      { driver: org1Drivers[4], hoursAgo: 1.5, route: 'BLK-01', project: 'BULK-WASTE' }, // Tom
    ];
  }

  for (const demo of demoStartTimes) {
    const clockIn = new Date(now.getTime() - demo.hoursAgo * 3600000);
    await knex('clock_entries').insert({
      org_id: org1.id,
      user_id: demo.driver.id,
      clock_in: clockIn,
      clock_out: null, // still clocked in
      route_id: demo.route,
      project_id: org1ProjectMap.get(demo.project),
      location_lat: 37.7749 + (Math.random() - 0.5) * 0.05,
      location_lon: -122.4194 + (Math.random() - 0.5) * 0.05,
      source: 'app',
      synced_at: clockIn,
    });
  }

  // Also create a completed earlier shift for Alice on weekdays (she worked the morning)
  if (currentDayOfWeek >= 1 && currentDayOfWeek <= 5) {
    const aliceMorningIn = new Date(now);
    aliceMorningIn.setHours(6, 0, 0, 0);
    const aliceMorningOut = new Date(now);
    aliceMorningOut.setHours(10, 30, 0, 0);
    if (aliceMorningOut < now) {
      await knex('clock_entries').insert({
        org_id: org1.id,
        user_id: org1Drivers[3].id,
        clock_in: aliceMorningIn,
        clock_out: aliceMorningOut,
        route_id: 'RES-02',
        project_id: org1ProjectMap.get('RES-PICKUP'),
        source: 'app',
        synced_at: aliceMorningIn,
      });
    }
  }

  // Org 2: 2 of 3 drivers clocked in
  const org2Projects = await knex('projects').where({ org_id: org2.id }).select('id', 'code');
  const org2ProjectMap = new Map(org2Projects.map((p: any) => [p.code, p.id]));

  await knex('clock_entries').insert({
    org_id: org2.id,
    user_id: org2Drivers[0].id,
    clock_in: new Date(now.getTime() - 5 * 3600000),
    clock_out: null,
    route_id: 'RES-01',
    project_id: org2ProjectMap.get('RES-PICKUP'),
    source: 'app',
    synced_at: new Date(now.getTime() - 5 * 3600000),
  });

  await knex('clock_entries').insert({
    org_id: org2.id,
    user_id: org2Drivers[1].id,
    clock_in: new Date(now.getTime() - 3 * 3600000),
    clock_out: null,
    route_id: 'COM-01',
    project_id: org2ProjectMap.get('COM-PICKUP'),
    source: 'app',
    synced_at: new Date(now.getTime() - 3 * 3600000),
  });
}
