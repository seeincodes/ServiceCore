import { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Production seed — creates demo orgs with full user hierarchies,
 * projects, clock entries, timesheets, and work zones.
 * Matches the development seed structure so demo login buttons work.
 * Run once on first deployment, then manage via admin UI.
 */
export async function seed(knex: Knex): Promise<void> {
  const passwordHash = await bcrypt.hash('ChangeMe!2026', 10);

  // Check if orgs already exist (don't re-seed production)
  const existing = await knex('orgs').count('id as count').first();
  if (Number(existing?.count) > 0) {
    console.log('Production database already seeded, skipping.');
    return;
  }

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
        custom_domain: 'time.greenwaste.com',
      }),
      config: JSON.stringify({
        ot_rules: 'federal',
        work_week_start: 'monday',
        approval_required: true,
        sms_enabled: true,
        qb_enabled: true,
        ot_workflow_enabled: true,
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
  // ORG 4: Pacific Waste Management (enterprise)
  // ============================================================
  const [org4] = await knex('orgs')
    .insert({
      name: 'Pacific Waste Management',
      slug: 'pacific-waste',
      branding: JSON.stringify({
        logo: '/assets/pacific-logo.png',
        primaryColor: '#0d47a1',
        secondaryColor: '#1976d2',
        custom_domain: 'time.pacificwaste.com',
      }),
      config: JSON.stringify({
        ot_rules: 'california',
        work_week_start: 'monday',
        approval_required: true,
        sms_enabled: true,
        ivr_enabled: true,
        qb_enabled: true,
        ot_workflow_enabled: true,
        dispatcher_api_url: 'https://dispatch.pacificwaste.com/api',
      }),
    })
    .returning('id');

  // ============================================================
  // ORG 5: EcoHaul Services (medium, east coast)
  // ============================================================
  const [org5] = await knex('orgs')
    .insert({
      name: 'EcoHaul Services',
      slug: 'ecohaul',
      branding: JSON.stringify({
        logo: '/assets/ecohaul-logo.png',
        primaryColor: '#2e7d32',
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
  // USERS — Full hierarchy per org (admins, managers, drivers)
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

  // Org 4 admin
  await knex('users').insert({
    org_id: org4.id,
    email: 'admin@pacificwaste.com',
    phone: '+15554000001',
    password_hash: passwordHash,
    first_name: 'Linda',
    last_name: 'Tran',
    role: 'org_admin',
  });

  // Org 5 admin
  await knex('users').insert({
    org_id: org5.id,
    email: 'admin@ecohaul.com',
    phone: '+15555000001',
    password_hash: passwordHash,
    first_name: 'Marcus',
    last_name: 'Williams',
    role: 'org_admin',
  });

  // ============================================================
  // PROJECTS
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

  for (let dayOffset = 41; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const dayOfWeek = day.getDay();

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Org 1 drivers — all 7 days, lighter weekend crews
    {
      for (let dIdx = 0; dIdx < org1Drivers.length; dIdx++) {
        const driver = org1Drivers[dIdx];
        // On weekends, only 3-4 drivers work
        if (isWeekend && dIdx >= 4) continue;
        if (dIdx >= 2 && Math.random() < 0.1) continue;

        const startHour = 5 + Math.floor(Math.random() * 3);
        const startMin = Math.floor(Math.random() * 45);
        const doSplitShift = Math.random() < 0.25;

        if (doSplitShift) {
          const morningHours = 3.5 + Math.random() * 1.5;
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

          const breakMin = 30 + Math.floor(Math.random() * 30);
          const clockIn2 = new Date(clockOut1);
          clockIn2.setTime(clockOut1.getTime() + breakMin * 60000);
          const afternoonHours = 3 + Math.random() * 2;
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
          const workHours = 7 + Math.random() * 3.5;
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
        if (isWeekend && Math.random() < 0.5) continue;

        const startHour = 5 + Math.floor(Math.random() * 2);
        const workHours = isWeekend ? 4 + Math.random() * 3 : 8 + Math.random() * 4;
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
        if (Math.random() < 0.08) continue;
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
    friday.setDate(friday.getDate() - friday.getDay() - 2 - weekBack * 7);
    const weekEnding = friday.toISOString().split('T')[0];

    for (let i = 0; i < org1Drivers.length; i++) {
      const baseHours = 36 + Math.random() * 12;
      const hours = Math.round(baseHours * 100) / 100;
      const otHours = hours > 40 ? Math.round((hours - 40) * 100) / 100 : 0;

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

    for (const driver of org2Drivers) {
      const hours = 40 + Math.random() * 12;
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
  // WORK ZONES
  // ============================================================
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
      org_id: org2.id,
      name: 'Metro HQ',
      type: 'depot',
      lat: 34.0522,
      lon: -118.2437,
      radius_meters: 200,
      address: '1 Metro Plaza, Los Angeles, CA',
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
  ]);

  // ============================================================
  // TIME-OFF BALANCES
  // ============================================================
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
  // AUDIT LOG — Alerts for review queue
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

  for (let dayBack = 0; dayBack < 14; dayBack++) {
    const alertDate = new Date(now);
    alertDate.setDate(alertDate.getDate() - dayBack);
    if (alertDate.getDay() === 0 || alertDate.getDay() === 6) continue;

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

      const driverSchedules = [
        { driver: org1Drivers[0], primary: org1Templates[0], altRoute: 'RES-02', offDay: -1 },
        { driver: org1Drivers[1], primary: org1Templates[1], altRoute: 'COM-02', offDay: -1 },
        { driver: org1Drivers[2], primary: org1Templates[2], altRoute: null, offDay: 4 },
        { driver: org1Drivers[3], primary: org1Templates[0], altRoute: 'RES-02', offDay: -1 },
        { driver: org1Drivers[4], primary: org1Templates[3], altRoute: null, offDay: -1 },
        { driver: org1Drivers[5], primary: null, altRoute: null, offDay: -1 },
      ];

      const samRotation = [
        org1Templates[4],
        org1Templates[0],
        org1Templates[4],
        org1Templates[2],
        org1Templates[1],
      ];

      // Weekend schedules — drivers can work any day of the week
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
            if (ds.offDay === dayOff) continue;

            let template;
            let routeId;
            let notes: string | null = null;

            if (dIdx === 5) {
              template = samRotation[dayOff];
              routeId = template.route_id;
              notes = dayOff === 1 || dayOff === 3 || dayOff === 4 ? 'Fill-in' : null;
            } else {
              template = ds.primary!;
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
    ]);
  }

  // ============================================================
  // LIVE DEMO DATA — Active clock entries matching schedule for current day
  // ============================================================
  const currentDayOfWeek = now.getDay(); // 0=Sun, 6=Sat

  let demoStartTimes: { driver: any; hoursAgo: number; route: string; project: string }[];

  if (currentDayOfWeek === 6) {
    // Saturday crew
    demoStartTimes = [
      { driver: org1Drivers[0], hoursAgo: 3.5, route: 'RES-01', project: 'RES-PICKUP' },
      { driver: org1Drivers[2], hoursAgo: 4.0, route: 'RCY-01', project: 'RECYCLING' },
      { driver: org1Drivers[4], hoursAgo: 1.5, route: 'BLK-01', project: 'BULK-WASTE' },
    ];
  } else if (currentDayOfWeek === 0) {
    // Sunday crew
    demoStartTimes = [
      { driver: org1Drivers[1], hoursAgo: 2.0, route: 'COM-01', project: 'COM-PICKUP' },
      { driver: org1Drivers[3], hoursAgo: 3.0, route: 'RES-02', project: 'RES-PICKUP' },
    ];
  } else {
    // Weekday crew
    demoStartTimes = [
      { driver: org1Drivers[0], hoursAgo: 3.5, route: 'RES-01', project: 'RES-PICKUP' },
      { driver: org1Drivers[1], hoursAgo: 2.0, route: 'COM-01', project: 'COM-PICKUP' },
      { driver: org1Drivers[2], hoursAgo: 4.0, route: 'RCY-01', project: 'RECYCLING' },
      { driver: org1Drivers[4], hoursAgo: 1.5, route: 'BLK-01', project: 'BULK-WASTE' },
    ];
  }

  for (const demo of demoStartTimes) {
    const clockIn = new Date(now.getTime() - demo.hoursAgo * 3600000);
    await knex('clock_entries').insert({
      org_id: org1.id,
      user_id: demo.driver.id,
      clock_in: clockIn,
      clock_out: null,
      route_id: demo.route,
      project_id: org1ProjectMap.get(demo.project),
      location_lat: 37.7749 + (Math.random() - 0.5) * 0.05,
      location_lon: -122.4194 + (Math.random() - 0.5) * 0.05,
      source: 'app',
      synced_at: clockIn,
    });
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

  console.log('Production seed complete: 5 orgs with full demo data created.');
  console.log('Default password: ChangeMe!2026 — CHANGE IMMEDIATELY after first login.');
}
