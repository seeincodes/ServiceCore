import { Knex } from 'knex';
import bcrypt from 'bcrypt';

/**
 * Production seed — creates initial orgs and admin accounts.
 * Does NOT create test drivers or fake data.
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
  // Demo Org 1: GreenWaste Solutions (large, federal OT)
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

  await knex('users').insert({
    org_id: org1.id,
    email: 'admin@greenwaste.com',
    phone: '+15551000001',
    password_hash: passwordHash,
    first_name: 'Sarah',
    last_name: 'Chen',
    role: 'org_admin',
  });

  // ============================================================
  // Demo Org 2: Metro Disposal Co (medium, California OT)
  // ============================================================
  const [org2] = await knex('orgs')
    .insert({
      name: 'Metro Disposal Co',
      slug: 'metro-disposal',
      branding: JSON.stringify({
        logo: '/assets/metro-logo.png',
        primaryColor: '#1565c0',
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

  await knex('users').insert({
    org_id: org2.id,
    email: 'admin@metrodisposal.com',
    phone: '+15552000001',
    password_hash: passwordHash,
    first_name: 'Tom',
    last_name: 'Nguyen',
    role: 'org_admin',
  });

  // ============================================================
  // Demo Org 3: Sunrise Sanitation (small, free tier demo)
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

  await knex('users').insert({
    org_id: org3.id,
    email: 'owner@sunrise.com',
    phone: '+15553000001',
    password_hash: passwordHash,
    first_name: 'Ray',
    last_name: 'Harper',
    role: 'org_admin',
  });

  // ============================================================
  // Demo Org 4: Pacific Waste Management (enterprise)
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

  await knex('users').insert({
    org_id: org4.id,
    email: 'admin@pacificwaste.com',
    phone: '+15554000001',
    password_hash: passwordHash,
    first_name: 'Linda',
    last_name: 'Tran',
    role: 'org_admin',
  });

  // ============================================================
  // Demo Org 5: EcoHaul Services (medium, east coast)
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

  await knex('users').insert({
    org_id: org5.id,
    email: 'admin@ecohaul.com',
    phone: '+15555000001',
    password_hash: passwordHash,
    first_name: 'Marcus',
    last_name: 'Williams',
    role: 'org_admin',
  });

  console.log('Production seed complete: 5 orgs with admin accounts created.');
  console.log('Default admin password: ChangeMe!2026 — CHANGE IMMEDIATELY after first login.');
}
