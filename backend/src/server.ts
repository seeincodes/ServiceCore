import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import logger from './shared/utils/logger';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200', credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes will be mounted here as services are built
// app.use('/auth', authRoutes);
// app.use('/timesheets', timeTrackingRoutes);
// app.use('/manager', managerRoutes);
// app.use('/admin', adminRoutes);

app.listen(PORT, () => {
  logger.info(`TimeKeeper API running on port ${PORT}`);
});

export default app;
