import { requireUser } from '@/lib/auth';
import { handle, HttpError } from '@/lib/http';
import { ownedSurvey } from '@/lib/service';
export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, async () => {
  const s = await ownedSurvey(await requireUser(), (await ctx.params).id);
  if (s.status === 'DRAFT') throw new HttpError(409, '请先发布问卷');
  const path = `/s/${s.shareId}`;
  return { url: process.env.APP_URL ? new URL(path, process.env.APP_URL).toString() : path };
}); }
