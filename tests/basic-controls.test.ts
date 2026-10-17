import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { newQuestion } from '../src/lib/survey';
const run = process.env.RUN_INTEGRATION === '1', base = 'http://localhost:3218';
let ownerId = '', auth = '';
const q = newQuestion('single');
async function call(path: string, method = 'GET', data?: unknown, cookie = auth, extra: Record<string,string> = {}) {
  return fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie, ...extra }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
}
async function make(settings: Record<string,unknown> = {}, content = [q]) {
  const s = await (await call('/surveys', 'POST', { title: '基础能力接口验收' })).json();
  expect((await call(`/surveys/${s.id}`, 'PATCH', { content, ...settings })).status).toBe(200);
  expect((await call(`/surveys/${s.id}/action`, 'POST', { action: 'publish' })).status).toBe(200);
  return s;
}
const submission = (value = q.options[0].id) => ({ submissionKey: randomUUID(), answers: { [q.id]: { value } } });
describe.skipIf(!run)('basic controls on live PostgreSQL', () => {
  beforeAll(async () => {
    const username = `controls_${randomUUID().slice(0,8)}`;
    const user = await db.user.create({ data: { username, name: 'Controls test', passwordHash: await hashPassword('Testing!123456') } }); ownerId = user.id;
    const login = await call('/auth/login', 'POST', { username, password: 'Testing!123456' }, '');
    expect(login.status).toBe(200); auth = login.headers.get('set-cookie')!.split(';')[0];
  });
  afterAll(async () => { await db.survey.deleteMany({ where: { ownerId } }); await db.user.delete({ where: { id: ownerId } }); await db.$disconnect(); });
  it('enforces collection windows on GET and POST and validates merged settings', async () => {
    const future = new Date(Date.now()+86400000).toISOString();
    const s = await make({ startsAt: future });
    const config = await (await call(`/public/${s.shareId}`, 'GET', undefined, '')).json();
    expect(config.availability).toBe('NOT_STARTED');
    expect((await call(`/public/${s.shareId}`, 'POST', submission(), '')).status).toBe(409);
    expect((await call(`/surveys/${s.id}`, 'PATCH', { endsAt: new Date().toISOString() })).status).toBe(422);
    expect((await call(`/surveys/${s.id}`, 'PATCH', { startsAt: null, endsAt: new Date(Date.now()-1000).toISOString() })).status).toBe(200);
    expect((await call(`/public/${s.shareId}`, 'POST', submission(), '')).status).toBe(409);
  });
  it('serializes final quota and preserves idempotency after reaching the cap', async () => {
    const s = await make({ maxResponses: 1 });
    const a = submission(), b = submission();
    const res = await Promise.all([call(`/public/${s.shareId}`, 'POST', a, ''), call(`/public/${s.shareId}`, 'POST', b, '')]);
    expect(res.map(r=>r.status).sort()).toEqual([200,409]);
    const winner = res[0].status === 200 ? a : b;
    expect((await call(`/public/${s.shareId}`, 'POST', winner, '')).status).toBe(200);
    expect((await (await call(`/public/${s.shareId}`, 'GET', undefined, '')).json()).availability).toBe('FULL');
    expect(await db.response.count({ where: { surveyId: s.id } })).toBe(1);
  });
  it('sets a browser identifier, rejects cookie-less restricted submissions and concurrent repeats', async () => {
    const s = await make({ browserLimit: 1 });
    const config = await call(`/public/${s.shareId}`, 'GET', undefined, '');
    const browserCookie = config.headers.get('set-cookie')?.split(';')[0];
    expect(browserCookie).toContain('qingwen_respondent=');
    expect((await call(`/public/${s.shareId}`, 'POST', submission(), '')).status).toBe(409);
    const payload = submission();
    const res = await Promise.all([call(`/public/${s.shareId}`, 'POST', payload, browserCookie),call(`/public/${s.shareId}`, 'POST', submission(), browserCookie)]);
    expect(res.map(r=>r.status).sort()).toEqual([200,409]);
    const duplicate = await call(`/public/${s.shareId}`, 'GET', undefined, browserCookie);
    expect((await duplicate.json()).availability).toBe('LIMIT_REACHED');
    const fresh = await call(`/public/${s.shareId}`, 'GET', undefined, '');
    expect((await call(`/public/${s.shareId}`, 'POST', submission(), fresh.headers.get('set-cookie')!.split(';')[0])).status).toBe(200);
  });
  it('ignores forged proxy headers unless trusted IP header is explicitly configured', async () => {
    const s = await make();
    if (!process.env.TRUSTED_CLIENT_IP_HEADER) {
      expect((await call(`/surveys/${s.id}`, 'PATCH', { ipLimit: 1 })).status).toBe(422);
      await db.survey.update({ where: { id: s.id }, data: { ipLimit: 1 } });
      expect((await call(`/public/${s.shareId}`, 'POST', submission(), '', { 'x-real-ip': '192.0.2.1' })).status).toBe(409);
      expect((await call(`/surveys/${s.id}`, 'PATCH', { ipLimit: null })).status).toBe(200);
    }
    expect((await call(`/surveys/${s.id}`, 'PATCH', { maxResponses: 0 })).status).toBe(422);
  });
  it('discards hidden answers while enforcing conditions and input formats on the server', async () => {
    const phone = { ...newQuestion('text'), textFormat: 'phone' as const, showWhen: { questionId: q.id, optionId: q.options[0].id } };
    const s = await make({}, [q,phone]);
    const hidden = await call(`/public/${s.shareId}`, 'POST', { submissionKey: randomUUID(), answers: { [q.id]: { value: q.options[1].id }, [phone.id]: { value: 'forged hidden value' } } }, '');
    expect(hidden.status).toBe(200);
    const row = await db.response.findUnique({ where: { id: (await hidden.json()).id } });
    expect(row!.answers).not.toHaveProperty(phone.id);
    expect((await call(`/public/${s.shareId}`, 'POST', { ...submission(), answers: { [q.id]: { value: q.options[0].id }, [phone.id]: { value: 'bad' } } }, '')).status).toBe(422);
  });
  it('filters, invalidates and restores responses, aligning summaries and CSV with ownership protection', async () => {
    const s = await make();
    const first = await (await call(`/public/${s.shareId}`, 'POST', submission(), '')).json();
    await call(`/public/${s.shareId}`, 'POST', submission(q.options[1].id), '');
    const endpoint = `/surveys/${s.id}/responses`;
    expect((await call(endpoint, 'PATCH', { ids: [first.id], isValid: false })).status).toBe(200);
    const summary = await (await call(`/surveys/${s.id}/results`)).json();
    expect(summary.total).toBe(1); expect(summary.invalidCount).toBe(1); expect(summary.summaries[q.id].options[0].count).toBe(0);
    const filter = `validity=invalid&questionId=${q.id}&optionId=${q.options[0].id}`;
    expect((await (await call(`/surveys/${s.id}/results?${filter}`)).json()).total).toBe(1);
    expect(await (await call(`/surveys/${s.id}/export?${filter}`)).text()).toContain(q.options[0].label);
    expect(await (await call(`/surveys/${s.id}/export`)).text()).not.toContain(q.options[0].label);
    const other = await make();
    expect((await call(`/surveys/${other.id}/responses`, 'PATCH', { ids: [first.id], isValid: true })).status).toBe(404);
    expect((await call(`/surveys/${s.id}/results?from=bad`)).status).toBe(422);
    expect((await call(endpoint, 'PATCH', { ids: [first.id], isValid: true })).status).toBe(200);
    expect((await (await call(`/surveys/${s.id}/results`)).json()).total).toBe(2);
    await db.response.update({ where: { id: first.id }, data: { createdAt: new Date('2000-01-01T00:00:00Z') } });
    expect((await (await call(`/surveys/${s.id}/results?from=2026-01-01T00:00:00Z&to=2099-01-01T00:00:00Z`)).json()).total).toBe(1);
    expect((await call(`/surveys/${s.id}`, 'PATCH', { maxResponses: 10, startsAt: '2000-01-01T00:00:00Z' })).status).toBe(200);
    const clone = await (await call(`/surveys/${s.id}/action`, 'POST', { action: 'clone' })).json();
    expect(clone.startsAt).toBe('2000-01-01T00:00:00.000Z'); expect(clone.maxResponses).toBe(10); expect(clone.browserLimit).toBeNull();
  });
});
