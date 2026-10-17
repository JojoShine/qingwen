import type { Prisma } from '@prisma/client';
import { db } from './db';
import { HttpError } from './http';
import { canLimitIp } from './collection';
import { canManage } from './permissions';
export type Actor = { id: string; role: string; active: boolean };
export async function ownedSurvey(user: Actor, id: string, tx: Prisma.TransactionClient = db) {
  const survey = await tx.survey.findUnique({ where: { id }, include: { owner: { select: { name: true, username: true } }, _count: { select: { responses: true } } } });
  if (!survey || !canManage(user, survey.ownerId)) throw new HttpError(404, '问卷不存在');
  return { ...survey, canLimitIp: canLimitIp() };
}
export async function lockSurvey(tx: Prisma.TransactionClient, id: string) { await tx.$queryRaw`SELECT id FROM "Survey" WHERE id = ${id} FOR UPDATE`; }
export const jsonValue = (v: unknown) => v as Prisma.InputJsonValue;
