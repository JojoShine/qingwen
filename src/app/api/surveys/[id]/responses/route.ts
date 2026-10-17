import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { body, handle, HttpError } from '@/lib/http';
import { lockSurvey, ownedSurvey } from '@/lib/service';
export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, async () => {
  const user = await requireUser(), { id } = await ctx.params;
  const input = z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(100), isValid: z.boolean() }).parse(await body(req));
  const ids = [...new Set(input.ids)];
  return db.$transaction(async tx => {
    await lockSurvey(tx, id); await ownedSurvey(user, id, tx);
    if (await tx.response.count({ where: { surveyId: id, id: { in: ids } } }) !== ids.length) throw new HttpError(404, '答卷不存在');
    await tx.response.updateMany({ where: { surveyId: id, id: { in: ids } }, data: { isValid: input.isValid } });
    return { ok: true, count: ids.length };
  });
}); }
