'use client';
import { Button, Checkbox, DatePicker, Input, InputNumber, Radio, Rate, Select } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, HolderOutlined } from '@ant-design/icons';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import dayjs from 'dayjs';
import type { Answer, Question } from '@/lib/survey';
function RankingItem({ id, label, index, count, disabled, move }: { id: string; label: string; index: number; count: number; disabled: boolean; move: (from: number, to: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });
  return <div ref={setNodeRef} className="ranking-item" style={{ transform: CSS.Transform.toString(transform), transition }}><button type="button" className="drag-handle" {...attributes} {...listeners} disabled={disabled} aria-label={`拖动 ${label}`}><HolderOutlined/></button><b>{index + 1}</b><span>{label}</span><Button type="text" size="small" icon={<ArrowUpOutlined/>} disabled={disabled || index === 0} onClick={() => move(index,index-1)} aria-label={`上移 ${label}`}/><Button type="text" size="small" icon={<ArrowDownOutlined/>} disabled={disabled || index === count - 1} onClick={() => move(index,index+1)} aria-label={`下移 ${label}`}/></div>;
}
export default function QuestionField({ question: q, answer, onChange, disabled = false }: { question: Question; answer?: Answer; onChange: (answer: Answer) => void; disabled?: boolean }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const v = answer?.value;
  const update = (value: Answer['value']) => onChange({ value, ...((value === '__other' || (Array.isArray(value) && value.includes('__other'))) ? { other: answer?.other || '' } : {}) });
  const options = [...q.options, ...(q.other && ['single','multiple'].includes(q.type) ? [{ id: '__other', label: '其他' }] : [])];
  const other = q.other && (v === '__other' || (Array.isArray(v) && v.includes('__other')));
  switch (q.type) {
    case 'single': case 'multiple': return <div><div className="choice-options">{q.type === 'single' ? <Radio.Group disabled={disabled} value={v} onChange={e => update(e.target.value)} aria-label={q.title}>{options.map(o => <Radio key={o.id} value={o.id}>{o.label}</Radio>)}</Radio.Group> : <Checkbox.Group disabled={disabled} value={Array.isArray(v) ? v : []} onChange={values => { const selected = values as string[]; const exclusive = q.exclusiveOptionId; const previous = Array.isArray(v) ? v : []; update(exclusive && selected.includes(exclusive) ? previous.includes(exclusive) && selected.length > 1 ? selected.filter(id => id !== exclusive) : [exclusive] : selected); }} aria-label={q.title}>{options.map(o => <Checkbox key={o.id} value={o.id}>{o.label}</Checkbox>)}</Checkbox.Group>}</div>{other && <div className="other-input">{q.otherInputMode === 'single' ? <Input aria-label="其他补充内容" placeholder="请填写具体内容" value={answer?.other || ''} maxLength={5000} disabled={disabled} onChange={e => onChange({ value: v!, other: e.target.value })}/> : <Input.TextArea aria-label="其他补充内容" placeholder="请填写具体内容" value={answer?.other || ''} maxLength={5000} autoSize={{ minRows: 3, maxRows: 6 }} disabled={disabled} onChange={e => onChange({ value: v!, other: e.target.value })}/>}</div>}</div>;
    case 'select': return <Select style={{ width: '100%' }} disabled={disabled} placeholder={q.placeholder || '请选择'} value={typeof v === 'string' ? v : undefined} allowClear options={q.options.map(o => ({ value: o.id, label: o.label }))} onChange={value => update(value ?? null)} aria-label={q.title}/>;
    case 'text': return <Input type={q.textFormat === 'email' ? 'email' : q.textFormat === 'phone' ? 'tel' : 'text'} inputMode={q.textFormat === 'phone' ? 'tel' : q.textFormat === 'email' ? 'email' : 'text'} disabled={disabled} aria-label={q.title} value={typeof v === 'string' ? v : ''} placeholder={q.placeholder || '请输入你的回答'} maxLength={q.maxLength} onChange={e => update(e.target.value)}/>;
    case 'textarea': return <Input.TextArea disabled={disabled} aria-label={q.title} rows={4} value={typeof v === 'string' ? v : ''} placeholder={q.placeholder || '写下你的想法…'} maxLength={q.maxLength} showCount onChange={e => update(e.target.value)}/>;
    case 'number': return <InputNumber disabled={disabled} aria-label={q.title} style={{ width: '100%' }} value={typeof v === 'number' ? v : null} placeholder={q.placeholder || '请输入数字'} min={q.min} max={q.max} onChange={value => update(value)}/>;
    case 'date': return <DatePicker disabled={disabled} aria-label={q.title} style={{ width: '100%' }} value={typeof v === 'string' && dayjs(v).isValid() ? dayjs(v) : null} onChange={value => update(value ? value.format('YYYY-MM-DD') : null)}/>;
    case 'rating': return <div className="rating-field"><Rate disabled={disabled} value={typeof v === 'number' ? v : 0} onChange={value => update(value || null)}/><div><span>不太满意</span><span>非常满意</span></div></div>;
    case 'ranking': {
      const order = Array.isArray(v) && v.length === q.options.length ? v : q.options.map(o => o.id);
      const move = (from: number, to: number) => update(arrayMove(order, from, to));
      const drag = (event: DragEndEvent) => { if (event.over && event.active.id !== event.over.id) move(order.indexOf(String(event.active.id)), order.indexOf(String(event.over.id))); };
      return <><p className="field-hint">拖动或使用箭头调整顺序；未调整时按当前顺序提交。</p><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drag}><SortableContext items={order} strategy={verticalListSortingStrategy}>{order.map((id, i) => <RankingItem key={id} id={id} label={q.options.find(o => o.id === id)?.label || ''} index={i} count={order.length} disabled={disabled} move={move}/>)}</SortableContext></DndContext></>;
    }
    case 'matrixSingle': case 'matrixMultiple': {
      const value = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
      return <div className="matrix-scroll"><table className="matrix-table"><thead><tr><th>项目</th>{q.options.map(o => <th key={o.id}>{o.label}</th>)}</tr></thead><tbody>{q.rows.map(row => <tr key={row.id}><th>{row.label}</th>{q.options.map(o => <td key={o.id}>{q.type === 'matrixSingle' ? <Radio aria-label={`${row.label} - ${o.label}`} disabled={disabled} checked={value[row.id] === o.id} onChange={() => update({ ...value, [row.id]: o.id })}/> : <Checkbox aria-label={`${row.label} - ${o.label}`} disabled={disabled} checked={Array.isArray(value[row.id]) && value[row.id].includes(o.id)} onChange={e => { const current: string[] = Array.isArray(value[row.id]) ? value[row.id] as string[] : []; update({ ...value, [row.id]: e.target.checked ? [...current, o.id] : current.filter(id => id !== o.id) }); }}/>}</td>)}</tr>)}</tbody></table></div>;
    }
    default: return null;
  }
}
