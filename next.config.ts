import type { NextConfig } from 'next';
const config: NextConfig = { basePath: process.env.NEXT_PUBLIC_BASE_PATH || '', output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined, poweredByHeader: false, devIndicators: false, allowedDevOrigins: process.env.APP_URL ? [new URL(process.env.APP_URL).hostname] : [], serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'] };
export default config;
