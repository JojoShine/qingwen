'use client';
import { DatePicker, Divider, Form, InputNumber, Switch } from 'antd';
import dayjs from 'dayjs';
import type { SurveyData } from '@/lib/survey';
export default function CollectionSettings({ survey, onChange }: { survey: SurveyData; onChange: (patch: Partial<SurveyData>) => void }) {
  const limits = [
    { key: 'maxResponses', label: '限制收集份数', input: '最多收集份数', hint: '达到上限后停止接收新答卷。' },
    { key: 'browserLimit', label: '限制同一浏览器提交次数', input: '同一浏览器最多提交', hint: '通过浏览器 Cookie 识别，清除 Cookie 或更换浏览器后会重新计算。' },
    { key: 'ipLimit', label: '限制同一 IP 提交次数', input: '同一 IP 最多提交', hint: survey.canLimitIp ? '同一网络可能共用 IP，请按需开启，避免影响其他填写者。' : '当前环境暂不支持 IP 限制，可先使用浏览器限制。' },
  ] as const;
  return <Form layout="vertical" className="collection-settings">
    <h4>收集时间</h4><p className="field-hint">留空表示不限制。时间按当前设备所在时区显示。</p>
    <Form.Item label="开始时间"><DatePicker aria-label="收集开始时间" showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} value={survey.startsAt ? dayjs(survey.startsAt) : null} onChange={value => onChange({ startsAt: value?.toISOString() ?? null })}/></Form.Item>
    <Form.Item label="截止时间"><DatePicker aria-label="收集截止时间" showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} value={survey.endsAt ? dayjs(survey.endsAt) : null} onChange={value => onChange({ endsAt: value?.toISOString() ?? null })}/></Form.Item>
    <Divider/><h4>份数与提交次数</h4>
    {limits.map(({ key, label, input, hint }) => <div className="collection-limit" key={key}><div className="property-switch"><span>{label}</span><Switch aria-label={label} checked={survey[key] != null} disabled={key === 'ipLimit' && !survey.canLimitIp && survey.ipLimit == null} onChange={enabled => onChange({ [key]: enabled ? 1 : null })}/></div>{survey[key] != null && <Form.Item label={input}><InputNumber aria-label={input} min={1} max={1000000} precision={0} style={{ width: '100%' }} value={survey[key]} disabled={key === 'ipLimit' && !survey.canLimitIp} onChange={value => onChange({ [key]: value ?? 1 })}/></Form.Item>}<p className="field-hint">{hint}</p></div>)}
    <p className="collection-note">份数和提交次数包含全部已提交答卷，标记无效不会释放名额。修改设置后请保存。</p>
  </Form>;
}
