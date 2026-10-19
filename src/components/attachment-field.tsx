'use client';
import { useEffect, useRef, useState } from 'react';
import { App, Button, Image } from 'antd';
import { CameraOutlined, DeleteOutlined, FileOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { attachmentAccept, attachmentError, attachmentTotalBytes, attachmentTotalFiles, fileSize, previewableImage } from '@/lib/attachment';
import { uid, type Answer, type Question } from '@/lib/survey';
function SelectedFile({ file, disabled, remove }: { file: File; disabled: boolean; remove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!previewableImage(file.type)) return;
    const value = URL.createObjectURL(file); setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  return <li className="attachment-item">{url ? <Image src={url} alt={file.name} width={48} height={48}/> : <span className="attachment-file-icon"><FileOutlined/></span>}<div><strong title={file.name}>{file.name}</strong><span>{fileSize(file.size)} · 已选择，提交时上传</span></div><Button type="text" icon={<DeleteOutlined/>} aria-label={`移除附件 ${file.name}`} disabled={disabled} onClick={remove}/></li>;
}
export default function AttachmentField({ question: q, answer, files, onFilesChange, onChange, disabled }: { question: Question; answer?: Answer; files: Record<string, File>; onFilesChange?: (files: Record<string, File>) => void; onChange: (answer: Answer) => void; disabled: boolean }) {
  const { message } = App.useApp(); const picker = useRef<HTMLInputElement>(null), photos = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const ids = Array.isArray(answer?.value) ? answer.value : [];
  const blocked = disabled || !onFilesChange;
  const max = q.maxFiles ?? 1;
  const add = (selected: File[]) => {
    if (blocked || !selected.length) return;
    if (ids.length + selected.length > max) { message.warning(`本题最多选择 ${max} 个附件，请先移除已有文件`); return; }
    for (const file of selected) { const error = attachmentError(file, q); if (error) { message.error(`${file.name}：${error}`); return; } }
    const existing = Object.values(files);
    if (existing.length + selected.length > attachmentTotalFiles || [...existing,...selected].reduce((size, file) => size + file.size, 0) > attachmentTotalBytes) { message.warning('每份答卷附件最多 10 个，合计不超过 5MB'); return; }
    const entries = selected.map(file => [uid(), file] as const);
    onFilesChange?.({ ...files, ...Object.fromEntries(entries) });
    onChange({ value: [...ids, ...entries.map(([id]) => id)] });
  };
  const input = (list: FileList | null, element: HTMLInputElement) => { add(Array.from(list || [])); element.value = ''; };
  const images = q.fileMode !== 'documents';
  return <div className="attachment-field">
    <input ref={picker} hidden style={{ display: 'none' }} type="file" accept={attachmentAccept(q.fileMode)} multiple={max > 1} disabled={blocked} aria-label={`${q.title}：选择附件`} onChange={e => input(e.target.files, e.target)}/>
    {images && <><input ref={photos} hidden style={{ display: 'none' }} type="file" accept={attachmentAccept('images')} multiple={max > 1} disabled={blocked} aria-label={`${q.title}：选择照片`} onChange={e => input(e.target.files, e.target)}/><input ref={camera} hidden style={{ display: 'none' }} type="file" accept="image/*" capture="environment" disabled={blocked} aria-label={`${q.title}：拍照`} onChange={e => input(e.target.files, e.target)}/></>}
    <div className={`attachment-dropzone ${dragging ? 'is-dragging' : ''} ${blocked ? 'is-disabled' : ''}`} role="group" aria-label={`${q.title}：附件选择区`} onDragOver={e => { e.preventDefault(); if (!blocked) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); add(Array.from(e.dataTransfer.files)); }}>
      <UploadOutlined className="attachment-upload-icon"/><div className="attachment-actions"><Button icon={<FileOutlined/>} disabled={blocked || ids.length >= max} onClick={() => picker.current?.click()}>选择文件</Button>{images && <><Button className="attachment-mobile-action" icon={<PictureOutlined/>} disabled={blocked || ids.length >= max} onClick={() => photos.current?.click()}>相册</Button><Button className="attachment-mobile-action" icon={<CameraOutlined/>} disabled={blocked || ids.length >= max} onClick={() => camera.current?.click()}>拍照</Button></>}</div>
      <span className="attachment-drag-hint">也可以将文件拖拽到这里</span><p>{q.fileMode === 'images' ? '仅图片' : q.fileMode === 'documents' ? '仅文档' : '图片与文档'} · 最多 {max} 个 · 单个不超过 {q.maxFileSizeMB ?? 5}MB</p>
    </div>
    {!!ids.length && <ul className="attachment-list" aria-label="已选择的附件">{ids.map(id => files[id] && <SelectedFile key={id} file={files[id]} disabled={blocked} remove={() => { const next = { ...files }; delete next[id]; onFilesChange?.(next); onChange({ value: ids.filter(value => value !== id) }); }}/>)}</ul>}
    <p className="attachment-note">整次提交（含附件和答卷）不超过 5MB，不支持压缩包。{images && 'HEIC / HEIF 可上传，预览能力取决于浏览器。'}</p>
  </div>;
}
