import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser, endSession } from '@/lib/auth';
import { body, handle, HttpError } from '@/lib/http';
import { hashPassword, verifyPassword } from '@/lib/password';
export function PATCH(req: Request) { return handle(req, async () => {
  const actor = await requireUser();
  const input = z.object({ currentPassword: z.string().max(128), password: z.string().min(8, '新密码至少 8 位').max(128) }).parse(await body(req));
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!await verifyPassword(input.currentPassword, user.passwordHash)) throw new HttpError(422, '当前密码不正确');
  await db.$transaction([db.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(input.password) } }), db.session.deleteMany({ where: { userId: actor.id } })]);
  await endSession(); return { ok: true };
}); }
