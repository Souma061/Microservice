import { randomUUID } from 'node:crypto';

import { config } from './config.ts';
import { prisma } from './db.ts';

const workerId = `${process.pid}:${randomUUID().slice(0, 8)}`;

const claimable = (staleBefore: Date) => ({
  OR: [
    { status: 'queued' as const },
    { status: 'processing' as const, claimedAt: { lt: staleBefore } },
  ],
});

async function claim(): Promise<string | null> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - config.leaseMs);
  const filter = claimable(staleBefore);

  const candidate = await prisma.job.findFirst({
    where: filter,
    orderBy: { createdAt: 'asc' },
  });
  if (!candidate) return null;

  const won = await prisma.job.updateMany({
    where: { id: candidate.id, ...filter },
    data: {
      status: 'processing',
      claimedBy: workerId,
      claimedAt: now,
      attempts: { increment: 1 },
    },
  });

  return won.count === 1 ? candidate.id : null;
}

async function finish(jobId: string, ok: boolean) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: ok ? 'ready' : 'failed' },
  });
}

async function retry(jobId: string) {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'queued', claimedBy: null, claimedAt: null },
  });
}

async function runOnce(): Promise<boolean> {
  const jobId = await claim();
  if (!jobId) return false;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return true;

  try {
    // ponytail: COUNT(*) per job — O(clicks) per link. Coalesce one queued
    // job per link (or count from a cursor) if hot links make the queue lag.
    const clickCount = await prisma.click.count({
      where: { linkId: job.linkId },
    });
    await prisma.$transaction([
      prisma.link.update({
        where: { id: job.linkId },
        data: { clickCount },
      }),
      prisma.job.update({ where: { id: jobId }, data: { status: 'ready' } }),
    ]);
  } catch (err) {
    console.error('[worker] job failed', err);
    if (job.attempts >= config.maxAttempts) {
      await finish(job.id, false);
    } else {
      await retry(job.id);
    }
  }
  return true;
}

let busy = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    while (await runOnce()) {
      /* drain the queue before sleeping */
    }
  } catch (err) {
    console.error('[worker] tick failed', err);
  } finally {
    busy = false;
  }
}

console.log(`[worker] ${workerId} started`);
const timer = setInterval(() => void tick(), config.workerIntervalMs);

const stop = async () => {
  clearInterval(timer);
  await prisma.$disconnect();
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
