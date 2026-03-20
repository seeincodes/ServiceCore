import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create an app role for the API to use with RLS
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user;
      END IF;
    END
    $$;
  `);

  // Grant usage to app_user
  await knex.raw('GRANT USAGE ON SCHEMA public TO app_user');
  await knex.raw('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user');
  await knex.raw('GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user');

  // RLS policies for users table
  await knex.raw(`
    CREATE POLICY users_org_isolation ON users
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  `);

  // RLS policies for clock_entries
  await knex.raw(`
    CREATE POLICY clock_entries_org_isolation ON clock_entries
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  `);

  // RLS policies for timesheets
  await knex.raw(`
    CREATE POLICY timesheets_org_isolation ON timesheets
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  `);

  // RLS policies for timesheet_approvals
  await knex.raw(`
    CREATE POLICY timesheet_approvals_org_isolation ON timesheet_approvals
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  `);

  // RLS policies for audit_log
  await knex.raw(`
    CREATE POLICY audit_log_org_isolation ON audit_log
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP POLICY IF EXISTS users_org_isolation ON users');
  await knex.raw('DROP POLICY IF EXISTS clock_entries_org_isolation ON clock_entries');
  await knex.raw('DROP POLICY IF EXISTS timesheets_org_isolation ON timesheets');
  await knex.raw('DROP POLICY IF EXISTS timesheet_approvals_org_isolation ON timesheet_approvals');
  await knex.raw('DROP POLICY IF EXISTS audit_log_org_isolation ON audit_log');
  await knex.raw('DROP ROLE IF EXISTS app_user');
}
