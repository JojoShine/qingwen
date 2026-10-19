import { randomUUID } from 'node:crypto';
import { attachmentError, attachmentExtension, attachmentTotalBytes, attachmentTotalFiles, type AttachmentInfo } from './attachment';
import { body, HttpError } from './http';
import { visibleAnswers, visibleContent, type Answers, type Question } from './survey';
const requestLimit = attachmentTotalBytes + 1024 * 1024;

export async function submissionBody(req: Request): Promise<{ payload: unknown; files: Map<string, File> }> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) return { payload: await body(req), files: new Map() };
  if (Number(req.headers.get('content-length')) > requestLimit) throw new HttpError(413, '附件合计不能超过 20MB');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, '请求内容为空');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength;
    if (size > requestLimit) { await reader.cancel(); throw new HttpError(413, '附件合计不能超过 20MB'); }
    chunks.push(part.value);
  }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': req.headers.get('content-type')! } }).formData(); }
  catch { throw new HttpError(400, '附件提交格式无效'); }
  const payload = form.get('payload');
  if (typeof payload !== 'string' || Buffer.byteLength(payload) > 1_000_000 || form.getAll('payload').length !== 1) throw new HttpError(400, '答卷格式无效');
  const files = new Map<string, File>(); let bytes = 0;
  for (const [key, value] of form) {
    if (key === 'payload') continue;
    const id = key.slice(5);
    if (!key.startsWith('file:') || typeof value === 'string' || files.has(id) || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(422, '附件格式无效');
    bytes += value.size; files.set(id, value);
    if (bytes > attachmentTotalBytes || files.size > attachmentTotalFiles) throw new HttpError(413, '每份答卷附件最多 10 个，合计不超过 20MB');
  }
  try { return { payload: JSON.parse(payload), files }; }
  catch { throw new HttpError(400, '答卷格式无效'); }
}
function detectMime(name: string, data: Uint8Array): string | null {
  const bytes = Buffer.from(data); const ext = attachmentExtension(name);
  const signature = (values: number[]) => values.every((value, index) => bytes[index] === value);
  if (ext === 'png' && signature([137,80,78,71,13,10,26,10])) return 'image/png';
  if (['jpg','jpeg'].includes(ext) && signature([255,216,255]) && bytes.at(-2) === 255 && bytes.at(-1) === 217) return 'image/jpeg';
  if (ext === 'webp' && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  if (ext === 'gif' && ['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))) return 'image/gif';
  if (['heic','heif'].includes(ext) && bytes.toString('ascii',4,8) === 'ftyp' && ['heic','heix','hevc','hevx','mif1','msf1'].includes(bytes.toString('ascii',8,12))) return ext === 'heic' ? 'image/heic' : 'image/heif';
  if (ext === 'pdf' && bytes.toString('ascii',0,5) === '%PDF-') return 'application/pdf';
  if (ext === 'txt' && !bytes.includes(0)) { try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return 'text/plain'; } catch { return null; } }
  if (['doc','xls','ppt'].includes(ext) && signature([208,207,17,224,161,177,26,225])) return { doc:'application/msword', xls:'application/vnd.ms-excel', ppt:'application/vnd.ms-powerpoint' }[ext]!;
  if (['docx','xlsx','pptx','zip'].includes(ext) && signature([80,75,3,4])) return { docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation', zip:'application/zip' }[ext]!;
  return null;
}
export async function prepareAttachments(content: Question[], input: Answers, files: Map<string, File>) {
  const answers = visibleAnswers(content, input);
  const attachments: (AttachmentInfo & { questionId: string; data: Uint8Array<ArrayBuffer> })[] = [];
  const used = new Set<string>();
  for (const question of visibleContent(content, input).filter(q => q.type === 'attachment')) {
    const ids = answers[question.id]?.value;
    const metadata: AttachmentInfo[] = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      const file = files.get(id);
      if (!file || used.has(id)) throw new HttpError(422, '请重新选择附件', { [question.id]: '附件缺失或重复，请重新选择' });
      const error = attachmentError(file, question);
      if (error) throw new HttpError(422, error, { [question.id]: error });
      const data = new Uint8Array(await file.arrayBuffer());
      const mime = detectMime(file.name, data);
      if (!mime) throw new HttpError(422, '文件内容与扩展名不匹配，请选择有效文件', { [question.id]: '文件内容无效或与扩展名不匹配' });
      const info = { id: randomUUID(), name: file.name, size: file.size, mime };
      metadata.push(info); attachments.push({ ...info, questionId: question.id, data }); used.add(id);
    }
    if (Array.isArray(ids)) answers[question.id] = { value: metadata.map(file => file.id), files: metadata };
  }
  if (used.size !== files.size) throw new HttpError(422, '存在未关联到当前题目的附件');
  return { answers, attachments };
}
