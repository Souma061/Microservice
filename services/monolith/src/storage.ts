import path from 'node:path';

import { config } from './config.ts';

const dir = (...segments: string[]) =>
  path.join(config.storageRoot, ...segments);

export const rawDir = (id: string) => dir('raw', id);
export const outDir = (id: string) => dir('out', id);

export const rawPath = (id: string) => path.join(rawDir(id), 'source.mp4');
export const outPath = (id: string) => path.join(outDir(id), '720p.mp4');

export const storageKey = (id: string) => `raw/${id}/source.mp4`;
export const mediaUrl = (id: string) => `/media/out/${id}/720p.mp4`;
