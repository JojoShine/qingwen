'use client';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Button, Modal } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { validDateValue, type DatePrecision } from '@/lib/date-question';

const rowHeight = 44;
const pad = (value: number) => String(value).padStart(2, '0');
type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };
function readParts(value: string, precision: DatePrecision): Parts {
  const now = new Date();
  return validDateValue(value, precision) ? { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)), day: Number(value.slice(8, 10)), hour: Number(value.slice(11, 13)) || 0, minute: Number(value.slice(14, 16)) || 0, second: Number(value.slice(17, 19)) || 0 } : { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: now.getHours(), minute: now.getMinutes(), second: 0 };
}
function serialize(parts: Parts, precision: DatePrecision) {
  const date = `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}`;
  return date + (precision === 'date' ? '' : `T${pad(parts.hour)}:${pad(parts.minute)}` + (precision === 'second' ? `:${pad(parts.second)}` : ''));
}
function daysInMonth(year: number, month: number) {
  return month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function Wheel({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const index = value - min, count = max - min + 1;
  const first = Math.max(0, index - 4), last = Math.min(count - 1, index + 4);
  useLayoutEffect(() => {
    const element = ref.current!;
    if (Math.round(element.scrollTop / rowHeight) !== index) element.scrollTop = index * rowHeight;
  }, [index]);
  return <div className="date-wheel-column"><span className="date-wheel-label">{label}</span><div ref={ref} className="date-wheel" role="spinbutton" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value}${label}`} onKeyDown={event => {
    const change = { ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 }[event.key];
    if (change !== undefined || event.key === 'Home' || event.key === 'End') { event.preventDefault(); onChange(event.key === 'Home' ? min : event.key === 'End' ? max : Math.max(min, Math.min(max, value + change!))); }
  }} onScroll={event => {
    const next = Math.max(min, Math.min(max, min + Math.round(event.currentTarget.scrollTop / rowHeight)));
    if (next !== value) onChange(next);
  }}><div style={{ paddingTop: first * rowHeight + rowHeight * 2, paddingBottom: (count - last - 1) * rowHeight + rowHeight * 2 }}>{Array.from({ length: last - first + 1 }, (_, offset) => first + offset + min).map(item => <div key={item} aria-hidden="true" className={'date-wheel-item' + (item === value ? ' is-selected' : '')} onClick={() => onChange(item)}>{label === '年' ? item : pad(item)}</div>)}</div></div></div>;
}

export default function DateQuestion({ title, value, precision = 'date', disabled, onChange }: { title: string; value: string; precision?: DatePrecision; disabled: boolean; onChange: (value: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Parts>(() => readParts(value, precision));
  const dialogId = useId();
  const show = () => { if (!disabled) { setDraft(readParts(value, precision)); setOpen(true); } };
  const setPart = (key: keyof Parts, next: number) => setDraft(previous => { const updated = { ...previous, [key]: next }; updated.day = Math.min(updated.day, daysInMonth(updated.year, updated.month)); return updated; });
  const formatted = serialize(draft, precision).replace('T', ' ');
  return <><div className="survey-date-field"><input type="text" inputMode="none" className="survey-date-input" disabled={disabled} aria-label={title} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined} placeholder={precision === 'date' ? '请选择日期' : precision === 'minute' ? '请选择日期和时间（时分）' : '请选择日期和时间（时分秒）'} value={value.replace('T', ' ')} onChange={event => onChange(event.target.value.replace(' ', 'T') || null)} onClick={show} onKeyDown={event => { if (event.key === 'Enter' || event.key === 'ArrowDown') { event.preventDefault(); show(); } }}/><button type="button" className="survey-date-trigger" disabled={disabled} aria-label={`${title}：打开日期选择`} onClick={show}><CalendarOutlined/></button></div>
    <Modal open={open} onCancel={() => setOpen(false)} title={precision === 'date' ? '选择日期' : '选择日期和时间'} footer={null} width={precision === 'date' ? 420 : 540} centered className="question-date-modal" classNames={{ wrapper: 'question-date-wrap' }} destroyOnHidden>
      <div id={dialogId} className="question-date-picker"><p className="date-picker-value" aria-live="polite">{formatted}</p><div className="date-wheel-group">
        <Wheel label="年" value={draft.year} min={1} max={9999} onChange={next => setPart('year', next)}/><Wheel label="月" value={draft.month} min={1} max={12} onChange={next => setPart('month', next)}/><Wheel label="日" value={draft.day} min={1} max={daysInMonth(draft.year, draft.month)} onChange={next => setPart('day', next)}/>
        {precision !== 'date' && <><Wheel label="时" value={draft.hour} min={0} max={23} onChange={next => setPart('hour', next)}/><Wheel label="分" value={draft.minute} min={0} max={59} onChange={next => setPart('minute', next)}/></>}{precision === 'second' && <Wheel label="秒" value={draft.second} min={0} max={59} onChange={next => setPart('second', next)}/>}</div>
        <div className="date-picker-actions"><Button aria-label="清空" onClick={() => { onChange(null); setOpen(false); }}>清空</Button><span/><Button aria-label="取消" onClick={() => setOpen(false)}>取消</Button><Button aria-label="确定" type="primary" onClick={() => { onChange(serialize(draft, precision)); setOpen(false); }}>确定</Button></div>
      </div>
    </Modal>
  </>;
}
