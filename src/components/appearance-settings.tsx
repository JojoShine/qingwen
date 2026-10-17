'use client';
import { useRef, useState } from 'react';
import { App, Button, Divider, Form, Input, Radio, Switch } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { defaultBranding, bannerCaptions, themes, type SurveyData } from '@/lib/survey';
import { prepareBannerImage } from '@/lib/image-upload';
import Banner from './banner';

export default function AppearanceSettings({ survey, onChange, onPlatformChange }: { survey: SurveyData; onChange: (patch: Partial<SurveyData>) => void; onPlatformChange: (platform: string) => void }) {
  const { message } = App.useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const caption = bannerCaptions[survey.banner];
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const image = await prepareBannerImage(file);
      onChange({ banner: 'custom', bannerImage: image });
      message.success('图片已添加，保存问卷后生效');
    } catch (e) { message.error((e as Error).message); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  return <Form layout="vertical" className="appearance-settings">
    <h4>填写平台</h4>
    <Radio.Group value={survey.platform} onChange={e => { onChange({ platform: e.target.value }); onPlatformChange(e.target.value); }}><Radio value="mobile">移动端</Radio><Radio value="desktop">PC 端</Radio></Radio.Group>
    <p className="field-hint">移动端按手机宽度显示，PC 端使用宽版布局。</p>
    <Divider/>
    <div className="property-switch"><span>显示底部品牌信息</span><Switch aria-label="显示底部品牌信息" checked={survey.showBranding !== false} onChange={showBranding => onChange({ showBranding })}/></div>
    <p className="field-hint">控制问卷底部品牌信息的显示，关闭后仍会保留文案。</p>
    {survey.showBranding !== false && <><Form.Item label="品牌名称"><Input aria-label="底部品牌名称" value={survey.brandName ?? defaultBranding.brandName} maxLength={40} placeholder="请输入品牌名称" onChange={e => onChange({ brandName: e.target.value })}/></Form.Item><Form.Item label="说明文字"><Input.TextArea aria-label="底部说明文字" value={survey.brandDescription ?? defaultBranding.brandDescription} maxLength={120} autoSize={{ minRows: 2, maxRows: 4 }} placeholder="可选，留空则不显示" onChange={e => onChange({ brandDescription: e.target.value })}/></Form.Item></>}
    <Divider/>
    <h4>页面背景</h4>
    <p className="field-hint">应用到手机和 PC 的整个填写页面，预览与正式问卷保持一致。</p>
    <div className="theme-grid">{themes.map(t => <button type="button" aria-label={`页面背景：${t.name}`} aria-pressed={survey.background === t.id} className={survey.background === t.id ? 'selected' : ''} key={t.id} onClick={() => onChange({ background: t.id })}><i className={`bg-${t.id}`}/>{t.name}{survey.background === t.id && <CheckCircleOutlined/>}</button>)}</div>
    <Divider/>
    <h4>Banner 模板</h4>
    <p className="field-hint">选择内置模板，或上传自己的横幅图片。</p>
    <div className="banner-options">{themes.map(t => <button type="button" aria-label={`Banner 模板：${t.name}`} aria-pressed={survey.banner === t.id} key={t.id} className={survey.banner === t.id ? 'selected' : ''} onClick={() => onChange({ banner: t.id })}>{t.id === 'none' ? <div className="no-banner-option">不使用 Banner</div> : <Banner theme={t.id} small/>}<span>{t.name}{survey.banner === t.id && <CheckCircleOutlined/>}</span></button>)}</div>
    <div className="banner-upload">
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传 Banner 图片" hidden style={{ display: 'none' }} onChange={e => void upload(e.target.files?.[0])}/>
      {survey.bannerImage && <><button type="button" className={`uploaded-banner ${survey.banner === 'custom' ? 'selected' : ''}`} aria-label="使用已上传的 Banner 图片" onClick={() => onChange({ banner: 'custom' })}><img src={survey.bannerImage} alt="已上传的 Banner"/><span>自定义图片{survey.banner === 'custom' && <CheckCircleOutlined/>}</span></button><Button type="text" danger size="small" icon={<DeleteOutlined/>} onClick={() => onChange({ bannerImage: null, ...(survey.banner === 'custom' ? { banner: 'none' } : {}) })}>移除图片</Button></>}
      <Button block type="dashed" icon={<UploadOutlined/>} loading={uploading} onClick={() => fileInput.current?.click()}>{survey.bannerImage ? '更换 Banner 图片' : '上传 Banner 图片'}</Button>
      <p className="field-hint">PNG / JPG / WebP，最大 5MB。建议使用横向图片，系统会自动压缩，展示时居中裁切。</p>
    </div>
    {survey.banner !== 'none' && <><Divider/><h4>Banner 文字</h4><Form.Item label="主标题"><Input aria-label="Banner 主标题" value={survey.bannerTitle ?? caption?.title ?? ''} maxLength={60} placeholder="可选，留空则不显示" onChange={e => onChange({ bannerTitle: e.target.value })}/></Form.Item><Form.Item label="副标题"><Input aria-label="Banner 副标题" value={survey.bannerSubtitle ?? caption?.subtitle ?? ''} maxLength={80} placeholder="可选，留空则不显示" onChange={e => onChange({ bannerSubtitle: e.target.value })}/></Form.Item><Button onClick={() => onChange({ bannerTitle: null, bannerSubtitle: null })}>恢复模板默认文字</Button></>}
  </Form>;
}
