import { db } from '../../src/lib/db';
import { readAttachment } from '../../src/lib/attachment-storage';

try {
  // A pre-attachment backup is valid too; its next normal startup runs migrations.
  const table = await db.$queryRaw<{ present: string | null }[]>`SELECT to_regclass('public."Attachment"')::text AS present`;
  if (table[0]?.present) {
    let cursor: string | undefined; let checked = 0;
    while (true) {
      const files = await db.attachment.findMany({ take: 100, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, storageKey: true, size: true, sha256: true } });
      if (!files.length) break;
      for (const file of files) {
        try { await readAttachment(file); }
        catch { throw new Error(`附件 ${file.id} 缺失或损坏：检查附件数据卷，或恢复配套的完整备份。`); }
      }
      checked += files.length; cursor = files.at(-1)!.id;
    }
    console.error(`附件完整性校验通过：${checked} 个文件。`);
  }
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
finally { await db.$disconnect(); }
