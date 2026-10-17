import { z } from 'zod';
import { db } from '@/lib/db';
import { body, handle, HttpError } from '@/lib/http';
import { jsonValue, lockSurvey } from '@/lib/service';
import { collectionState, respondent } from '@/lib/collection';
import { validateAnswers, visibleAnswers, type Answers, type Question } from '@/lib/survey';
import { withBasePath } from '@/lib/paths';
type Context = { params: Promise<{ shareId: string }> };
export function GET(req: Request, ctx: Context) { return handle(req, async () => {
  const s = await db.survey.findUnique({ where: { shareId: (await ctx.params).shareId }, select: { id: true, title: true, description: true, platform: true, background: true, showBranding: true, brandName: true, brandDescription: true, banner: true, bannerTitle: true, bannerSubtitle: true, status: true, startsAt: true, endsAt: true, maxResponses: true, browserLimit: true, ipLimit: true, content: true, shareId: true } });
  if (!s || s.status === 'DRAFT') throw new HttpError(404, '问卷不存在或尚未发布');
  const identity = await respondent(req, true);
  const state = await collectionState(db, s, identity);
  if (state.availability) return { title: s.title, status: s.status, startsAt: s.startsAt, showBranding: s.showBranding, brandName: s.brandName, brandDescription: s.brandDescription, ...state };
  return { ...s, bannerImage: s.banner === 'custom' ? withBasePath(`/api/surveys/${s.id}/banner`) : null };
}); }
export function POST(req: Request, ctx: Context) { return handle(req, async () => {
  const { shareId } = await ctx.params;
  const input = z.object({ submissionKey: z.string().uuid(), answers: z.unknown() }).parse(await body(req));
  const found = await db.survey.findUnique({ where: { shareId }, select: { id: true } });
  if (!found) throw new HttpError(404, '问卷不存在');
  const identity = await respondent(req);
  return db.$transaction(async tx => {
    await lockSurvey(tx, found.id);
    const s = await tx.survey.findUnique({ where: { id: found.id } });
    if (!s || s.status === 'DRAFT') throw new HttpError(404, '问卷不存在或尚未发布');
    const prior = await tx.response.findUnique({ where: { surveyId_submissionKey: { surveyId: s.id, submissionKey: input.submissionKey } } });
    if (prior) return { ok: true, id: prior.id };
    const state = await collectionState(tx, s, identity);
    if (state.availability) throw new HttpError(409, state.availabilityMessage);
    const errors = validateAnswers(s.content as unknown as Question[], input.answers);
    if (Object.keys(errors).length) throw new HttpError(422, '请检查未完成的题目', errors);
    const r = await tx.response.create({ data: { surveyId: s.id, submissionKey: input.submissionKey, answers: jsonValue(visibleAnswers(s.content as unknown as Question[], input.answers as Answers)), ...identity, titleSnapshot: s.title } });
    return { ok: true, id: r.id };
  });
}); }
