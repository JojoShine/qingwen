import { randomBytes, createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';

type Settings = { status: string; startsAt: Date | null; endsAt: Date | null; maxResponses: number | null; browserLimit: number | null; ipLimit: number | null };
export const canLimitIp = () => !!process.env.TRUSTED_CLIENT_IP_HEADER?.trim();
export async function respondent(req: Request, create = false) {
  const jar = await cookies();
  let token = jar.get('qingwen_respondent')?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    token = create ? randomBytes(32).toString('base64url') : undefined;
    if (token) jar.set('qingwen_respondent', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 365 * 86400 });
  }
  const header = process.env.TRUSTED_CLIENT_IP_HEADER?.trim();
  const ip = header ? req.headers.get(header)?.trim() : undefined;
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  return { browserHash: token ? hash(token) : null, ipHash: ip && isIP(ip) ? hash(ip) : null };
}
export async function collectionState(tx: Prisma.TransactionClient, survey: Settings & { id: string }, identity: Awaited<ReturnType<typeof respondent>>, now = new Date()) {
  if (survey.status === 'CLOSED') return { availability: 'ENDED' as const, availabilityMessage: '问卷已结束' };
  if (survey.startsAt && now < survey.startsAt) return { availability: 'NOT_STARTED' as const, availabilityMessage: '问卷尚未开始' };
  if (survey.endsAt && now >= survey.endsAt) return { availability: 'ENDED' as const, availabilityMessage: '问卷已截止' };
  if (survey.maxResponses && await tx.response.count({ where: { surveyId: survey.id } }) >= survey.maxResponses) return { availability: 'FULL' as const, availabilityMessage: '问卷已收满，感谢你的关注' };
  if (survey.browserLimit && (!identity.browserHash || await tx.response.count({ where: { surveyId: survey.id, browserHash: identity.browserHash } }) >= survey.browserLimit)) return { availability: 'LIMIT_REACHED' as const, availabilityMessage: identity.browserHash ? '此浏览器已达到提交次数上限' : '请允许浏览器使用 Cookie，刷新页面后重新提交' };
  if (survey.ipLimit && (!identity.ipHash || await tx.response.count({ where: { surveyId: survey.id, ipHash: identity.ipHash } }) >= survey.ipLimit)) return { availability: 'LIMIT_REACHED' as const, availabilityMessage: identity.ipHash ? '当前网络地址已达到提交次数上限' : '当前网络地址暂时无法验证，请稍后重试' };
  return {};
}
