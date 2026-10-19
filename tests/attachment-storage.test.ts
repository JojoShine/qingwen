import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeAttachment, readAttachment, removeAttachment } from '../src/lib/attachment-storage';
import { prepareAttachments, submissionBody } from '../src/lib/attachment-server';
import { attachmentError } from '../src/lib/attachment';
import { answerText, newQuestion, validateAnswers, validateContent } from '../src/lib/survey';
let directory: string; const previous = process.env.UPLOAD_DIR;
beforeEach(async () => { directory = await mkdtemp(path.join(tmpdir(), 'qingwen-uploads-')); process.env.UPLOAD_DIR = directory; });
afterEach(async () => { if (previous === undefined) delete process.env.UPLOAD_DIR; else process.env.UPLOAD_DIR = previous; await rm(directory, { recursive: true, force: true }); });
describe('durable attachment storage', () => {
  it('writes immutable server keys, verifies checksums and detects missing or altered files', async () => {
    const data = Buffer.from('attachment contents');
    const first = await writeAttachment(data), second = await writeAttachment(data);
    expect(first.storageKey).not.toBe(second.storageKey);
    expect(await readAttachment({ ...first, size: data.length })).toEqual(data);
    await writeFile(path.join(directory, first.storageKey), 'changed');
    await expect(readAttachment({ ...first, size: data.length })).rejects.toThrow('完整性');
    expect(await readFile(path.join(directory, second.storageKey))).toEqual(data);
    await removeAttachment(second.storageKey);
    await expect(readAttachment({ ...second, size: data.length })).rejects.toThrow();
    await removeAttachment(second.storageKey);
    await expect(readAttachment({ storageKey: '../secret', size: 1, sha256: '' })).rejects.toThrow('标识');
  });
  it('rejects a failed write without publishing metadata', async () => {
    const blocked = path.join(directory, 'not-a-directory'); await writeFile(blocked, 'x'); process.env.UPLOAD_DIR = blocked;
    await expect(writeAttachment(Buffer.from('content'))).rejects.toThrow();
    expect(await readdir(directory)).toEqual(['not-a-directory']);
  });
});
describe('attachment input rules', () => {
  const question = { ...newQuestion('attachment'), title: '支持材料', maxFiles: 2 };
  it('validates required, type, size, count and server-controlled metadata', async () => {
    expect(validateContent([question], true)).toEqual({});
    expect(validateAnswers([question], {})).toHaveProperty(question.id);
    expect(validateAnswers([question], { [question.id]: { value: [randomUUID(), randomUUID(), randomUUID()] } })).toHaveProperty(question.id);
    expect(attachmentError({ name: 'x.svg', size: 10 }, question)).toContain('类型');
    expect(attachmentError({ name: 'x.txt', size: 11 * 1024 * 1024 }, question)).toContain('10MB');
    expect(attachmentError({ name: '../x.txt', size: 10 }, question)).toContain('名称');
    expect(attachmentError({ name: 'x.txt', size: 0 }, question)).toContain('空文件');
    const id = randomUUID();
    const result = await prepareAttachments([question], { [question.id]: { value: [id], files: [{ id, name: 'forged', size: 1, mime: 'x' }] } }, new Map([[id, new File(['hello'], '真实文件.txt', { type: 'text/html' })]]));
    expect(result.attachments[0]).toMatchObject({ name: '真实文件.txt', size: 5, mime: 'text/plain' });
    expect(result.attachments[0].id).not.toBe(id);
    expect(answerText(question, result.answers[question.id])).toBe('真实文件.txt');
    await expect(prepareAttachments([question], { [question.id]: { value: [id] } }, new Map())).rejects.toThrow('重新选择');
    await expect(prepareAttachments([question], { [question.id]: { value: [id] } }, new Map([[id, new File(['<html>'], 'x.png')]]))).rejects.toThrow('扩展名');
  });
  it('rejects hidden and unreferenced uploads and enforces total limits on multipart bodies', async () => {
    const id = randomUUID(), choice = newQuestion('single');
    const hidden = { ...question, showWhen: { questionId: choice.id, optionId: choice.options[0].id } };
    await expect(prepareAttachments([choice, hidden], { [choice.id]: { value: choice.options[1].id } }, new Map([[id, new File(['x'], 'x.txt')]]))).rejects.toThrow('未关联');
    const form = new FormData(); form.append('payload', JSON.stringify({ answers: {} }));
    for (let i = 0; i < 11; i++) form.append('file:' + randomUUID(), new File(['x'], 'x.txt'));
    await expect(submissionBody(new Request('http://localhost', { method: 'POST', body: form }))).rejects.toMatchObject({ status: 413 });
    await expect(submissionBody(new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=test', 'Content-Length': String(22 * 1024 * 1024) }, body: 'x' }))).rejects.toMatchObject({ status: 413 });
    const valid = new FormData(); valid.append('payload', '{"answers":{}}'); valid.append('file:' + id, new File(['hello'], 'x.txt'));
    const parsed = await submissionBody(new Request('http://localhost', { method: 'POST', body: valid }));
    expect(parsed.files.get(id)?.name).toBe('x.txt');
  });
});
