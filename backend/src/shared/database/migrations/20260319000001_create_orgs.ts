import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('orgs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('slug', 100).unique().notNullable();
    table.jsonb('branding').defaultTo('{}');
    table.jsonb('config').defaultTo(JSON.stringify({
      ot_rules: 'federal',
      work_week_start: 'monday',
      approval_required: true,
    }));
    table.string('stripe_customer_id', 255);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('orgs');
}
