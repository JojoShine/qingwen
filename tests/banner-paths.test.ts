import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ requireUser: async () => ({ id: 'owner', role: 'ADMIN' }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'a'.repeat(43) }) }) }));
vi.mock('@/lib/db', () => {
  const survey = { id: 'survey-id', shareId: 'share-id', status: 'ACTIVE', banner: 'custom' };
  return { db: {
    survey: { findUnique: async () => survey, findMany: async () => [survey], count: async () => 1 },
    response: { count: async () => 0 },
    $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
  } };
});
import { GET as publicSurvey } from '@/app/api/public/[shareId]/route';
import { GET as surveyList } from '@/app/api/surveys/route';

afterEach(() => vi.unstubAllEnvs());

describe('banner URLs returned by API routes', () => {
  it.each([['', '/api/surveys/survey-id/banner'], ['/surveys', '/surveys/api/surveys/survey-id/banner']])('serves the public banner under base path %s', async (basePath, expected) => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', basePath);
    const response = await publicSurvey(new Request('https://tbtparent.me/api/public/share-id'), { params: Promise.resolve({ shareId: 'share-id' }) });
    expect(response.status).toBe(200);
    expect((await response.json()).bannerImage).toBe(expected);
  });

  it.each([['', '/api/surveys/survey-id/banner'], ['/surveys', '/surveys/api/surveys/survey-id/banner']])('serves list thumbnails under base path %s', async (basePath, expected) => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', basePath);
    const response = await surveyList(new Request('https://tbtparent.me/api/surveys'));
    expect(response.status).toBe(200);
    expect((await response.json()).items[0].bannerImage).toBe(expected);
  });
});
