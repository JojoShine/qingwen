import { HttpError } from './http';
const state = globalThis as typeof globalThis & { attachmentUploads?: number };
export function reserveUpload(req: Request) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) return () => {};
  if ((state.attachmentUploads ?? 0) >= 4) throw new HttpError(429, '当前上传较多，请稍后重试');
  state.attachmentUploads = (state.attachmentUploads ?? 0) + 1;
  let released = false;
  return () => { if (!released) { released = true; state.attachmentUploads = Math.max(0, (state.attachmentUploads ?? 1) - 1); } };
}
