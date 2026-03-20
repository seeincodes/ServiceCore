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

  // Org 1: GreenWaste Solutions
  const [org1] = await knex('orgs')
    .insert({
      name: 'GreenWaste Solutions',
      slug: 'greenwaste',
      branding: JSON.stringify({ logo: '/assets/greenwaste-logo.png', primaryColor: '#2e7d32' }),
      config: JSON.stringify({
        ot_rules: 'federal',
        work_week_start: 'monday',
        approval_required: true,
      }),
    })
    .returning('id');

  // Org 2: Metro Disposal Co
  const [org2] = await knex('orgs')
    .insert({
      name: 'Metro Disposal Co',
      slug: 'metro-disposal',
      branding: JSON.stringify({ logo: '/assets/metro-logo.png', primaryColor: '#1565c0' }),
      config: JSON.stringify({
        ot_rules: 'california',
        work_week_start: 'monday',
        approval_required: true,
      }),
    })
    .returning('id');

  // Org 1 users
  await knex('users').insert([
    {
      org_id: org1.id,
      email: 'admin@greenwaste.com',
      phone: '+15551000001',
      password_hash: passwordHash,
      first_name: 'Sarah',
      last_name: 'Admin',
      role: 'org_admin',
    },
    {
      org_id: org1.id,
      email: 'manager@greenwaste.com',
      phone: '+15551000002',
      password_hash: passwordHash,
      first_name: 'Mike',
      last_name: 'Manager',
      role: 'manager',
    },
    {
      org_id: org1.id,
      email: 'payroll@greenwaste.com',
      phone: '+15551000003',
      password_hash: passwordHash,
      first_name: 'Lisa',
      last_name: 'Payroll',
      role: 'payroll_admin',
    },
    {
      org_id: org1.id,
      email: 'driver1@greenwaste.com',
      phone: '+15551000004',
      password_hash: passwordHash,
      first_name: 'John',
      last_name: 'Driver',
      role: 'employee',
    },
    {
      org_id: org1.id,
      email: 'driver2@greenwaste.com',
      phone: '+15551000005',
      password_hash: passwordHash,
      first_name: 'Jane',
      last_name: 'Driver',
      role: 'employee',
    },
    {
      org_id: org1.id,
      email: 'driver3@greenwaste.com',
      phone: '+15551000006',
      password_hash: passwordHash,
      first_name: 'Bob',
      last_name: 'Trucker',
      role: 'employee',
    },
  ]);

  // Org 2 users
  await knex('users').insert([
    {
      org_id: org2.id,
      email: 'admin@metrodisposal.com',
      phone: '+15552000001',
      password_hash: passwordHash,
      first_name: 'Tom',
      last_name: 'Admin',
      role: 'org_admin',
    },
    {
      org_id: org2.id,
      email: 'manager@metrodisposal.com',
      phone: '+15552000002',
      password_hash: passwordHash,
      first_name: 'Anna',
      last_name: 'Manager',
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
  ]);
}
