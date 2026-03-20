import { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const env = process.env.NODE_ENV || 'development';
const envFile = `.env.${env}`;
dotenv.config({ path: path.resolve(__dirname, '../../../../', envFile) });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') }); // fallback

const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: 'localhost',
      port: Number(process.env.DB_PORT) || 5433,
      database: 'timekeeper_dev',
      user: 'postgres',
      password: 'postgres',
    },
    migrations: {
      directory: path.resolve(__dirname, 'migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, 'seeds/development'),
      extension: 'ts',
    },
    pool: { min: 2, max: 10 },
  },
  test: {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: 'localhost',
      port: Number(process.env.DB_PORT) || 5433,
      database: 'timekeeper_test',
      user: 'postgres',
      password: 'postgres',
    },
    migrations: {
      directory: path.resolve(__dirname, 'migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, 'seeds/development'),
      extension: 'ts',
    },
    pool: { min: 2, max: 10 },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: path.resolve(__dirname, 'migrations'),
      extension: 'ts',
    },
    seeds: {
      directory: path.resolve(__dirname, 'seeds/production'),
      extension: 'ts',
    },
    pool: { min: 5, max: 30 },
  },
};

export default knexConfig;
module.exports = knexConfig;
