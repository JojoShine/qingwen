import { withBasePath } from '@/lib/paths';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { body, handle, pagination } from '@/lib/http';
export function GET(req: Request) { return handle(req, async () => {
  const actor = await requireUser(); const p = new URL(req.url).searchParams; const { page, pageSize } = pagination(req);
  const status = p.get('status'); const search = (p.get('search') || '').slice(0, 100);
  const owned = actor.role === 'ADMIN' ? {} : { ownerId: actor.id };
  const where: Prisma.SurveyWhereInput = { ...owned, ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}), ...(['DRAFT','ACTIVE','CLOSED'].includes(status || '') ? { status: status as 'DRAFT' | 'ACTIVE' | 'CLOSED' } : {}) };
  const [items, total, allCount, activeCount, draftCount, responses] = await db.$transaction([
    db.survey.findMany({ where, omit: { content: true, bannerImage: true }, include: { owner: { select: { name: true, username: true } }, _count: { select: { responses: true } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.survey.count({ where }), db.survey.count({ where: owned }), db.survey.count({ where: { ...owned, status: 'ACTIVE' } }), db.survey.count({ where: { ...owned, status: 'DRAFT' } }), db.response.count({ where: { survey: owned } }),
  ]);
  return { items: items.map(s => ({ ...s, bannerImage: s.banner === 'custom' ? withBasePath(`/api/surveys/${s.id}/banner`) : null })), total, pageSize, stats: { total: allCount, active: activeCount, draft: draftCount, responses } };
}); }
export function POST(req: Request) { return handle(req, async () => {
  const user = await requireUser();
  const data = z.object({ title: z.string().trim().min(1, '请输入问卷名称').max(100), platform: z.enum(['mobile','desktop']).default('mobile') }).parse(await body(req));
  return db.survey.create({ data: { ...data, ownerId: user.id } });
}); }
