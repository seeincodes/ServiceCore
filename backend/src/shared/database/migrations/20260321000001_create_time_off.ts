import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('time_off_balances', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enum('type', ['pto', 'sick', 'personal', 'bereavement', 'jury_duty']).notNullable();
    t.decimal('balance_hours', 8, 2).notNullable().defaultTo(0);
    t.decimal('accrued_hours', 8, 2).notNullable().defaultTo(0);
    t.decimal('used_hours', 8, 2).notNullable().defaultTo(0);
    t.integer('year').notNullable();
    t.timestamps(true, true);
    t.unique(['org_id', 'user_id', 'type', 'year']);
  });

  await knex.schema.createTable('time_off_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enum('type', ['pto', 'sick', 'personal', 'bereavement', 'jury_duty']).notNullable();
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.decimal('hours_requested', 8, 2).notNullable();
    t.enum('status', ['pending', 'approved', 'denied', 'cancelled'])
      .notNullable()
      .defaultTo('pending');
    t.text('notes');
    t.uuid('reviewed_by').references('id').inTable('users');
    t.text('review_notes');
    t.timestamp('reviewed_at');
    t.timestamps(true, true);
    t.index(['org_id', 'user_id', 'status']);
    t.index(['org_id', 'start_date', 'end_date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('time_off_requests');
  await knex.schema.dropTableIfExists('time_off_balances');
}
