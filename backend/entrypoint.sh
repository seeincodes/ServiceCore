#!/bin/sh
set -e

# Run migrations on startup (idempotent — safe to run every deploy)
echo "Running database migrations..."
node -e "
  const knex = require('knex')({
    client: 'pg',
    connection: process.env.DATABASE_URL,
  });
  knex.migrate.latest({ directory: './dist/shared/database/migrations' })
    .then(([batch, migrations]) => {
      if (migrations.length) {
        console.log('Migrations applied:', migrations);
      } else {
        console.log('Database is up to date.');
      }
      return knex.destroy();
    })
    .catch(err => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
"

echo "Starting server..."
exec node dist/server.js
