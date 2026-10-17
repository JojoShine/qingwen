'use client';
import { Button, DatePicker, Select } from 'antd';
import dayjs from 'dayjs';
import type { Question } from '@/lib/survey';
export type ResponseFilterValues = { validity: string; from: string; to: string; questionId: string; optionId: string };
export const emptyResponseFilters: ResponseFilterValues = { validity: 'valid', from: '', to: '', questionId: '', optionId: '' };
export default function ResponseFilters({ content, value, onChange, onApply, onReset, loading }: { content: Question[]; value: ResponseFilterValues; onChange: (value: ResponseFilterValues) => void; onApply: () => void; onReset: () => void; loading: boolean }) {
  const questions = content.filter(q => ['single','multiple','select'].includes(q.type));
  const question = questions.find(q => q.id === value.questionId);
  const options = question ? [...question.options, ...(question.other && question.type !== 'select' ? [{ id: '__other', label: '其他' }] : [])] : [];
  return <div className="response-filters">
    <div><label>答卷状态</label><Select aria-label="筛选答卷状态" value={value.validity} options={[{ value: 'valid', label: '有效答卷' }, { value: 'invalid', label: '无效答卷' }, { value: 'all', label: '全部答卷' }]} onChange={validity => onChange({ ...value, validity })}/></div>
    <div className="response-date-filter"><label>提交日期</label><DatePicker.RangePicker aria-label="筛选提交日期" placeholder={['开始日期','截止日期']} value={value.from && value.to ? [dayjs(value.from), dayjs(value.to)] : null} onChange={dates => onChange({ ...value, from: dates?.[0]?.startOf('day').toISOString() ?? '', to: dates?.[1]?.endOf('day').toISOString() ?? '' })}/></div>
    <div className="response-question-filter"><label>答案条件</label><Select aria-label="筛选题目" allowClear placeholder="选择题目" value={value.questionId || undefined} options={questions.map(q => ({ value: q.id, label: q.title }))} onChange={questionId => onChange({ ...value, questionId: questionId ?? '', optionId: '' })}/></div>
    <div><label>包含选项</label><Select aria-label="筛选答案选项" allowClear disabled={!question} placeholder="选择选项" value={value.optionId || undefined} options={options.map(o => ({ value: o.id, label: o.label }))} onChange={optionId => onChange({ ...value, optionId: optionId ?? '' })}/></div>
    <div className="response-filter-actions"><Button aria-label="筛选" type="primary" loading={loading} disabled={!!value.questionId && !value.optionId} onClick={onApply}>筛选</Button><Button aria-label="重置" disabled={loading} onClick={onReset}>重置</Button></div>
  </div>;
}
