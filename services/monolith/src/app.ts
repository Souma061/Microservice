import path from 'node:path';

import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { config } from './config.ts';
import { healthRoutes } from './routes/health.ts';
import { linkRoutes } from './routes/links.ts';

export function buildApp() {
  const app = Fastify({ logger: { level: config.logLevel } });

  void app.register(fastifyStatic, {
    root: path.resolve('public'),
    prefix: '/',
    index: ['index.html'],
  });

  // `/:code` (parametric) outranks the static wildcard, so "/" would otherwise
  // resolve as an empty short code. Pin the index explicitly.
  app.get('/', (_req, reply) => reply.sendFile('index.html'));

  void app.register(healthRoutes);
  void app.register(linkRoutes);

  return app;
}
