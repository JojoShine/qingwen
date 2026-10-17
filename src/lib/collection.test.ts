import { afterEach, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
const jar = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => jar }));
import { collectionState, respondent } from './collection';
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it('only reads the configured trusted single IP header and rejects invalid or multi-value addresses', async () => {
  vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', '');
  expect((await respondent(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.1' } }))).ipHash).toBeNull();
  vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'x-real-ip');
  const valid = await respondent(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.1', 'x-forwarded-for': '192.0.2.100' } }));
  expect(valid.ipHash).toMatch(/^[a-f0-9]{64}$/);
  expect((await respondent(new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.1, 192.0.2.2' } }))).ipHash).toBeNull();
  expect((await respondent(new Request('http://localhost', { headers: { 'x-real-ip': 'bad' } }))).ipHash).toBeNull();
});
it('refuses unverifiable IP submissions and applies configured per-IP limits', async () => {
  const count = vi.fn().mockResolvedValue(1);
  const tx = { response: { count } } as unknown as Prisma.TransactionClient;
  const survey = { id: 'survey', status: 'ACTIVE', startsAt: null, endsAt: null, maxResponses: null, browserLimit: null, ipLimit: 1 };
  expect((await collectionState(tx, survey, { browserHash: null, ipHash: null })).availability).toBe('LIMIT_REACHED');
  expect(count).not.toHaveBeenCalled();
  expect((await collectionState(tx, survey, { browserHash: null, ipHash: 'hash' })).availability).toBe('LIMIT_REACHED');
  expect(count).toHaveBeenCalledWith({ where: { surveyId: 'survey', ipHash: 'hash' } });
});
