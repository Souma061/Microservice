import { buildApp } from './app.ts';
import { config } from './config.ts';
import { prisma } from './db.ts';

const app = buildApp();

const close = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.once('SIGINT', close);
process.once('SIGTERM', close);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
