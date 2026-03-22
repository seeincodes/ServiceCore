import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('time_edit_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('org_id').notNullable().references('id').inTable('orgs');
    t.uuid('user_id').notNullable().references('id').inTable('users');
    t.enu('type', ['add', 'edit']).notNullable();
    t.uuid('clock_entry_id').nullable().references('id').inTable('clock_entries');
    t.timestamp('proposed_clock_in', { useTz: true }).notNullable();
    t.timestamp('proposed_clock_out', { useTz: true }).notNullable();
    t.string('project_id', 100).nullable();
    t.text('reason').notNullable();
    t.enu('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
    t.uuid('reviewed_by').nullable().references('id').inTable('users');
    t.text('review_notes').nullable();
    t.timestamp('reviewed_at', { useTz: true }).nullable();
    t.timestamps(true, true);

    t.index(['org_id', 'status'], 'idx_edit_requests_org_status');
    t.index(['user_id', 'status'], 'idx_edit_requests_user_status');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('time_edit_requests');
}
