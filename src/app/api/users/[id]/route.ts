import { z } from 'zod';
import { db } from '@/lib/db';
import { publicUser, requireUser } from '@/lib/auth';
import { body, handle, HttpError } from '@/lib/http';
import { hashPassword } from '@/lib/password';
export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) { return handle(req, async () => {
  await requireUser(true); const { id } = await ctx.params;
  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, '用户不存在');
  if (target.role === 'ADMIN') throw new HttpError(403, '管理员账号请在个人设置中修改');
  const input = z.object({ name: z.string().trim().min(1).max(40).optional(), active: z.boolean().optional(), password: z.string().min(8, '密码至少 8 位').max(128).optional() }).parse(await body(req));
  const data = { name: input.name, active: input.active, ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}) };
  return db.$transaction(async tx => {
    const user = await tx.user.update({ where: { id }, data, select: publicUser });
    if (input.active === false || input.password) await tx.session.deleteMany({ where: { userId: id } });
    return user;
  });
}); }
