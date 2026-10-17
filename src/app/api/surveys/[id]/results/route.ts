import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle, pagination } from '@/lib/http';
import { responseFilter } from '@/lib/response-filter';
import { ownedSurvey } from '@/lib/service';
import { summarize, type Question, type Answers } from '@/lib/survey';
export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, async () => {
  const user = await requireUser(); const { id } = await ctx.params; const survey = await ownedSurvey(user, id); const { page, pageSize } = pagination(req);
  const content = survey.content as unknown as Question[];
  const where = responseFilter(req, id, content);
  return db.$transaction(async tx => {
    const [items, all, validCount, invalidCount] = await Promise.all([
      tx.response.findMany({ where, omit: { browserHash: true, ipHash: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      tx.response.findMany({ where, select: { answers: true, createdAt: true, isValid: true }, orderBy: { createdAt: 'asc' } }),
      tx.response.count({ where: { surveyId: id, isValid: true } }), tx.response.count({ where: { surveyId: id, isValid: false } }),
    ]);
    const valid = all.filter(row => row.isValid);
    return { survey, items, total: all.length, validCount, invalidCount, pageSize, firstAt: all[0]?.createdAt, lastAt: all.at(-1)?.createdAt, summaries: Object.fromEntries(content.filter(q => q.type !== 'section').map(q => [q.id, summarize(q, valid.map(r => r.answers as unknown as Answers))])) };
  }, { isolationLevel: 'RepeatableRead' });
}); }
