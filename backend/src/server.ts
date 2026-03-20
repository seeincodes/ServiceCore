import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import logger from './shared/utils/logger';
import { initWebSocket } from './shared/websocket/socket';
import authRoutes from './auth/routes/auth.routes';
import clockRoutes from './time-tracking/routes/clock.routes';
import smsRoutes from './time-tracking/routes/sms.routes';
import dashboardRoutes from './time-tracking/routes/dashboard.routes';
import reportRoutes from './payroll/routes/report.routes';
import timesheetRoutes from './time-tracking/routes/timesheet.routes';
import dispatcherRoutes from './dispatcher/routes/dispatcher.routes';
import { startDispatcherPolling } from './dispatcher/services/dispatcher.service';
import { scheduleNightlySync } from './integration/services/quickbooks.service';

// Load environment-specific .env file, then fall back to .env
const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `../.env.${env}` });
dotenv.config({ path: '../.env' });

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize WebSocket
initWebSocket(httpServer);

app.use(helmet());
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((o) => o.trim());
app.use(
  cors({ origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins, credentials: true }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Input sanitization
import { sanitizeInput } from './shared/middleware/sanitize';
app.use(sanitizeInput);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/timesheets', clockRoutes);
app.use('/timesheets', timesheetRoutes);
app.use('/sms', smsRoutes);
app.use('/manager', dashboardRoutes);
app.use('/manager', reportRoutes);
app.use('/manager', timesheetRoutes);
app.use('/dispatcher', dispatcherRoutes);
// app.use('/admin', adminRoutes);

// Start server — run migrations in production only
const startServer = () => {
  httpServer.listen(PORT, () => {
    logger.info(`TimeKeeper API running on port ${PORT}`);
    startDispatcherPolling();
    scheduleNightlySync();
  });
};

if (env === 'production') {
  import('./shared/database/connection').then(({ default: db }) => {
    db.migrate
      .latest({
        directory: __dirname + '/shared/database/migrations',
        loadExtensions: ['.js'],
      })
      .then(async ([_batch, migrations]) => {
        if (migrations.length) {
          logger.info(`Migrations applied: ${migrations.length}`);
        } else {
          logger.info('Database is up to date');
        }

        const result = await db('orgs').count('id as count').first();
        if (Number(result?.count) === 0) {
          logger.info('Empty database detected, running seed...');
          await db.seed.run({
            directory: __dirname + '/shared/database/seeds/production',
            loadExtensions: ['.js'],
          });
          logger.info('Production seed complete');
        }

        startServer();
      })
      .catch((err) => {
        logger.error(`Migration failed: ${err.message}`);
        process.exit(1);
      });
  });
} else {
  startServer();
}

export default app;
