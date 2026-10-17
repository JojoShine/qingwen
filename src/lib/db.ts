import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDb.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || 'postgresql://survey:survey_local_dev@localhost:5436/survey', max: 10 }) });
if (process.env.NODE_ENV !== 'production') globalDb.prisma = db;
