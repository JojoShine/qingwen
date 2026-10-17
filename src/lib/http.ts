import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) { super(message); }
}
export async function body(req: Request): Promise<unknown> {
  if (!req.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, '请使用 JSON 提交');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, '请求内容为空');
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1_000_000) { await reader.cancel(); throw new HttpError(413, '提交内容过大'); } chunks.push(value); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, '请求格式无效'); }
}
export async function handle(req: Request, fn: () => Promise<unknown>) {
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.get('origin');
      const requestUrl = new URL(req.url);
      const requestOrigin = req.headers.get('host') ? new URL(`${requestUrl.protocol}//${req.headers.get('host')}`).origin : requestUrl.origin;
      const allowed = [requestOrigin, ...(process.env.APP_URL ? [new URL(process.env.APP_URL).origin] : [])];
      if ((origin && !allowed.includes(origin)) || req.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, '请求来源无效');
    }
    const result = await fn();
    return result instanceof Response ? result : NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message, fields: e.fields }, { status: e.status });
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message || '输入内容无效' }, { status: 422 });
    console.error('[API]', e);
    return NextResponse.json({ error: '服务暂时不可用，请稍后重试' }, { status: 500 });
  }
}
export function pagination(req: Request) { const p = new URL(req.url).searchParams; return { page: Math.max(1, Math.min(100000, Number(p.get('page')) || 1)), pageSize: 12 }; }
