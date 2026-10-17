import { z } from 'zod';
import { db } from '@/lib/db';
import { publicUser, requireUser } from '@/lib/auth';
import { body, handle, HttpError, pagination } from '@/lib/http';
import { hashPassword } from '@/lib/password';
export function GET(req: Request) { return handle(req, async () => {
  await requireUser(true); const { page, pageSize } = pagination(req);
  const [items, total] = await db.$transaction([db.user.findMany({ select: { ...publicUser, createdAt: true, _count: { select: { surveys: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), db.user.count()]);
  return { items, total, pageSize };
}); }
export function POST(req: Request) { return handle(req, async () => {
  await requireUser(true);
  const input = z.object({ username: z.string().regex(/^[a-zA-Z0-9_]{3,40}$/, '账号需为 3–40 位字母、数字或下划线'), name: z.string().trim().min(1).max(40), password: z.string().min(8, '密码至少 8 位').max(128) }).parse(await body(req));
  if (await db.user.findUnique({ where: { username: input.username } })) throw new HttpError(409, '账号已存在');
  return db.user.create({ data: { username: input.username, name: input.name, passwordHash: await hashPassword(input.password) }, select: publicUser });
}); }
