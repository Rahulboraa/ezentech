import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.js';
import { customersRouter } from './routes/customers.js';
import { unitsRouter } from './routes/units.js';
import { productModelsRouter } from './routes/productModels.js';
import { auditRouter } from './routes/audit.js';
import { usersRouter } from './routes/users.js';
import { complaintsRouter } from './routes/complaints.js';
import { reportsRouter } from './routes/reports.js';

function resolveClientDist() {
  try {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  } catch {
    return path.resolve(process.cwd(), 'client/dist');
  }
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/customers', requireAuth, customersRouter);
  app.use('/api/units', requireAuth, unitsRouter);
  app.use('/api/product-models', requireAuth, productModelsRouter);
  app.use('/api/users', requireAuth, usersRouter);
  app.use('/api/complaints', requireAuth, complaintsRouter);
  app.use('/api/audit', requireAuth, auditRouter);
  app.use('/api/reports', requireAuth, reportsRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  const clientDist = resolveClientDist();
  app.use(express.static(clientDist));
  app.get('*splat', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

  app.use(errorHandler);
  return app;
}
