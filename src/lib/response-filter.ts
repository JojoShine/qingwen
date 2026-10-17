import type { Prisma } from '@prisma/client';
import { HttpError } from './http';
import type { Question } from './survey';

export function responseFilter(req: Request, surveyId: string, content: Question[]): Prisma.ResponseWhereInput {
  const params = new URL(req.url).searchParams;
  const validity = params.get('validity') || 'valid';
  if (!['valid','invalid','all'].includes(validity)) throw new HttpError(422, '答卷状态无效');
  const date = (name: string) => {
    const value = params.get(name);
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) throw new HttpError(422, '筛选时间无效');
    return new Date(value);
  };
  const from = date('from'), to = date('to');
  if (from && to && from > to) throw new HttpError(422, '结束时间不能早于开始时间');
  const questionId = params.get('questionId'), optionId = params.get('optionId');
  const where: Prisma.ResponseWhereInput = { surveyId, ...(validity === 'all' ? {} : { isValid: validity === 'valid' }), ...(from || to ? { createdAt: { gte: from, lte: to } } : {}) };
  if (questionId || optionId) {
    const q = content.find(q => q.id === questionId && ['single','multiple','select'].includes(q.type));
    if (!q || !optionId || !(q.options.some(o => o.id === optionId) || (q.other && q.type !== 'select' && optionId === '__other'))) throw new HttpError(422, '请选择有效的筛选题目与选项');
    where.answers = { path: [q.id, 'value'], ...(q.type === 'multiple' ? { array_contains: [optionId] } : { equals: optionId }) };
  }
  return where;
}
