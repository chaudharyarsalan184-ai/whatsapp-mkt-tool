import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PORT, FRONTEND_URL } from './config/env.js';
import { initRedis } from './config/redis.js';
import { migrate } from './db/migrate.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startMessageWorker } from './services/queue.service.js';
import { initScheduler } from './services/scheduler.service.js';

import authRoutes from './routes/auth.routes.js';
import contactsRoutes from './routes/contacts.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import campaignsRoutes from './routes/campaigns.routes.js';
import automationRoutes from './routes/automation.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import inboxRoutes from './routes/inbox.routes.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use((req, res, next) => {
  if (req.originalUrl?.startsWith('/api/webhook')) {
    return next();
  }
  return limiter(req, res, next);
});
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/webhook', webhookRoutes);

app.use(errorHandler);

async function bootstrap() {
  await initRedis();
  await migrate();
  startMessageWorker();
  await initScheduler();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
