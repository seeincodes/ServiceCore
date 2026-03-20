import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('timesheet_approvals', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    table.uuid('timesheet_id').notNullable().references('id').inTable('timesheets').onDelete('CASCADE');
    table.uuid('manager_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enu('status', ['approved', 'rejected', 'revision_requested'], {
      useNative: true,
      enumName: 'approval_status',
    }).notNullable();
    table.text('notes');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('timesheet_approvals');
  await knex.raw('DROP TYPE IF EXISTS approval_status');
}
