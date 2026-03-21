import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('work_zones', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    t.string('name').notNullable();
    t.enum('type', ['depot', 'route_start', 'job_site', 'landfill', 'transfer_station'])
      .notNullable()
      .defaultTo('depot');
    t.decimal('lat', 10, 7).notNullable();
    t.decimal('lon', 10, 7).notNullable();
    t.integer('radius_meters').notNullable().defaultTo(200);
    t.string('address').nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.index(['org_id', 'is_active']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('work_zones');
}
