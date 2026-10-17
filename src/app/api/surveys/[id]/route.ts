import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { body, handle, HttpError } from '@/lib/http';
import { jsonValue, lockSurvey, ownedSurvey } from '@/lib/service';
import { decodeBannerImage } from '@/lib/banner-image';
import { canLimitIp } from '@/lib/collection';
import { validateContent } from '@/lib/survey';
const limit = z.number().int().min(1).max(1000000).nullable().optional();
const schema = z.object({ startsAt: z.string().datetime({ offset: true }).nullable().optional(), endsAt: z.string().datetime({ offset: true }).nullable().optional(), maxResponses: limit, browserLimit: limit, ipLimit: limit, title: z.string().trim().min(1, '请输入问卷名称').max(100).optional(), description: z.string().max(2000).optional(), showBranding: z.boolean().optional(), brandName: z.string().max(40).optional(), brandDescription: z.string().max(120).optional(), platform: z.enum(['mobile','desktop']).optional(), background: z.enum(['none','mint','warm','blue','ink']).optional(), banner: z.enum(['none','mint','warm','blue','ink','custom']).optional(), bannerTitle: z.string().max(60).nullable().optional(), bannerSubtitle: z.string().max(80).nullable().optional(), bannerImage: z.string().max(700000).refine(v => !!decodeBannerImage(v), '请选择有效的 PNG、JPG 或 WebP 图片（压缩后不超过 512KB）').nullable().optional(), content: z.array(z.unknown()).max(100).optional() });
type Context = { params: Promise<{ id: string }> };
export function GET(req: Request, ctx: Context) { return handle(req, async () => ownedSurvey(await requireUser(), (await ctx.params).id)); }
export function PATCH(req: Request, ctx: Context) { return handle(req, async () => {
  const user = await requireUser(); const { id } = await ctx.params; const input = schema.parse(await body(req));
  return db.$transaction(async tx => {
    await lockSurvey(tx, id); const survey = await ownedSurvey(user, id, tx);
    const startsAt = input.startsAt === undefined ? survey.startsAt : input.startsAt ? new Date(input.startsAt) : null;
    const endsAt = input.endsAt === undefined ? survey.endsAt : input.endsAt ? new Date(input.endsAt) : null;
    if (startsAt && endsAt && startsAt >= endsAt) throw new HttpError(422, '截止时间必须晚于开始时间');
    if ((input.ipLimit === undefined ? survey.ipLimit : input.ipLimit) && !canLimitIp()) throw new HttpError(422, '当前环境暂不支持 IP 限制');
    if ((input.banner ?? survey.banner) === 'custom' && !(input.bannerImage === undefined ? survey.bannerImage : input.bannerImage)) throw new HttpError(422, '请先上传 Banner 图片');
    if (input.content && survey.publishedAt && !isDeepStrictEqual(input.content, survey.content)) throw new HttpError(409, '已发布问卷不能修改题目，请复制为新问卷');
    if (input.content?.length) { const errors = validateContent(input.content, false); if (Object.keys(errors).length) throw new HttpError(422, Object.values(errors)[0], errors); }
    return tx.survey.update({ where: { id }, data: { ...input, content: input.content === undefined ? undefined : jsonValue(input.content) } });
  });
}); }
export function DELETE(req: Request, ctx: Context) { return handle(req, async () => {
  const user = await requireUser(); const { id } = await ctx.params;
  return db.$transaction(async tx => { await lockSurvey(tx, id); await ownedSurvey(user, id, tx); await tx.survey.delete({ where: { id } }); return { ok: true }; });
}); }
