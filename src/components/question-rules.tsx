'use client';
import { Divider, Form, InputNumber, Select, Switch } from 'antd';
import type { Question } from '@/lib/survey';
export default function QuestionRules({ question: q, content, onChange }: { question: Question; content: Question[]; onChange: (patch: Partial<Question>) => void }) {
  if (q.type === 'section') return null;
  const sources = content.slice(0, content.findIndex(item => item.id === q.id)).filter(item => ['single','multiple','select'].includes(item.type) && item.options.length);
  const source = sources.find(item => item.id === q.showWhen?.questionId);
  const options = source ? [...source.options, ...(source.other && source.type !== 'select' ? [{ id: '__other', label: '其他' }] : [])] : [];
  return <>
    {q.type === 'attachment' && <><Form.Item label="允许的附件类型"><Select aria-label="允许的附件类型" value={q.fileMode ?? 'all'} options={[{value:'all',label:'图片与文档'},{value:'images',label:'仅图片'},{value:'documents',label:'仅文档及 ZIP'}]} onChange={fileMode=>onChange({fileMode})}/></Form.Item><Form.Item label="最多上传数量"><InputNumber aria-label="最多上传数量" min={1} max={5} value={q.maxFiles ?? 1} onChange={value=>onChange({maxFiles:value ?? 1})}/></Form.Item><Form.Item label="单个文件上限（MB）"><InputNumber aria-label="单个文件上限" min={1} max={10} value={q.maxFileSizeMB ?? 10} onChange={value=>onChange({maxFileSizeMB:value ?? 10})}/></Form.Item><p className="field-hint">每份答卷附件最多 10 个、合计 20MB；手机可选择照片或文件，PC 支持拖拽。</p></>}
    {q.type === 'text' && <Form.Item label="输入格式"><Select aria-label="输入格式" value={q.textFormat ?? 'text'} options={[{ value: 'text', label: '普通文字' }, { value: 'phone', label: '手机号码（中国大陆 11 位）' }, { value: 'email', label: '邮箱地址' }]} onChange={textFormat => onChange({ textFormat })}/></Form.Item>}
    {q.type === 'multiple' && <><Form.Item label="互斥选项"><Select aria-label="互斥选项" placeholder="不设置" allowClear value={q.exclusiveOptionId ?? undefined} options={q.options.map(o => ({ value: o.id, label: o.label }))} onChange={exclusiveOptionId => onChange({ exclusiveOptionId: exclusiveOptionId ?? null })}/></Form.Item><p className="field-hint">适用于“以上均无”等选项。选中后不能与其他选项同时选择，且不受最少选择数限制。</p></>}
    <Divider/><div className="property-switch"><span>按条件显示本题</span><Switch aria-label="按条件显示本题" checked={!!q.showWhen} disabled={!sources.length} onChange={enabled => onChange({ showWhen: enabled ? { questionId: sources[0].id, optionId: sources[0].options[0].id } : null })}/></div>
    {!sources.length && <p className="field-hint">在本题前添加一道选择题后，即可设置显示条件。</p>}
    {q.showWhen && <><Form.Item label="当这道题"><Select aria-label="条件来源题目" value={q.showWhen.questionId} options={sources.map(item => ({ value: item.id, label: item.title }))} onChange={questionId => { const source = sources.find(item => item.id === questionId)!; onChange({ showWhen: { questionId, optionId: source.options[0].id } }); }}/></Form.Item><Form.Item label="选择以下选项时显示"><Select aria-label="条件来源选项" value={q.showWhen.optionId} options={options.map(o => ({ value: o.id, label: o.label }))} onChange={optionId => onChange({ showWhen: { questionId: q.showWhen!.questionId, optionId } })}/></Form.Item><p className="field-hint">仅引用前面的单选、多选或下拉题。隐藏时不要求作答，也不会保存该题答案。</p></>}
  </>;
}
