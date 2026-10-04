import Fastify from 'fastify';

import { config } from './config.ts';
import { healthRoutes } from './routes/health.ts';

export function buildApp() {
  const app = Fastify({ logger: { level: config.logLevel } });

  void app.register(healthRoutes);

  return app;
}
