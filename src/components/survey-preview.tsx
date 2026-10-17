'use client';
import { withBasePath } from '@/lib/paths';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import { type SurveyData } from '@/lib/survey';
import PublicSurvey from './public-survey';

function PhonePreview({ survey }: { survey: SurveyData }) {
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const area = stage.current!.getBoundingClientRect();
      setScale(Math.min(1, area.width / 414, area.height / 844));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage.current!);
    return () => observer.disconnect();
  }, []);
  const send = () => frame.current?.contentWindow?.postMessage({ type: 'qingwen:preview-data', survey }, window.location.origin);
  useEffect(() => {
    const ready = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'qingwen:preview-ready') send();
    };
    window.addEventListener('message', ready);
    send();
    return () => window.removeEventListener('message', ready);
  }, [survey]);
  return <div className="phone-preview-stage" ref={stage}>
    <div className="phone-fit" style={{ width: 414 * scale, height: 844 * scale }}>
      <div className="phone-device" style={{ transform: `scale(${scale})` }}>
        <div className="phone-key phone-key-silent" aria-hidden="true"/><div className="phone-key phone-key-volume" aria-hidden="true"/><div className="phone-key phone-key-power" aria-hidden="true"/>
        <div className={`phone-screen ${survey.banner === 'custom' ? 'has-photo-banner' : ''}`}>
          <div className="phone-status-bar" aria-hidden="true"><span>9:41</span><div className="phone-island"/><div className="phone-status-icons"><svg viewBox="0 0 52 16" width="52" height="16"><path d="M1 12h2v3H1zm4-3h2v6H5zm4-3h2v9H9zm4-4h2v13h-2" fill="currentColor"/><path d="M20 6q6-6 12 0m-10 3q4-4 8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="26" cy="12" r="1.5" fill="currentColor"/><rect x="36" y="3" width="13" height="10" rx="2" fill="none" stroke="currentColor"/><rect x="38" y="5" width="9" height="6" rx="1" fill="currentColor"/><path d="M51 6v4" stroke="currentColor" strokeWidth="1.5"/></svg></div></div>
          <iframe ref={frame} src={withBasePath('/preview')} title="手机问卷预览" onLoad={send}/>
          <div className="phone-home-area" aria-hidden="true"><span/></div>
        </div>
      </div>
    </div>
  </div>;
}

export default function SurveyPreview({ survey, open, onClose }: { survey: SurveyData; open: boolean; onClose: () => void }) {
  const mobile = survey.platform === 'mobile';
  return <Modal open={open} onCancel={onClose} footer={null} title="问卷预览" width={mobile ? 520 : 1080} centered className={`survey-preview-modal ${mobile ? 'mobile-preview-modal' : ''}`} destroyOnHidden>
    {mobile ? <PhonePreview survey={survey}/> : <div className="desktop-preview-content"><PublicSurvey survey={survey} preview/></div>}
    <p className="preview-caption">{mobile ? '手机预览 · 可在屏幕内滚动和试填' : 'PC 预览 · 可试填问卷'}<span>预览不会保存答卷</span></p>
  </Modal>;
}
