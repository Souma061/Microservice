export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/app',
  workerIntervalMs: Number(process.env.WORKER_INTERVAL_MS ?? 500),
  leaseMs: Number(process.env.LEASE_MS ?? 30_000),
  maxAttempts: Number(process.env.MAX_ATTEMPTS ?? 3),
};
