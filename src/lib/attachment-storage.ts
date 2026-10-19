import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export function uploadsDirectory() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
}
function filePath(key: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)) throw new Error('附件存储标识无效');
  return path.join(uploadsDirectory(), key);
}
async function syncDirectory() {
  const directory = await open(uploadsDirectory(), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
export async function writeAttachment(data: Uint8Array) {
  await mkdir(uploadsDirectory(), { recursive: true, mode: 0o700 });
  const storageKey = randomUUID();
  const file = await open(filePath(storageKey), 'wx', 0o600);
  try {
    await file.writeFile(data);
    await file.sync();
    await file.close();
    await syncDirectory();
  } catch (error) {
    await file.close().catch(() => {});
    await unlink(filePath(storageKey)).catch(() => {});
    throw error;
  }
  return { storageKey, sha256: createHash('sha256').update(data).digest('hex') };
}
export async function readAttachment(file: { storageKey: string; size: number; sha256: string }) {
  const data = await readFile(filePath(file.storageKey));
  if (data.length !== file.size || createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error('附件完整性校验失败');
  return data;
}
export async function removeAttachment(storageKey: string) {
  try { await unlink(filePath(storageKey)); await syncDirectory(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
