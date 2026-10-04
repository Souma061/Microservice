import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../prisma/generated/client.ts';
import { config } from './config.ts';

const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({ adapter });
