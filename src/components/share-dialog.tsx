'use client';
import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Modal, QRCode, Spin, Alert } from 'antd';
import { CopyOutlined, DownloadOutlined, QrcodeOutlined, CheckCircleFilled } from '@ant-design/icons';
import { api } from '@/lib/client';
export default function ShareDialog({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState(''), [error, setError] = useState(''); const qr = useRef<HTMLDivElement>(null); const { message } = App.useApp();
  useEffect(() => { if (open) { setUrl(''); setError(''); api<{ url: string }>(`/surveys/${id}/share`).then(r => setUrl(r.url)).catch(e => setError(e.message)); } }, [id, open]);
  function download() { const canvas = qr.current?.querySelector('canvas'); if (!canvas) return; const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = '问卷二维码.png'; a.click(); }
  return <Modal open={open} onCancel={onClose} footer={null} title="分享问卷" width={460} destroyOnHidden><div className="share-content"><div className="share-icon"><QrcodeOutlined/></div><h3>让更多声音被听见</h3><p>分享链接或二维码，邀请大家填写问卷</p>{error ? <Alert type="error" title={error}/> : !url ? <Spin/> : <><div className="qr-box" ref={qr}><QRCode value={url} size={190} bordered={false} color="#164b42"/></div><div className="qr-hint"><CheckCircleFilled/> 扫一扫，即可开始填写</div><Button icon={<DownloadOutlined/>} onClick={download}>下载二维码</Button><div className="share-link"><Input readOnly value={url} data-testid="share-url" aria-label="填写链接"/><Button icon={<CopyOutlined/>} onClick={async () => { try { await navigator.clipboard.writeText(url); message.success('链接已复制'); } catch { message.info('请选中链接手动复制'); } }}>复制</Button></div>{/localhost|127\.0\.0\.1/.test(url) && <Alert type="info" title="手机扫码需将 APP_URL 配置为手机可访问的局域网或部署地址。" showIcon/>}</>}</div></Modal>;
}
