import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { body, handle, HttpError } from '@/lib/http';
import { jsonValue, lockSurvey, ownedSurvey } from '@/lib/service';
import { validateContent } from '@/lib/survey';
export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, async () => {
  const user = await requireUser(); const { id } = await ctx.params;
  const { action } = z.object({ action: z.enum(['publish','close','resume','clone']) }).parse(await body(req));
  return db.$transaction(async tx => {
    await lockSurvey(tx, id); const s = await ownedSurvey(user, id, tx);
    if (action === 'clone') return tx.survey.create({ data: { ownerId: user.id, title: `${s.title.slice(0, 95)} · 副本`, description: s.description, browserTitle: s.browserTitle, platform: s.platform, background: s.background, startsAt: s.startsAt, endsAt: s.endsAt, maxResponses: s.maxResponses, browserLimit: s.browserLimit, ipLimit: s.ipLimit, showBranding: s.showBranding, brandName: s.brandName, brandDescription: s.brandDescription, banner: s.banner, bannerTitle: s.bannerTitle, bannerSubtitle: s.bannerSubtitle, bannerImage: s.bannerImage, qrLogoImage: s.qrLogoImage, content: jsonValue(s.content) } });
    if (action === 'publish') {
      if (s.status !== 'DRAFT') throw new HttpError(409, '该问卷已经发布');
      const errors = validateContent(s.content); if (Object.keys(errors).length) throw new HttpError(422, Object.values(errors)[0], errors);
      return tx.survey.update({ where: { id }, data: { status: 'ACTIVE', publishedAt: new Date() } });
    }
    if (action === 'close' && s.status !== 'ACTIVE') throw new HttpError(409, '只有收集中的问卷可以结束');
    if (action === 'resume' && s.status !== 'CLOSED') throw new HttpError(409, '只有已结束的问卷可以恢复');
    return tx.survey.update({ where: { id }, data: { status: action === 'close' ? 'CLOSED' : 'ACTIVE' } });
  });
}); }
