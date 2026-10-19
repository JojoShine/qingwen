import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { AttachmentDiagnostic } from './attachment-diagnostics';
import { attachmentError, attachmentExtension, attachmentTotalBytes, attachmentTotalFiles, type AttachmentInfo } from './attachment';
import { officeDocumentMime } from './office-document';
import { body, HttpError } from './http';
import { visibleAnswers, visibleContent, type Answers, type Question } from './survey';
const requestLimit = attachmentTotalBytes;

export async function submissionBody(req: Request): Promise<{ payload: unknown; files: Map<string, File> }> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) return { payload: await body(req), files: new Map() };
  if (Number(req.headers.get('content-length')) > requestLimit) throw new HttpError(413, '整次提交（含附件和答卷）不能超过 5MB');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, '请求内容为空');
  const chunks: Uint8Array[] = []; let size = 0;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 30_000);
  try { while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > requestLimit) { await reader.cancel(); throw new HttpError(413, '整次提交（含附件和答卷）不能超过 5MB'); }
    chunks.push(part.value);
  } } finally { clearTimeout(timeout); }
  if (timedOut) throw new HttpError(408, '上传超时，请重试');
  const data = Buffer.concat(chunks);
  const boundary = req.headers.get('content-type')?.match(/;\s*boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const delimiter = boundary?.[1] || boundary?.[2];
  if (!delimiter || delimiter.length > 70 || !/^[0-9A-Za-z'()+_,./:=?-]+$/.test(delimiter)) throw new HttpError(400, '附件提交格式无效');
  const marker = Buffer.from('--' + delimiter);
  let position = 0, parts = 0;
  while ((position = data.indexOf(marker, position)) !== -1) {
    if (++parts > attachmentTotalFiles + 2) throw new HttpError(413, '上传表单字段过多');
    position += marker.length;
  }
  let form: FormData;
  try { form = await new Response(data, { headers: { 'Content-Type': req.headers.get('content-type')! } }).formData(); }
  catch { throw new HttpError(400, '附件提交格式无效'); }
  const payload = form.get('payload');
  if (typeof payload !== 'string' || Buffer.byteLength(payload) > 1_000_000 || form.getAll('payload').length !== 1) throw new HttpError(400, '答卷格式无效');
  const files = new Map<string, File>(); let bytes = 0;
  for (const [key, value] of form) {
    if (key === 'payload') continue;
    const id = key.slice(5);
    if (!key.startsWith('file:') || typeof value === 'string' || files.has(id) || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(422, '附件格式无效');
    bytes += value.size; files.set(id, value);
    if (bytes > attachmentTotalBytes || files.size > attachmentTotalFiles) throw new HttpError(413, '每份答卷附件最多 10 个，含表单的提交总大小不超过 5MB');
  }
  try { return { payload: JSON.parse(payload), files }; }
  catch { throw new HttpError(400, '答卷格式无效'); }
}
async function detectMime(name: string, data: Uint8Array): Promise<string | null> {
  const bytes = Buffer.from(data); const ext = attachmentExtension(name);
  const signature = (values: number[]) => values.every((value, index) => bytes[index] === value);
  if (ext === 'png' && signature([137,80,78,71,13,10,26,10])) return 'image/png';
  if (['jpg','jpeg'].includes(ext) && signature([255,216,255]) && bytes.at(-2) === 255 && bytes.at(-1) === 217) return 'image/jpeg';
  if (ext === 'webp' && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  if (ext === 'gif' && ['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))) return 'image/gif';
  if (['heic','heif'].includes(ext) && bytes.toString('ascii',4,8) === 'ftyp' && ['heic','heix','hevc','hevx','mif1','msf1'].includes(bytes.toString('ascii',8,12))) return ext === 'heic' ? 'image/heic' : 'image/heif';
  if (ext === 'pdf' && bytes.toString('ascii',0,5) === '%PDF-') return 'application/pdf';
  if (ext === 'txt' && !bytes.includes(0)) { try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return 'text/plain'; } catch { return null; } }
  if (['docx','xlsx','pptx'].includes(ext) && signature([80,75,3,4])) return officeDocumentMime(bytes, ext);
  return null;
}
function invalidFileMessage(name: string, data: Uint8Array): string {
  if (!['jpg','jpeg'].includes(attachmentExtension(name))) return '文件内容无效或与扩展名不匹配';
  const bytes = Buffer.from(data);
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return 'JPG 文件起始标记不匹配，请重新导出图片（JPEG_HEADER）';
  if (bytes.lastIndexOf(Buffer.from([255,217])) >= 0) return 'JPG 图片无法完整解码，或超过安全处理限制，请重新导出图片（JPEG_DECODE）';
  return 'JPG 文件缺少结束标记，文件可能不完整（JPEG_END_MISSING）';
}
export async function prepareAttachments(content: Question[], input: Answers, files: Map<string, File>, diagnose?: AttachmentDiagnostic) {
  const answers = visibleAnswers(content, input);
  const attachments: (AttachmentInfo & { questionId: string; data: Uint8Array<ArrayBuffer> })[] = [];
  const used = new Set<string>(); let preparedBytes = 0;
  for (const question of visibleContent(content, input).filter(q => q.type === 'attachment')) {
    const ids = answers[question.id]?.value;
    const metadata: AttachmentInfo[] = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      const file = files.get(id);
      if (!file || used.has(id)) throw new HttpError(422, '请重新选择附件', { [question.id]: '附件缺失或重复，请重新选择' });
      const error = attachmentError(file, question);
      if (error) throw new HttpError(422, error, { [question.id]: error });
      let data = new Uint8Array(await file.arrayBuffer());
      let mime = await detectMime(file.name, data);
      if (['jpg','jpeg'].includes(attachmentExtension(file.name))) {
        mime = null;
        if (data[0] === 255 && data[1] === 216 && data[2] === 255 && Buffer.from(data).lastIndexOf(Buffer.from([255,217])) >= 0) {
          try {
            // Decode untrusted pixels before re-encoding; never preserve appended data or metadata.
            const normalized = await sharp(data, { failOn: 'warning', limitInputPixels: 64_000_000 }).autoOrient().timeout({ seconds: 5 }).jpeg({ quality: 95 }).toBuffer();
            diagnose?.('file-normalized', { receivedBytes: data.length, storedBytes: normalized.length, sourceSha256: createHash('sha256').update(data).digest('hex') });
            data = new Uint8Array(normalized); mime = 'image/jpeg';
          } catch { /* Reject invalid, truncated or resource-intensive JPEGs below. */ }
        }
      }
      if (!mime) {
        const error = invalidFileMessage(file.name, data);
        const bytes = Buffer.from(data), jpegEnd = bytes.lastIndexOf(Buffer.from([255,217]));
        diagnose?.('file-rejected', {
          reason: error.match(/（(JPEG_[A-Z_]+)）/)?.[1] || 'FILE_CONTENT_MISMATCH',
          extension: attachmentExtension(file.name), declaredMime: file.type.slice(0,128),
          receivedBytes: data.length, partBytes: file.size, sha256: createHash('sha256').update(data).digest('hex'),
          jpegStart: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
          jpegEndAtFileEnd: bytes.at(-2) === 255 && bytes.at(-1) === 217,
          lastJpegEndOffset: jpegEnd, trailingBytes: jpegEnd >= 0 ? data.length - jpegEnd - 2 : null,
          isoBaseMedia: bytes.toString('ascii',4,8) === 'ftyp',
        });
        throw new HttpError(422, error, { [question.id]: error });
      }
      const normalizedError = attachmentError({ name: file.name, size: data.length }, question);
      if (normalizedError) throw new HttpError(422, normalizedError, { [question.id]: normalizedError });
      preparedBytes += data.length;
      if (preparedBytes > attachmentTotalBytes) throw new HttpError(413, '处理后的附件合计不能超过 5MB，请减少文件大小后重试');
      const info = { id: randomUUID(), name: file.name, size: data.length, mime };
      metadata.push(info); attachments.push({ ...info, questionId: question.id, data }); used.add(id);
    }
    if (Array.isArray(ids)) answers[question.id] = { value: metadata.map(file => file.id), files: metadata };
  }
  if (used.size !== files.size) throw new HttpError(422, '存在未关联到当前题目的附件');
  return { answers, attachments };
}
