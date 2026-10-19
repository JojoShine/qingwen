'use client';
import { Image } from 'antd';
import { DownloadOutlined, FileOutlined } from '@ant-design/icons';
import { fileSize, previewableImage, type AttachmentInfo } from '@/lib/attachment';
import { withBasePath } from '@/lib/paths';
export default function ResponseAttachments({ files }: { files: AttachmentInfo[] }) {
  if (!files.length) return <p className="response-empty">未上传附件</p>;
  return <ul className="attachment-list response-attachments">{files.map(file => {
    const url = withBasePath(`/api/attachments/${file.id}`);
    return <li key={file.id} className="attachment-item">{previewableImage(file.mime) ? <Image src={url+'?preview=1'} alt={file.name} width={56} height={56}/> : <span className="attachment-file-icon"><FileOutlined/></span>}<div><strong title={file.name}>{file.name}</strong><span>{fileSize(file.size)}</span></div><a href={url} download={file.name} aria-label={`下载附件 ${file.name}`}><DownloadOutlined/> 下载</a></li>;
  })}</ul>;
}
