import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle, HttpError } from '@/lib/http';
import { readAttachment } from '@/lib/attachment-storage';
import { previewableImage } from '@/lib/attachment';
export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, async () => {
  const user = await requireUser(); const { id } = await ctx.params;
  const file = await db.attachment.findFirst({ where: { id, ...(user.role === 'ADMIN' ? {} : { response: { survey: { ownerId: user.id } } }) }, select: { name: true, mime: true, storageKey: true, size: true, sha256: true } });
  if (!file) throw new HttpError(404, '附件不存在或无权访问');
  const preview = new URL(req.url).searchParams.get('preview') === '1' && previewableImage(file.mime);
  const name = encodeURIComponent(file.name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  let data: Buffer;
  try { data = await readAttachment(file); }
  catch (error) { console.error('[attachment read]', error); throw new HttpError(503, '附件文件缺失或损坏，请联系管理员从备份恢复'); }
  return new Response(new Uint8Array(data), { headers: {
    'Content-Type': file.mime,
    'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename="attachment"; filename*=UTF-8''${name}`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  } });
}); }
