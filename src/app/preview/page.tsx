'use client';
import { useEffect, useState } from 'react';
import PublicSurvey from '@/components/public-survey';
import type { SurveyData } from '@/lib/survey';

export default function PreviewPage() {
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin || event.data?.type !== 'qingwen:preview-data') return;
      if (Array.isArray(event.data.survey?.content) && typeof event.data.survey?.title === 'string') setSurvey(event.data.survey);
    };
    window.addEventListener('message', receive);
    if (window.parent !== window) window.parent.postMessage({ type: 'qingwen:preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <div className="phone-preview-page">{survey ? <PublicSurvey key={survey.id} survey={survey} preview/> : <p className="preview-loading" role="status">请从问卷编辑器打开预览</p>}</div>;
}
