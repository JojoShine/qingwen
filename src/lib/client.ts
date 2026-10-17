'use client';
import { useCallback, useEffect, useState } from 'react';
import { withBasePath } from '@/lib/paths';
export class ApiError extends Error { constructor(message: string, public status: number, public fields?: Record<string, string>) { super(message); } }
export async function api<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await fetch(withBasePath('/api' + url), { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const result = await r.json();
  if (!r.ok) { if (r.status === 401 && !url.startsWith('/auth/login') && !url.startsWith('/public/')) window.location.assign(withBasePath('/login')); throw new ApiError(result.error || '请求失败，请重试', r.status, result.fields); }
  return result as T;
}
export function useLoad<T>(url: string) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(''); api<T>(url, { signal: controller.signal }).then(setData).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [url, version]);
  return { data, error, loading, reload, setData };
}
export const dateTime = (v?: string | Date) => v ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(v)) : '—';
