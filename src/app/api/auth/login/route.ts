import { z } from 'zod';
import { db } from '@/lib/db';
import { body, handle, HttpError } from '@/lib/http';
import { digest, publicUser, startSession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
const schema = z.object({ username: z.string().trim().min(1).max(40), password: z.string().min(1).max(128) });
const dummyHash = hashPassword('constant-time-dummy-password');
export function POST(req: Request) { return handle(req, async () => {
  const data = schema.parse(await body(req));
  const key = digest(data.username.toLowerCase()); const now = new Date();
  await db.loginAttempt.deleteMany({ where: { expiresAt: { lt: now } } });
  const attempt = await db.loginAttempt.upsert({ where: { key }, create: { key, count: 1, expiresAt: new Date(Date.now() + 15 * 60000) }, update: { count: { increment: 1 } } });
  if (attempt.count > 10) throw new HttpError(429, '尝试次数过多，请 15 分钟后重试');
  const found = await db.user.findUnique({ where: { username: data.username }, select: { id: true } });
  if (!found) { await verifyPassword(data.password, await dummyHash); throw new HttpError(401, '账号或密码错误'); }
  const user = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${found.id} FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id: found.id } });
    const valid = await verifyPassword(data.password, current?.passwordHash || await dummyHash);
    if (!current || !current.active || !valid) throw new HttpError(401, '账号或密码错误');
    await startSession(current.id, tx);
    return tx.user.findUnique({ where: { id: current.id }, select: publicUser });
  });
  await db.loginAttempt.deleteMany({ where: { key } });
  return user;
}); }
