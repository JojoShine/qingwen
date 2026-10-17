import 'dotenv/config';
import { existsSync } from 'node:fs';
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH || (existsSync(localChrome) ? localChrome : undefined);
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '**/*.spec.ts', timeout: 90000, fullyParallel: false, workers: 1, use: { baseURL: 'http://localhost:3218', actionTimeout: 10000, trace: 'retain-on-failure', launchOptions: chromePath ? { executablePath: chromePath } : {} }, reporter: 'list' });
