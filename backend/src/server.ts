import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import logger from './shared/utils/logger';
import authRoutes from './auth/routes/auth.routes';
import clockRoutes from './time-tracking/routes/clock.routes';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/timesheets', clockRoutes);
// app.use('/manager', managerRoutes);
// app.use('/admin', adminRoutes);

app.listen(PORT, () => {
  logger.info(`TimeKeeper API running on port ${PORT}`);
});

export default app;
