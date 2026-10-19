import { z } from 'zod';
import { db } from '@/lib/db';
import { handle, HttpError } from '@/lib/http';
import { jsonValue, lockSurvey } from '@/lib/service';
import { collectionState, respondent } from '@/lib/collection';
import { validateAnswers, type Answers, type Question } from '@/lib/survey';
import { submissionBody, prepareAttachments } from '@/lib/attachment-server';
import { reserveUpload } from '@/lib/attachment-guard';
import { writeAttachment, removeAttachment } from '@/lib/attachment-storage';
import { withBasePath } from '@/lib/paths';
type Context = { params: Promise<{ shareId: string }> };
export function GET(req: Request, ctx: Context) { return handle(req, async () => {
  const s = await db.survey.findUnique({ where: { shareId: (await ctx.params).shareId }, select: { id: true, title: true, browserTitle: true, description: true, platform: true, background: true, showBranding: true, brandName: true, brandDescription: true, banner: true, bannerTitle: true, bannerSubtitle: true, status: true, startsAt: true, endsAt: true, maxResponses: true, browserLimit: true, ipLimit: true, content: true, shareId: true } });
  if (!s || s.status === 'DRAFT') throw new HttpError(404, '问卷不存在或尚未发布');
  const identity = await respondent(req, true);
  const state = await collectionState(db, s, identity);
  if (state.availability) return { title: s.title, browserTitle: s.browserTitle, status: s.status, startsAt: s.startsAt, showBranding: s.showBranding, brandName: s.brandName, brandDescription: s.brandDescription, ...state };
  return { ...s, bannerImage: s.banner === 'custom' ? withBasePath(`/api/surveys/${s.id}/banner`) : null };
}); }
export function POST(req: Request, ctx: Context) { return handle(req, async () => {
  const { shareId } = await ctx.params;
  const found = await db.survey.findUnique({ where: { shareId }, select: { id: true, status: true } });
  if (!found || found.status === 'DRAFT') throw new HttpError(404, '问卷不存在');
  const identity = await respondent(req);
  const releaseUpload = reserveUpload(req);
  try {
  const submission = await submissionBody(req);
  const input = z.object({ submissionKey: z.string().uuid(), answers: z.unknown() }).parse(submission.payload);
  const written: string[] = [];
  try { return await db.$transaction(async tx => {
    await lockSurvey(tx, found.id);
    const s = await tx.survey.findUnique({ where: { id: found.id } });
    if (!s || s.status === 'DRAFT') throw new HttpError(404, '问卷不存在或尚未发布');
    const prior = await tx.response.findUnique({ where: { surveyId_submissionKey: { surveyId: s.id, submissionKey: input.submissionKey } } });
    if (prior) return { ok: true, id: prior.id };
    const state = await collectionState(tx, s, identity);
    if (state.availability) throw new HttpError(409, state.availabilityMessage);
    const errors = validateAnswers(s.content as unknown as Question[], input.answers);
    if (Object.keys(errors).length) throw new HttpError(422, '请检查未完成的题目', errors);
    const prepared = await prepareAttachments(s.content as unknown as Question[], input.answers as Answers, submission.files);
    const stored = [];
    for (const { data, ...metadata } of prepared.attachments) {
      const file = await writeAttachment(data); written.push(file.storageKey);
      stored.push({ ...metadata, ...file });
    }
    const r = await tx.response.create({ data: { surveyId: s.id, submissionKey: input.submissionKey, answers: jsonValue(prepared.answers), ...identity, titleSnapshot: s.title, ...(stored.length ? { attachments: { create: stored } } : {}) } });
    return { ok: true, id: r.id };
  }, { timeout: 15000 }); }
  catch (error) {
    // A lost database connection can leave the commit outcome uncertain. Never
    // remove a file until the database confirms it has no committed reference.
    if (written.length) {
      try {
        const committed = new Set((await db.attachment.findMany({ where: { storageKey: { in: written } }, select: { storageKey: true } })).map(file => file.storageKey));
        await Promise.all(written.filter(key => !committed.has(key)).map(removeAttachment));
      } catch (cleanupError) { console.error('[attachment cleanup]', cleanupError); }
    }
    throw error;
  }
  } finally { releaseUpload(); }
}); }
