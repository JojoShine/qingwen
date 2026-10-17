import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { body, handle, HttpError } from '@/lib/http';
import { lockSurvey, ownedSurvey } from '@/lib/service';
import { withBasePath } from '@/lib/paths';
import { decodeBannerImage } from '@/lib/banner-image';
const schema = z.object({ qrLogoImage: z.string().max(100000).refine(v => !!decodeBannerImage(v), '请选择有效的 PNG、JPG 或 WebP Logo 图片').nullable() });
export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, async () => {
  const s = await ownedSurvey(await requireUser(), (await ctx.params).id);
  if (s.status === 'DRAFT') throw new HttpError(409, '请先发布问卷');
  const path = withBasePath(`/s/${s.shareId}`);
  return { url: process.env.APP_URL ? new URL(path, process.env.APP_URL).toString() : path, qrLogoImage: s.qrLogoImage ?? null };
}); }
export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, async () => {
  const user = await requireUser(); const { id } = await ctx.params; const input = schema.parse(await body(req));
  return db.$transaction(async tx => {
    await lockSurvey(tx, id); const survey = await ownedSurvey(user, id, tx);
    if (survey.status === 'DRAFT') throw new HttpError(409, '请先发布问卷');
    return tx.survey.update({ where: { id }, data: input, select: { qrLogoImage: true } });
  });
}); }
