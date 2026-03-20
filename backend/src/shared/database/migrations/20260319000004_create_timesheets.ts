import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('timesheets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.date('week_ending').notNullable();
    table.enu('status', ['draft', 'submitted', 'approved', 'locked'], {
      useNative: true,
      enumName: 'timesheet_status',
    }).defaultTo('draft');
    table.decimal('hours_worked', 6, 2).defaultTo(0);
    table.decimal('ot_hours', 6, 2).defaultTo(0);
    table.timestamps(true, true);
    table.unique(['org_id', 'user_id', 'week_ending']);
  });

  await knex.schema.raw('CREATE INDEX idx_timesheets_org_status ON timesheets(org_id, status)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('timesheets');
  await knex.raw('DROP TYPE IF EXISTS timesheet_status');
}
