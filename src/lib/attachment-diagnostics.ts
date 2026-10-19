import { randomUUID } from 'node:crypto';

export type AttachmentDiagnostic = (event: string, details: Record<string, string | number | boolean | null>) => void;
let windowStart = 0, entries = 0;

export function attachmentDiagnostics(req: Request): { id: string; log: AttachmentDiagnostic } | null {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) return null;
  const id = randomUUID();
  const agent = req.headers.get('user-agent') || '';
  const platform = /Harmony|HUAWEI|Huawei/i.test(agent) ? 'huawei-harmony' : /iPhone|iPad/i.test(agent) ? 'ios' : /Android/i.test(agent) ? 'android' : 'other';
  return { id, log: (event, details) => {
    const now = Date.now();
    if (now - windowStart >= 60_000) { windowStart = now; entries = 0; }
    // Bound anonymous-request logging; never include filenames, answers or file bytes.
    if (++entries > 60) {
      if (entries === 61) console.warn('[attachment diagnostic]', JSON.stringify({ event: 'rate-limited', time: new Date(now).toISOString() }));
      return;
    }
    console.warn('[attachment diagnostic]', JSON.stringify({ ...details, event, requestId: id, platform, wechat: /MicroMessenger/i.test(agent), time: new Date(now).toISOString() }));
  } };
}
