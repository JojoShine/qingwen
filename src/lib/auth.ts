import type { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { HttpError } from './http';
export const sessionCookie = 'qingwen_session';
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const publicUser = { id: true, username: true, name: true, role: true, active: true } as const;
export async function currentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: digest(token) }, include: { user: { select: publicUser } } });
  return session && session.expiresAt > new Date() && session.user.active ? { ...session.user, isDemo: session.user.username === process.env.DEMO_USERNAME } : null;
}
export async function requireUser(admin = false) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, '请先登录');
  if (admin && user.role !== 'ADMIN') throw new HttpError(403, '需要管理员权限');
  return user;
}
export async function startSession(userId: string, tx: Prisma.TransactionClient = db) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await tx.session.create({ data: { tokenHash: digest(token), userId, expiresAt } });
  (await cookies()).set(sessionCookie, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires: expiresAt });
}
export async function endSession() {
  const jar = await cookies(); const token = jar.get(sessionCookie)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: digest(token) } });
  jar.delete(sessionCookie);
}
