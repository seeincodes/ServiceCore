import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add project_id to work_zones (routes can belong to a project)
  await knex.schema.alterTable('work_zones', (t) => {
    t.uuid('project_id').nullable().references('id').inTable('projects');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('work_zones', (t) => {
    t.dropColumn('project_id');
  });
}
