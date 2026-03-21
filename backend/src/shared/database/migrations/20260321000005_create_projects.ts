import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('projects', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    t.string('code').notNullable(); // e.g., "PRJ-001"
    t.string('name').notNullable(); // e.g., "Downtown Commercial Pickup"
    t.text('description').nullable();
    t.string('color').nullable(); // hex color for UI
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.unique(['org_id', 'code']);
    t.index(['org_id', 'is_active']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('projects');
}
