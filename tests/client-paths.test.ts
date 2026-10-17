import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/client';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('client API deployment URLs', () => {
  it.each([['', '/api/surveys?page=2'], ['/surveys', '/surveys/api/surveys?page=2']])('requests API URLs under base path %s', async (basePath, expected) => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', basePath);
    const fetch = vi.fn().mockResolvedValue(Response.json({ total: 2 }));
    vi.stubGlobal('fetch', fetch);
    expect(await api('/surveys?page=2')).toEqual({ total: 2 });
    expect(fetch).toHaveBeenCalledWith(expected, expect.any(Object));
  });

  it.each([['', '/login'], ['/surveys', '/surveys/login']])('redirects expired sessions to the login URL under base path %s', async (basePath, expected) => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', basePath);
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: '登录已失效' }, { status: 401 })));
    await expect(api('/surveys')).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith(expected);
  });

  it.each(['/auth/login', '/public/share-id'])('keeps unauthorized requests to %s on the current page', async path => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/surveys');
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: '无法访问' }, { status: 401 })));
    await expect(api(path)).rejects.toBeInstanceOf(ApiError);
    expect(assign).not.toHaveBeenCalled();
  });
});
