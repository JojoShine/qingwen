'use client';
import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Modal, QRCode, Spin, Alert } from 'antd';
import { CopyOutlined, DownloadOutlined, QrcodeOutlined, CheckCircleFilled, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '@/lib/client';
import { prepareQrLogo } from '@/lib/image-upload';
type ShareData = { url: string; qrLogoImage: string | null };
const qrSize = 190, logoSize = 36;
export default function ShareDialog({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false), [downloading, setDownloading] = useState(false);
  const qr = useRef<HTMLDivElement>(null), fileInput = useRef<HTMLInputElement>(null), request = useRef<AbortController | null>(null);
  const { message } = App.useApp();
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); request.current = controller;
    setUrl(''); setError(''); setLogo(null); setSaving(false); setDownloading(false);
    api<ShareData>(`/surveys/${id}/share`, { signal: controller.signal }).then(r => {
      if (!controller.signal.aborted) { setLogo(r.qrLogoImage); setUrl(new URL(r.url, window.location.origin).toString()); }
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [id, open]);
  async function saveLogo(file?: File, remove = false) {
    if (!file && !remove) return;
    const signal = request.current?.signal;
    setSaving(true);
    try {
      const qrLogoImage = file ? await prepareQrLogo(file) : null;
      if (signal?.aborted) return;
      const saved = await api<Pick<ShareData, 'qrLogoImage'>>(`/surveys/${id}/share`, { method: 'PATCH', signal, body: JSON.stringify({ qrLogoImage }) });
      if (!signal?.aborted) { setLogo(saved.qrLogoImage); message.success(remove ? 'Logo 已移除' : 'Logo 已保存'); }
    } catch (e) { if (!signal?.aborted) message.error((e as Error).message); }
    finally { if (!signal?.aborted) setSaving(false); }
  }
  async function download() {
    const signal = request.current?.signal;
    setDownloading(true);
    try {
      const image = logo ? new Image() : null;
      if (image) { image.src = logo!; await image.decode(); }
      if (signal?.aborted) return;
      const canvas = qr.current?.querySelector('canvas'); if (!canvas) return;
      const output = document.createElement('canvas'); output.width = canvas.width; output.height = canvas.height;
      const context = output.getContext('2d')!;
      context.drawImage(canvas, 0, 0);
      // Include the logo even when the QR component is still loading its image.
      if (image) { const size = logoSize * canvas.width / qrSize; context.drawImage(image, (canvas.width - size) / 2, (canvas.height - size) / 2, size, size); }
      const a = document.createElement('a'); a.href = output.toDataURL('image/png'); a.download = '问卷二维码.png'; a.click();
    } catch { message.error('二维码下载失败，请重试'); }
    finally { if (!signal?.aborted) setDownloading(false); }
  }
  return <Modal open={open} onCancel={onClose} footer={null} title="分享问卷" width={460} destroyOnHidden><div className="share-content"><div className="share-icon"><QrcodeOutlined/></div><h3>让更多声音被听见</h3><p>分享链接或二维码，邀请大家填写问卷</p>{error ? <Alert type="error" title={error}/> : !url ? <Spin/> : <>
    <div className="qr-box" ref={qr}><QRCode value={url} size={qrSize} bordered={false} color="#000000" bgColor="#ffffff" marginSize={4} errorLevel="H" icon={logo || undefined} iconSize={logoSize}/></div>
    <div className="qr-hint"><CheckCircleFilled/> 扫一扫，即可开始填写</div>
    <Button icon={<DownloadOutlined/>} loading={downloading} disabled={saving} onClick={() => void download()}>下载二维码</Button>
    <div className="qr-logo-settings">
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传二维码 Logo" hidden style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void saveLogo(file); }}/>
      <div className="qr-logo-controls"><Button icon={<UploadOutlined/>} loading={saving} disabled={downloading} onClick={() => fileInput.current?.click()}>{logo ? '更换中心 Logo' : '上传中心 Logo'}</Button>{logo && <Button icon={<DeleteOutlined/>} disabled={saving || downloading} onClick={() => void saveLogo(undefined, true)}>移除 Logo</Button>}</div>
      <p>可选，PNG / JPG / WebP，最大 5MB。自动保存到当前问卷，下载时一并包含。</p>
    </div>
    <div className="share-link"><Input readOnly value={url} data-testid="share-url" aria-label="填写链接"/><Button icon={<CopyOutlined/>} onClick={async () => { try { await navigator.clipboard.writeText(url); message.success('链接已复制'); } catch { message.info('请选中链接手动复制'); } }}>复制</Button></div>{['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname) && <Alert type="info" title="当前链接使用本机地址。手机扫码请通过可访问的域名或局域网 IP 打开后台后重新分享，也可配置 APP_URL 固定分享地址。" showIcon/>}
  </>}</div></Modal>;
}
