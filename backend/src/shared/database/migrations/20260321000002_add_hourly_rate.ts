import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.decimal('hourly_rate', 8, 2).nullable();
    t.decimal('ot_multiplier', 4, 2).defaultTo(1.5); // 1.5x for OT by default
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('hourly_rate');
    t.dropColumn('ot_multiplier');
  });
}
