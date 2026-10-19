import { afterEach, expect, it, vi } from 'vitest';
import { api, ApiError } from '../src/lib/client';
afterEach(() => vi.restoreAllMocks());
it('keeps multipart boundaries browser-controlled and explains proxy upload limits', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>Request Entity Too Large</html>', { status: 413, headers: { 'Content-Type': 'text/html' } }));
  const form = new FormData(); form.append('file', new File(['hello'], 'file.txt'));
  await expect(api('/public/test', { method: 'POST', body: form })).rejects.toEqual(new ApiError('附件超过服务器请求上限，请减少文件大小后重试', 413));
  expect(new Headers(fetch.mock.calls[0][1]?.headers).has('Content-Type')).toBe(false);
});
