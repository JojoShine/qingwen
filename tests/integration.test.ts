import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { newQuestion } from '../src/lib/survey';

const run = process.env.RUN_INTEGRATION === '1';
const base = process.env.TEST_BASE_URL || 'http://localhost:3218';
let cookie = '', userId = '', surveyId = '', shareId = '', otherId = '', q = newQuestion('single');
const username = `test_${randomUUID().slice(0, 8)}`;
async function call(path: string, method = 'GET', body?: unknown, token = cookie) {
  return fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', Origin: base, Cookie: token }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
describe.skipIf(!run)('live PostgreSQL API', () => {
  beforeAll(async () => {
    const u = await db.user.create({ data: { username, name: 'API test', passwordHash: await hashPassword('Testing!123456') } }); userId = u.id;
    const other = await db.user.create({ data: { username: username + '_other', name: 'Other', passwordHash: await hashPassword('Testing!123456') } }); otherId = other.id;
    const login = await call('/auth/login', 'POST', { username, password: 'Testing!123456' }, '');
    expect(login.status).toBe(200); cookie = login.headers.get('set-cookie')!.split(';')[0];
    const create = await call('/surveys', 'POST', { title: 'Integration survey' });
    const s = await create.json(); surveyId = s.id; shareId = s.shareId;
    q = newQuestion('single');
  });
  afterAll(async () => {
    await db.survey.deleteMany({ where: { ownerId: { in: [userId, otherId] } } });
    await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await db.$disconnect();
  });
  it('denies ordinary user administrative access and unknown survey ownership', async () => {
    expect((await call('/users')).status).toBe(403);
    const s = await db.survey.create({ data: { ownerId: otherId, title: 'Secret' } });
    expect((await call(`/surveys/${s.id}`)).status).toBe(404);
    expect((await call(`/surveys/${s.id}/results`)).status).toBe(404);
    expect((await call(`/surveys/${s.id}/export`)).status).toBe(404);
    expect((await call(`/surveys/${s.id}`, 'PATCH', { title: 'hijacked' })).status).toBe(404);
  });
  it('saves banner images and editable captions without exposing draft images', async () => {
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=';
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { banner: 'custom', bannerImage: image, bannerTitle: '欢迎分享你的想法', bannerSubtitle: 'YOUR VOICE' })).status).toBe(200);
    const saved = await (await call(`/surveys/${surveyId}`)).json();
    expect(saved.bannerImage).toBe(image); expect(saved.bannerTitle).toBe('欢迎分享你的想法');
    expect((await call(`/surveys/${surveyId}/banner`)).headers.get('content-type')).toBe('image/png');
    expect([401,404]).toContain((await call(`/surveys/${surveyId}/banner`, 'GET', undefined, '')).status);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { bannerImage: 'data:image/svg+xml;base64,PHN2Zy8+' })).status).toBe(422);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { bannerImage: 'data:image/png;base64,aW52YWxpZA==' })).status).toBe(422);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { bannerImage: null })).status).toBe(422);
  });
  it('defaults to showing branding and persists an explicit boolean visibility setting', async () => {
    const initial = await (await call(`/surveys/${surveyId}`)).json();
    expect(initial.showBranding).toBe(true);
    expect(initial.brandName).toBe('轻问.'); expect(initial.brandDescription).toBe('提供支持，让每一份回答都有价值');
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { brandName: '知行研究', brandDescription: '' })).status).toBe(200);
    expect((await (await call(`/surveys/${surveyId}`)).json()).brandDescription).toBe('');
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { brandName: '知行研究', brandDescription: '你的反馈，让产品更好' })).status).toBe(200);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { brandName: '字'.repeat(41) })).status).toBe(422);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { brandDescription: '字'.repeat(121) })).status).toBe(422);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { brandName: 123 })).status).toBe(422);
    const save = await call(`/surveys/${surveyId}`, 'PATCH', { showBranding: false });
    expect(save.status).toBe(200); expect((await save.json()).showBranding).toBe(false);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { showBranding: 'false' })).status).toBe(422);
    expect((await (await call(`/surveys/${surveyId}`)).json()).showBranding).toBe(false);
  });
  it('stores optional browser titles and validates their length', async () => {
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { browserTitle: '  用户体验反馈  ' })).status).toBe(200);
    expect((await (await call(`/surveys/${surveyId}`)).json()).browserTitle).toBe('用户体验反馈');
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { browserTitle: '字'.repeat(101) })).status).toBe(422);
  });
  it('hides drafts, validates publication and locks the published structure', async () => {
    expect((await call(`/public/${shareId}`, 'GET', undefined, '')).status).toBe(404);
    expect((await call(`/surveys/${surveyId}/action`, 'POST', { action: 'publish' })).status).toBe(422);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { content: [q] })).status).toBe(200);
    expect((await call(`/surveys/${surveyId}/action`, 'POST', { action: 'publish' })).status).toBe(200);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { content: [{ ...q, title: 'changed' }] })).status).toBe(409);
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { content: [q], banner: 'warm' })).status).toBe(200);
    expect((await call(`/public/${shareId}`, 'GET', undefined, '')).status).toBe(200);
  });
  it('serves the saved custom banner on published surveys without embedding image data in listings', async () => {
    expect((await call(`/surveys/${surveyId}`, 'PATCH', { banner: 'custom', background: 'blue' })).status).toBe(200);
    const published = await (await call(`/public/${shareId}`, 'GET', undefined, '')).json();
    expect(published.browserTitle).toBe('用户体验反馈');
    expect(published.showBranding).toBe(false);
    expect(published.brandName).toBe('知行研究'); expect(published.brandDescription).toBe('你的反馈，让产品更好');
    expect(published.bannerTitle).toBe('欢迎分享你的想法'); expect(published.background).toBe('blue');
    expect(published.bannerImage).toBe(`/api/surveys/${surveyId}/banner`);
    const image = await call(`/surveys/${surveyId}/banner`, 'GET', undefined, '');
    expect(image.status).toBe(200); expect(image.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await image.arrayBuffer()).slice(0,4)).toEqual(new Uint8Array([137,80,78,71]));
    const listing = await (await call('/surveys')).json();
    expect(listing.items.find((s: { id: string }) => s.id === surveyId).bannerImage).toBe(`/api/surveys/${surveyId}/banner`);
  });
  it('validates answers and saves repeated submissions just once', async () => {
    const path = `/public/${shareId}`;
    expect((await call(path, 'POST', { submissionKey: randomUUID(), answers: {} }, '')).status).toBe(422);
    const payload = { submissionKey: randomUUID(), answers: { [q.id]: { value: q.options[0].id } } };
    const res = await Promise.all([call(path, 'POST', payload, ''), call(path, 'POST', payload, '')]);
    expect(res.map(r => r.status)).toEqual([200, 200]);
    expect(await db.response.count({ where: { surveyId } })).toBe(1);
    const pub = await (await call(path, 'GET', undefined, '')).json();
    expect(pub.ownerId).toBeUndefined(); expect(pub.responses).toBeUndefined();
    const csv = await call(`/surveys/${surveyId}/export`); expect(csv.status).toBe(200); expect(await csv.text()).toContain(q.title);
  });
  it('stops collection and supports clone without answers', async () => {
    const race=await Promise.all([call(`/public/${shareId}`, 'POST', {submissionKey:randomUUID(),answers:{[q.id]:{value:q.options[0].id}}}, ''),call(`/surveys/${surveyId}/action`, 'POST', { action: 'close' })]);
    expect([200,409]).toContain(race[0].status);expect(race[1].status).toBe(200);
    expect((await call(`/public/${shareId}`, 'POST', { submissionKey: randomUUID(), answers: { [q.id]: { value: q.options[0].id } } }, '')).status).toBe(409);
    const clone = await (await call(`/surveys/${surveyId}/action`, 'POST', { action: 'clone' })).json();
    expect(clone.showBranding).toBe(false);
    expect(clone.brandName).toBe('知行研究'); expect(clone.brandDescription).toBe('你的反馈，让产品更好');
    const closed = await (await call(`/public/${shareId}`, 'GET', undefined, '')).json();
    expect(closed.brandName).toBe('知行研究'); expect(closed.brandDescription).toBe('你的反馈，让产品更好');
    expect((await (await call(`/public/${shareId}`, 'GET', undefined, '')).json()).showBranding).toBe(false);
    expect(clone.status).toBe('DRAFT'); expect(clone.shareId).not.toBe(shareId);
    expect(clone.browserTitle).toBe('用户体验反馈');
    expect(clone.bannerTitle).toBe('欢迎分享你的想法'); expect(clone.bannerImage).toMatch(/^data:image\/png;base64,/);
    expect(await db.response.count({ where: { surveyId: clone.id } })).toBe(0);
  });
  it('rejects cross-origin writes', async () => {
    const r = await fetch(base + `/api/surveys/${surveyId}`, { method: 'PATCH', headers: { Origin: 'https://evil.invalid', Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'bad' }) });
    expect(r.status).toBe(403);
  });
  it('administrator reset and deactivation revoke the target user sessions', async()=>{
    const login=await call('/auth/login','POST',{username:process.env.ADMIN_USERNAME||'admin',password:process.env.ADMIN_PASSWORD},'');
    expect(login.status).toBe(200);const adminCookie=login.headers.get('set-cookie')!.split(';')[0];
    const targetLogin=await call('/auth/login','POST',{username:username+'_other',password:'Testing!123456'},'');
    const targetCookie=targetLogin.headers.get('set-cookie')!.split(';')[0];
    const [racingLogin,reset]=await Promise.all([call('/auth/login','POST',{username:username+'_other',password:'Testing!123456'},''),call(`/users/${otherId}`,'PATCH',{password:'ResetTesting!123456'},adminCookie)]);
    expect(reset.status).toBe(200);if(racingLogin.status===200){const raceCookie=racingLogin.headers.get('set-cookie')!.split(';')[0];expect((await call('/auth/me','GET',undefined,raceCookie)).status).toBe(401);}else expect(racingLogin.status).toBe(401);
    expect((await call('/auth/me','GET',undefined,targetCookie)).status).toBe(401);
    const relogin=await call('/auth/login','POST',{username:username+'_other',password:'ResetTesting!123456'},'');
    const newCookie=relogin.headers.get('set-cookie')!.split(';')[0];
    expect((await call(`/users/${otherId}`,'PATCH',{active:false},adminCookie)).status).toBe(200);
    expect((await call('/auth/me','GET',undefined,newCookie)).status).toBe(401);
  });
  it('revokes sessions after password change and after deactivation', async () => {
    expect((await call('/account', 'PATCH', { currentPassword: 'Testing!123456', password: 'NewTesting!123456' })).status).toBe(200);
    expect((await call('/auth/me')).status).toBe(401);
    const login = await call('/auth/login', 'POST', { username, password: 'NewTesting!123456' }, '');
    cookie = login.headers.get('set-cookie')!.split(';')[0];
    await db.user.update({ where: { id: userId }, data: { active: false } });
    expect((await call('/auth/me')).status).toBe(401);
  });
});
