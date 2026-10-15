import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { sql } from 'drizzle-orm';
import { env } from './config/env.js';
import { db } from './db/client.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { adminRouter } from './routes/admin/index.js';
import { authRouter } from './routes/auth.js';
import { bibleRouter } from './routes/bible.js';
import { contentRouter } from './routes/content.js';
import { meRouter } from './routes/me.js';
import { plansRouter } from './routes/plans.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
  app.use(cors({ origin: origins.includes('*') ? true : origins }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/health', async (_req, res) => {
    await db.execute(sql`select 1`);
    res.json({ status: 'ok', version: 'Louis Segond 1910' });
  });

  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/', bibleRouter);
  api.use('/', contentRouter);
  api.use('/', plansRouter);
  api.use('/me', meRouter);
  api.use('/admin', adminRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
