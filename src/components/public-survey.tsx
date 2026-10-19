'use client';
import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Progress, Result, Skeleton } from 'antd';
import { ArrowRightOutlined, CheckCircleFilled, LockOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, ApiError, useLoad } from '@/lib/client';
import { initialAnswers, uid, validateAnswers, visibleContent, visibleAnswers, type Answers, type SurveyData } from '@/lib/survey';
import Banner from './banner';
import BrandFooter from './brand-footer';
import QuestionField from './question-field';
export function PublicSurveyLoader({ shareId }: { shareId: string }) {
  const { data, error, reload } = useLoad<SurveyData>(`/public/${shareId}`);
  if (error) return <div className="public-state"><Result status="404" title="问卷暂时无法访问" subTitle={error} extra={<Button onClick={reload}>重新加载</Button>}/></div>;
  if (!data) return <div className="public-loading"><Skeleton active paragraph={{ rows: 8 }}/></div>;
  return <PublicSurvey survey={data}/>;
}
export default function PublicSurvey({ survey, preview = false }: { survey: SurveyData; preview?: boolean }) {
  const [answers, setAnswers] = useState<Answers>(() => visibleAnswers(survey.content || [], initialAnswers(survey.content || []))), [errors, setErrors] = useState<Record<string,string>>({}), [submitting, setSubmitting] = useState(false), [done, setDone] = useState(false), [failure, setFailure] = useState('');
  const [files, setFiles] = useState<Record<string, File>>({});
  const key = useRef<string | null>(null); const { message } = App.useApp();
  useEffect(() => { if (!preview) document.title = survey.browserTitle?.trim() || survey.title; }, [preview, survey.browserTitle, survey.title]);
  if (survey.status === 'CLOSED' && !preview) return <div className="public-state"><Result icon={<span className="public-end-icon"><LockOutlined/></span>} title="问卷已结束" subTitle={`「${survey.title}」已停止收集，感谢你的关注。`}/><BrandFooter survey={survey}/></div>;
  if (survey.availability && !preview) return <div className="public-state"><Result icon={<span className="public-end-icon"><LockOutlined/></span>} title={survey.availabilityMessage} subTitle={survey.availability === 'NOT_STARTED' && survey.startsAt ? `开始时间：${new Date(survey.startsAt).toLocaleString('zh-CN')}` : '感谢你的关注与参与。'}/><BrandFooter survey={survey}/></div>;
  if (done) return <div className={'public-survey bg-'+survey.background}><div className="success-sheet"><div className="success-check"><CheckCircleFilled/></div><span className="eyebrow">EVERY ANSWER MATTERS</span><h1>提交成功，感谢你的参与</h1><p>你的每一份认真回答，<br/>都在帮助我们更好地了解与改进。</p><div className="success-receipt"><CheckCircleFilled/> 答卷已安全保存</div><span className="success-note">现在可以关闭此页面了</span></div><BrandFooter survey={survey}/></div>;
  const content = visibleContent(survey.content, answers);
  const questions = content.filter(q=>q.type!=='section');
  const completed = questions.filter(q => { const a = answers[q.id]?.value; return a !== undefined && a !== null && a !== '' && (!Array.isArray(a) || a.length > 0) && Object.keys(validateAnswers([{...q,required:true,showWhen:null}], {[q.id]:answers[q.id]})).length===0; }).length;
  const submit = async () => {
    const validation = validateAnswers(survey.content, answers); setErrors(validation); setFailure('');
    if (Object.keys(validation).length) { const first = Object.keys(validation)[0]; document.getElementById(`question-${first}`)?.scrollIntoView({ behavior:'smooth',block:'center' }); message.warning('请检查未完成的题目'); return; }
    if (preview) { message.success('预览校验通过，正式发布后即可提交答卷'); return; }
    setSubmitting(true);
    try {
      key.current ||= uid();
      const selected = visibleAnswers(survey.content, answers);
      const payload = JSON.stringify({ submissionKey: key.current, answers: selected });
      const ids = visibleContent(survey.content, answers).filter(q => q.type === 'attachment').flatMap(q => Array.isArray(selected[q.id]?.value) ? selected[q.id].value as string[] : []);
      let body: string | FormData = payload;
      if (ids.length) {
        const form = new FormData(); form.append('payload', payload);
        for (const id of ids) { if (!files[id]) throw new Error('附件已失效，请重新选择'); form.append(`file:${id}`, files[id], files[id].name); }
        body = form;
      }
      await api(`/public/${survey.shareId}`, { method: 'POST', body });
      setFiles({}); setDone(true); window.scrollTo({top:0,behavior:'smooth'});
    }
    catch(e) { if (e instanceof ApiError && e.fields) setErrors(e.fields); setFailure((e as Error).message); }
    finally { setSubmitting(false); }
  };
  let n=0;
  return <div className={`public-survey bg-${survey.background} ${preview?'is-preview':''}`}><div className={`public-sheet public-${survey.platform}`}><Banner theme={survey.banner} title={survey.bannerTitle} subtitle={survey.bannerSubtitle} image={survey.bannerImage}/><div className="public-sheet-content"><div className="public-intro"><span className="public-kicker">一份问卷 · 一次倾听</span><h1>{survey.title}</h1>{survey.description&&<p>{survey.description}</p>}<div className="public-form-meta"><span>{questions.length} 道题目</span><span>标记 <em>*</em> 为必答题</span><span><LockOutlined/> 安心填写</span></div></div><div className="form-progress"><span>填写进度 <b>{completed} / {questions.length}</b></span><Progress percent={questions.length?Math.round(completed/questions.length*100):0} showInfo={false} strokeColor="#168878" size="small"/></div>{content.map(q=>{
    if(q.type==='section')return <div className="section-heading public-section" key={q.id}>{q.title}{q.description&&<p>{q.description}</p>}</div>;
    n++;return <section key={q.id} id={`question-${q.id}`} className={'public-question '+(errors[q.id]?'has-error':'')}><div className="public-question-title"><span className="question-number">{String(n).padStart(2,'0')}</span><h2>{q.title}{q.required&&<em>*</em>}</h2></div>{q.description&&<p className="question-description">{q.description}</p>}<QuestionField question={q} answer={answers[q.id]} disabled={submitting} files={files} onFilesChange={setFiles} onChange={answer=>{const next={...answers,[q.id]:answer};const visible=visibleAnswers(survey.content,{...initialAnswers(visibleContent(survey.content,next)),...next});setAnswers(visible);const kept=new Set(survey.content.filter(item=>item.type==='attachment').flatMap(item=>Array.isArray(visible[item.id]?.value)?visible[item.id].value as string[]:[]));setFiles(prev=>Object.fromEntries(Object.entries(prev).filter(([id])=>kept.has(id))));if(errors[q.id])setErrors(prev=>{const next={...prev};delete next[q.id];return next;});}}/>{errors[q.id]&&<p className="field-error" role="alert">{errors[q.id]}</p>}</section>;
  })}{failure&&<Alert type="error" title={failure} showIcon style={{marginBottom:20}}/>}<div className="public-submit">{submitting && Object.keys(files).length > 0 && <p role="status">正在上传附件并保存答卷，请勿关闭页面…</p>}<Button type="primary" size="large" block loading={submitting} onClick={submit}>提交问卷 <ArrowRightOutlined/></Button><p>感谢你的时间与真诚反馈</p></div></div></div><BrandFooter survey={survey}/>{preview&&<div className="preview-badge">预览模式 · 不会保存答卷</div>}</div>;
}
