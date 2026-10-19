import { afterEach, expect, it, vi } from 'vitest';
import { attachmentDiagnostics } from '../src/lib/attachment-diagnostics';
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('correlates multipart events without logging raw headers or answers', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(attachmentDiagnostics(new Request('http://localhost', { method: 'POST', body: '{}' }))).toBeNull();
  const diagnostic = attachmentDiagnostics(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=test', 'User-Agent': 'OpenHarmony MicroMessenger private-device-value', Cookie: 'private-cookie' }, body: 'private-answer' }))!;
  diagnostic.log('submission-parsed', { fileCount: 1 });
  diagnostic.log('submission-rejected', { status: 422 });
  const records = warn.mock.calls.map(call => JSON.parse(call[1]));
  expect(records).toHaveLength(2);
  expect(records[0]).toMatchObject({ requestId: diagnostic.id, platform: 'huawei-harmony', wechat: true, fileCount: 1 });
  expect(records[1]).toMatchObject({ requestId: diagnostic.id, status: 422 });
  expect(JSON.stringify(warn.mock.calls)).not.toMatch(/private-/);
});

it('bounds log volume from anonymous requests and resumes in the next window', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const diagnostic = attachmentDiagnostics(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=test' } }))!;
  for (let i = 0; i < 100; i++) diagnostic.log('submission-rejected', { status: 422 });
  expect(warn).toHaveBeenCalledTimes(61);
  expect(JSON.parse(warn.mock.calls[60][1]).event).toBe('rate-limited');
  vi.advanceTimersByTime(60_000);
  diagnostic.log('submission-rejected', { status: 422 });
  expect(warn).toHaveBeenCalledTimes(62);
});
