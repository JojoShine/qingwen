import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/auth', () => ({ requireUser: async () => ({ id: 'owner', role: 'ADMIN', active: true }) }));
vi.mock('@/lib/service', () => ({ ownedSurvey: vi.fn() }));
import { GET } from '../src/app/api/surveys/[id]/share/route';
import { ownedSurvey } from '@/lib/service';

describe('share URL configuration', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
    vi.mocked(ownedSurvey).mockResolvedValue({ status: 'ACTIVE', shareId: 'published-survey' } as Awaited<ReturnType<typeof ownedSurvey>>);
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(['http://localhost:3218', 'http://192.0.2.10:8080', 'https://survey.example.com', 'http://[::1]:3218'])('leaves the origin to the browser when accessed through %s', async origin => {
    const response = await GET(new Request(`${origin}/api/surveys/id/share`), { params: Promise.resolve({ id: 'id' }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: '/s/published-survey' });
  });

  it('uses an explicit public origin instead of the internal request address', async () => {
    vi.stubEnv('APP_URL', 'https://forms.example.com:8443');
    const response = await GET(new Request('http://app:3000/api/surveys/id/share'), { params: Promise.resolve({ id: 'id' }) });
    expect(await response.json()).toEqual({ url: 'https://forms.example.com:8443/s/published-survey' });
  });

  it('still refuses to share drafts', async () => {
    vi.mocked(ownedSurvey).mockResolvedValue({ status: 'DRAFT', shareId: 'draft' } as Awaited<ReturnType<typeof ownedSurvey>>);
    const response = await GET(new Request('http://localhost/api/surveys/id/share'), { params: Promise.resolve({ id: 'id' }) });
    expect(response.status).toBe(409);
  });

  it.each(['', 'https://tbtparent.me', 'https://tbtparent.me/surveys'])('includes the deployment prefix once when APP_URL is %s', async appUrl => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/surveys');
    vi.stubEnv('APP_URL', appUrl);
    const response = await GET(new Request('http://app:3218/surveys/api/surveys/id/share'), { params: Promise.resolve({ id: 'id' }) });
    expect(await response.json()).toEqual({ url: `${appUrl ? 'https://tbtparent.me' : ''}/surveys/s/published-survey` });
  });
});
