import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';
import { newQuestion } from '../src/lib/survey';
import { removeAttachment, uploadsDirectory } from '../src/lib/attachment-storage';
const base = process.env.TEST_BASE_URL || 'http://localhost:3218';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=', 'base64');
let cookie = '', otherCookie = '', ownerId = '', otherId = '', surveyId = '', shareId = '';
const question = { ...newQuestion('attachment'), title: '请提供相关材料', maxFiles: 2 };
async function api(endpoint: string, method = 'GET', data?: unknown, token = cookie) {
  return fetch(base + '/api' + endpoint, { method, headers: { 'Content-Type': 'application/json', Origin: base, Cookie: token }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
}
function upload(file = new File([png], '测试照片.png'), key = randomUUID(), id = randomUUID()) {
  const form = new FormData(); form.append('payload', JSON.stringify({ submissionKey: key, answers: { [question.id]: { value: [id] } } })); form.append('file:' + id, file);
  return fetch(base + '/api/public/' + shareId, { method: 'POST', headers: { Origin: base }, body: form });
}
describe.skipIf(process.env.RUN_INTEGRATION !== '1')('attachment submission and authorized downloads', () => {
  beforeAll(async () => {
    const username = 'attachments_' + randomUUID().slice(0, 8), password = 'AttachmentTest!123';
    const owner = await db.user.create({ data: { username, name: 'Attachment owner', passwordHash: await hashPassword(password) } }); ownerId = owner.id;
    const other = await db.user.create({ data: { username: username + '_other', name: 'Other', passwordHash: await hashPassword(password) } }); otherId = other.id;
    for (const [name, assign] of [[username, (value: string) => { cookie = value; }], [username + '_other', (value: string) => { otherCookie = value; }]] as const) {
      const login = await api('/auth/login', 'POST', { username: name, password }, ''); expect(login.status).toBe(200); assign(login.headers.get('set-cookie')!.split(';')[0]);
    }
    const survey = await (await api('/surveys', 'POST', { title: '附件链路验收' })).json(); surveyId = survey.id; shareId = survey.shareId;
    expect((await api('/surveys/' + surveyId, 'PATCH', { content: [question] })).status).toBe(200);
    expect((await api(`/surveys/${surveyId}/action`, 'POST', { action: 'publish' })).status).toBe(200);
  });
  afterAll(async () => {
    if (surveyId) await api('/surveys/' + surveyId, 'DELETE');
    await db.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } }); await db.$disconnect();
  });
  it('rejects invalid contents without saving responses or files', async () => {
    expect((await upload(new File(['bad'], 'x.png'))).status).toBe(422);
    for (const name of ['x.zip','x.rar','x.7z','x.docm','x.exe']) expect((await upload(new File(['blocked'], name))).status).toBe(422);
    const archive = await readFile(new URL('./fixtures/archive-renamed.docx', import.meta.url));
    expect((await upload(new File([archive], 'report.docx'))).status).toBe(422);
    expect((await upload(new File([new Uint8Array(5 * 1024 * 1024)], 'too-large.txt'))).status).toBe(413);
    expect(await db.response.count({ where: { surveyId } })).toBe(0);
    expect(await db.attachment.count({ where: { response: { surveyId } } })).toBe(0);
  });
  it('normalizes JPEG trailing data before persisting and downloading an attachment', async () => {
    const jpeg = await sharp({ create: { width: 16, height: 24, channels: 3, background: '#168878' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const submitted = await upload(new File([Buffer.concat([jpeg,Buffer.from('private trailing contents')])], 'IMG_20261020_test.jpg', { type: 'image/jpeg' }));
    expect(submitted.status).toBe(200); const responseId = (await submitted.json()).id;
    const files = await db.attachment.findMany({ where: { responseId } });
    try {
      expect(files).toHaveLength(1);
      const downloaded = await api('/attachments/' + files[0].id);
      expect(downloaded.status).toBe(200);
      const data = Buffer.from(await downloaded.arrayBuffer()), metadata = await sharp(data).metadata();
      expect(metadata).toMatchObject({ format: 'jpeg', width: 24, height: 16 });
      expect(metadata.exif).toBeUndefined();
      expect(data.includes(Buffer.from('private trailing contents'))).toBe(false);
      expect(data.subarray(-2)).toEqual(Buffer.from([255,217]));
      expect(files[0].size).toBe(data.length);
      expect(await readFile(path.join(uploadsDirectory(),files[0].storageKey))).toEqual(data);
    } finally {
      await db.response.delete({ where: { id: responseId } });
      await Promise.all(files.map(file => removeAttachment(file.storageKey)));
    }
  });
  it('persists files, deduplicates retries, protects downloads and detects corruption', async () => {
    const key = randomUUID(), clientId = randomUUID();
    const submitted = await upload(new File([png], '测试照片.png'), key, clientId); expect(submitted.status).toBe(200); const responseId = (await submitted.json()).id;
    const retry = await upload(new File([png], '测试照片.png'), key, clientId); expect(retry.status).toBe(200); expect((await retry.json()).id).toBe(responseId);
    const files = await db.attachment.findMany({ where: { responseId } }); expect(files).toHaveLength(1); const file = files[0];
    expect(file.id).not.toBe(clientId); expect(await readFile(path.join(uploadsDirectory(), file.storageKey))).toEqual(png);
    const endpoint = '/attachments/' + file.id;
    expect((await api(endpoint, 'GET', undefined, '')).status).toBe(401);
    expect((await api(endpoint, 'GET', undefined, otherCookie)).status).toBe(404);
    const download = await api(endpoint); expect(download.status).toBe(200); expect(download.headers.get('content-disposition')).toContain('attachment;'); expect(Buffer.from(await download.arrayBuffer())).toEqual(png);
    expect((await api(endpoint + '?preview=1')).headers.get('content-disposition')).toContain('inline;');
    await writeFile(path.join(uploadsDirectory(), file.storageKey), 'corrupted');
    expect((await api(endpoint)).status).toBe(503);
    await writeFile(path.join(uploadsDirectory(), file.storageKey), png);
    expect((await api(endpoint)).status).toBe(200);
    expect(await (await api(`/surveys/${surveyId}/export`)).text()).toContain('测试照片.png');
    const saved = await db.response.findUniqueOrThrow({ where: { id: responseId } }); expect(saved.answers).toHaveProperty(question.id + '.files');
    expect((await api('/surveys/' + surveyId, 'DELETE')).status).toBe(200);
    await expect(readFile(path.join(uploadsDirectory(), file.storageKey))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await db.attachment.count({ where: { responseId } })).toBe(0); surveyId = '';
  });
});
