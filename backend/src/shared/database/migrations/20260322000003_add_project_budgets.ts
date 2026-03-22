import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (t) => {
    t.decimal('budgeted_hours', 10, 2).nullable();
    t.decimal('budget_amount', 12, 2).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (t) => {
    t.dropColumn('budgeted_hours');
    t.dropColumn('budget_amount');
  });
}
