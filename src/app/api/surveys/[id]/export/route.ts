import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle } from '@/lib/http';
import { responseFilter } from '@/lib/response-filter';
import { ownedSurvey } from '@/lib/service';
import { buildCsv, type Question, type Answers } from '@/lib/survey';
export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, async () => {
  const s = await ownedSurvey(await requireUser(), (await ctx.params).id);
  const responses = await db.response.findMany({ where: responseFilter(req, s.id, s.content as unknown as Question[]), orderBy: { createdAt: 'desc' } });
  return new Response(buildCsv(s.content as unknown as Question[], responses.map(r => ({ ...r, answers: r.answers as unknown as Answers }))), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="survey-results.csv"; filename*=UTF-8''${encodeURIComponent(s.title)}.csv`, 'Cache-Control': 'no-store' } });
}); }
