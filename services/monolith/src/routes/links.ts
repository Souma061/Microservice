import type { FastifyInstance } from 'fastify';

import { randomCode } from '../code.ts';
import { prisma } from '../db.ts';
import { Prisma } from '../../prisma/generated/client.ts';

const CODE_ATTEMPTS = 3;

type LinkDto = {
  code: string;
  url: string;
  clickCount: number;
  createdAt: Date;
  short: string;
};

const toDto = (l: {
  code: string;
  url: string;
  clickCount: number;
  createdAt: Date;
}): LinkDto => ({ ...l, short: `/${l.code}` });

const parseUrl = (raw: unknown): URL | null => {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
};

export async function linkRoutes(app: FastifyInstance) {
  app.post('/links', async (req, reply) => {
    const body = (req.body ?? {}) as { url?: unknown; ownerId?: unknown };
    const url = parseUrl(body.url);
    if (!url) return reply.code(422).send({ error: 'a valid http(s) url is required' });

    const ownerId =
      typeof body.ownerId === 'string' ? body.ownerId.slice(0, 100) : 'anon';

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      try {
        const link = await prisma.link.create({
          data: { code: randomCode(), url: url.href, ownerId },
        });
        return reply.code(201).send(toDto(link));
      } catch (err) {
        const unique = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (!unique) throw err;
      }
    }
    return reply.code(503).send({ error: 'could not allocate a code' });
  });

  app.get('/links', async () => {
    const links = await prisma.link.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return links.map(toDto);
  });

  app.get<{ Params: { code: string } }>('/:code', async (req, reply) => {
    const link = await prisma.link.findUnique({
      where: { code: req.params.code },
    });
    if (!link) return reply.code(404).send({ error: 'not found' });

    // ponytail: analytics failing must not break the redirect — log and continue
    try {
      await prisma.$transaction([
        prisma.click.create({
          data: { linkId: link.id, referrer: referrer(req.headers.referer) },
        }),
        prisma.job.create({ data: { linkId: link.id } }),
      ]);
    } catch (err) {
      app.log.error(err, 'click log failed');
    }

    return reply.code(302).redirect(link.url);
  });
}

const referrer = (value: unknown) =>
  typeof value === 'string' ? value.slice(0, 500) : null;
