import { mkdirSync } from 'node:fs';
import path from 'node:path';

import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { config } from './config.ts';
import { healthRoutes } from './routes/health.ts';
import { videoRoutes } from './routes/videos.ts';

export function buildApp() {
  const app = Fastify({ logger: { level: config.logLevel } });

  mkdirSync(config.storageRoot, { recursive: true });

  void app.register(multipart, {
    limits: { fileSize: 200 * 1024 * 1024, files: 1 },
  });

  void app.register(fastifyStatic, {
    root: path.resolve('public'),
    prefix: '/',
    index: ['index.html'],
  });

  void app.register(fastifyStatic, {
    root: path.resolve(config.storageRoot),
    prefix: '/media/',
    decorateReply: false,
    acceptRanges: true,
  });

  void app.register(healthRoutes);
  void app.register(videoRoutes);

  return app;
}
