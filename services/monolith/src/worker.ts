import { randomUUID } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { config } from './config.ts';
import { prisma } from './db.ts';
import { outPath, rawPath } from './storage.ts';

const workerId = `${process.pid}:${randomUUID().slice(0, 8)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ponytail: stub — swap for spawn('ffmpeg', ...) when renditions matter
async function makeRendition(src: string, dst: string) {
  await sleep(config.transcodeMs);
  await mkdir(path.dirname(dst), { recursive: true });
  await copyFile(src, dst);
}

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

  const candidate = await prisma.transcodeJob.findFirst({
    where: filter,
    orderBy: { createdAt: 'asc' },
  });
  if (!candidate) return null;

  const won = await prisma.transcodeJob.updateMany({
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

async function finish(jobId: string, videoId: string, ok: boolean) {
  const [jobStatus, videoStatus] = ok
    ? (['ready', 'ready'] as const)
    : (['failed', 'failed'] as const);
  await prisma.$transaction([
    prisma.transcodeJob.update({ where: { id: jobId }, data: { status: jobStatus } }),
    prisma.video.update({ where: { id: videoId }, data: { status: videoStatus } }),
  ]);
}

async function retry(jobId: string) {
  await prisma.transcodeJob.update({
    where: { id: jobId },
    data: { status: 'queued', claimedBy: null, claimedAt: null },
  });
}

async function runOnce(): Promise<boolean> {
  const jobId = await claim();
  if (!jobId) return false;

  const job = await prisma.transcodeJob.findUnique({
    where: { id: jobId },
    include: { video: true },
  });
  if (!job) return true;

  try {
    await makeRendition(rawPath(job.videoId), outPath(job.videoId));
    await finish(job.id, job.videoId, true);
  } catch (err) {
    console.error('[worker] job failed', err);
    if (job.attempts >= config.maxAttempts) {
      await finish(job.id, job.videoId, false);
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
