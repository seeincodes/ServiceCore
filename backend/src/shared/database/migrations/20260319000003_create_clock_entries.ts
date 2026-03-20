import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('clock_entries', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('clock_in', { useTz: true }).notNullable();
    table.timestamp('clock_out', { useTz: true });
    table.string('project_id', 100);
    table.string('route_id', 100);
    table.decimal('location_lat', 10, 7);
    table.decimal('location_lon', 10, 7);
    table.enu('source', ['app', 'sms', 'ivr'], {
      useNative: true,
      enumName: 'clock_source',
    }).defaultTo('app');
    table.timestamp('synced_at', { useTz: true });
    table.string('idempotency_key', 255);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.raw('CREATE INDEX idx_clock_org_user_in ON clock_entries(org_id, user_id, clock_in)');
  await knex.schema.raw('CREATE INDEX idx_clock_org_in ON clock_entries(org_id, clock_in)');
  await knex.schema.raw('CREATE UNIQUE INDEX idx_clock_idempotency ON clock_entries(idempotency_key) WHERE idempotency_key IS NOT NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('clock_entries');
  await knex.raw('DROP TYPE IF EXISTS clock_source');
}
