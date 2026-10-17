import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({ schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' }, datasource: { url: process.env.DATABASE_URL ?? 'postgresql://survey:survey_local_dev@localhost:5436/survey' } });
