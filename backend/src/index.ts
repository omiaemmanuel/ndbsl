import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'path';
import { config } from './config/index.js';
import { authenticate } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import procurementRouter from './routes/procurement.js';
import equipmentRouter from './routes/equipment.js';
import bookingsRouter from './routes/bookings.js';
import consumablesRouter from './routes/consumables.js';
import faultsRouter from './routes/faults.js';
import researchRouter from './routes/research.js';
import announcementsRouter from './routes/announcements.js';
import filesRouter from './routes/files.js';
import expenditureRouter from './routes/expenditure.js';
import auditRouter from './routes/audit.js';
import { startCronJobs } from './jobs/cron.js';
import notificationsRouter from './routes/notifications.js';
import weeklyReportsRouter from './routes/weekly-reports.js';
import { initPush } from './services/push.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json());
app.use(pinoHttp());

// Serve local uploads in dev
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Public routes
app.use('/api/auth', authRouter);
app.use('/api/research', researchRouter);
app.use('/api/announcements', announcementsRouter);

// All other routes require authentication
app.use('/api', authenticate);
app.use('/api/users', usersRouter);
app.use('/api/procurement', procurementRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/consumables', consumablesRouter);
app.use('/api/faults', faultsRouter);
app.use('/api/files', filesRouter);
app.use('/api/expenditure', expenditureRouter);
app.use('/api/audit', auditRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/weekly-reports', weeklyReportsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

initPush();

app.listen(config.port, () => {
  console.log(`NDBSL backend running on port ${config.port}`);
  startCronJobs();
});

export default app;
