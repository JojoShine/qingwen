export type AttachmentMode = 'all' | 'images' | 'documents';
export type AttachmentRules = { fileMode?: AttachmentMode; maxFiles?: number; maxFileSizeMB?: number };
export type AttachmentInfo = { id: string; name: string; size: number; mime: string };
export const attachmentTotalBytes = 20 * 1024 * 1024;
export const attachmentTotalFiles = 10;
export const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];
export const documentExtensions = ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip'];
export const attachmentExtension = (name: string) => name.split('.').at(-1)?.toLowerCase() || '';
export function attachmentAccept(mode: AttachmentMode = 'all') {
  return (mode === 'images' ? imageExtensions : mode === 'documents' ? documentExtensions : [...imageExtensions, ...documentExtensions]).map(ext => '.' + ext).join(',');
}
export function attachmentError(file: { name: string; size: number }, rules: AttachmentRules): string | null {
  if (!file.name.trim() || file.name.length > 240 || /[\x00-\x1f\x7f/\\:]/.test(file.name)) return '文件名称无效或过长，请重命名后再选择';
  const extensions = rules.fileMode === 'images' ? imageExtensions : rules.fileMode === 'documents' ? documentExtensions : [...imageExtensions, ...documentExtensions];
  if (!extensions.includes(attachmentExtension(file.name))) return '文件类型不支持，请按题目要求选择图片或文档';
  if (!file.size) return '不能上传空文件';
  if (file.size > (rules.maxFileSizeMB ?? 10) * 1024 * 1024) return `单个文件不能超过 ${rules.maxFileSizeMB ?? 10}MB`;
  return null;
}
export function fileSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`; }
export const previewableImage = (mime: string) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime);
