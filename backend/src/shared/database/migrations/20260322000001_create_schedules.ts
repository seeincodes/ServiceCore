import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shift_templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    t.string('name', 100).notNullable();
    t.time('shift_start').notNullable();
    t.time('shift_end').notNullable();
    t.uuid('project_id').nullable().references('id').inTable('projects').onDelete('SET NULL');
    t.string('route_id', 50).nullable();
    t.string('color', 20).nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('schedules', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.date('date').notNullable();
    t.uuid('project_id').nullable().references('id').inTable('projects').onDelete('SET NULL');
    t.string('route_id', 50).nullable();
    t.time('shift_start').nullable();
    t.time('shift_end').nullable();
    t.uuid('template_id')
      .nullable()
      .references('id')
      .inTable('shift_templates')
      .onDelete('SET NULL');
    t.text('notes').nullable();
    t.timestamps(true, true);
    t.unique(['org_id', 'user_id', 'date']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('schedules');
  await knex.schema.dropTableIfExists('shift_templates');
}
