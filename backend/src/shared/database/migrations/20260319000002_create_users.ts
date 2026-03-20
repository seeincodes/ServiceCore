import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('orgs').onDelete('CASCADE');
    table.string('email', 255).notNullable();
    table.string('phone', 20);
    table.string('password_hash', 255).notNullable();
    table.string('first_name', 100);
    table.string('last_name', 100);
    table.enu('role', ['employee', 'manager', 'payroll_admin', 'org_admin'], {
      useNative: true,
      enumName: 'user_role',
    }).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    table.unique(['org_id', 'email']);
  });

  await knex.schema.raw('CREATE INDEX idx_users_org_role ON users(org_id, role)');
  await knex.schema.raw('CREATE INDEX idx_users_phone ON users(phone)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS user_role');
}
