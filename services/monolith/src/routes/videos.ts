import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import type { FastifyInstance } from "fastify";

import { prisma } from "../db.ts";
import { mediaUrl, rawDir, rawPath, storageKey } from "../storage.ts";

type VideoDto = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
  url: string | null;
};

const toDto = (v: {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: Date;
}): VideoDto => ({ ...v, url: v.status === "ready" ? mediaUrl(v.id) : null });

export async function videoRoutes(app: FastifyInstance) {
  app.post("/videos", async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.code(415).send({ error: "multipart/form-data required" });
    }

    let title = "";
    let ownerId = "anon";
    let data: Buffer | null = null;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        if (!part.mimetype.startsWith("video/")) {
          await part.toBuffer();
          return reply.code(415).send({ error: "only video/* accepted" });
        }
        data = await part.toBuffer();
      } else if (part.fieldname === "title") {
        title = String(part.value).slice(0, 200);
      } else if (part.fieldname === "ownerId") {
        ownerId = String(part.value).slice(0, 100);
      }
    }

    if (!data) return reply.code(400).send({ error: "file required" });
    if (!title) title = "untitled";

    const id = randomUUID();

    await prisma.video.create({
      data: { id, ownerId, title, storageKey: storageKey(id) },
    });

    try {
      await mkdir(rawDir(id), { recursive: true });
      await writeFile(rawPath(id), data);
    } catch (err) {
      await prisma.video.delete({ where: { id } }).catch(() => {});
      app.log.error(err);
      return reply.code(500).send({ error: "storage failed" });
    }

    await prisma.$transaction([
      prisma.video.update({ where: { id }, data: { status: "queued" } }),
      prisma.transcodeJob.create({ data: { videoId: id } }),
    ]);

    return reply.code(202).send({ videoId: id, status: "queued" });
  });

  app.get("/videos/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) return reply.code(404).send({ error: "not found" });
    return toDto(video);
  });

  app.get("/feed", async () => {
    const videos = await prisma.video.findMany({
      where: { status: "ready" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return videos.map(toDto);
  });
}
