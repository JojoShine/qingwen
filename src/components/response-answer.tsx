'use client';
import { Rate } from 'antd';
import ResponseAttachments from './response-attachments';
import { CheckCircleFilled } from '@ant-design/icons';
import { answerText, ratingLabels, type Answer, type Question } from '@/lib/survey';

export default function ResponseAnswer({ question: q, answer }: { question: Question; answer?: Answer }) {
  const value = answer?.value;
  const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
  if (q.type === 'attachment') return <ResponseAttachments files={answer?.files || []}/>;
  if (q.type === 'rating') {
    const stars = Number(value);
    return empty ? <p className="response-empty">未作答</p> : <div className="response-rating" aria-label={`${stars} 星，${ratingLabels[stars - 1]}`}><Rate disabled value={stars}/><strong>{ratingLabels[stars - 1]}</strong><span>{stars} / 5 星</span></div>;
  }
  if (['single', 'multiple', 'select'].includes(q.type)) {
    const selected = Array.isArray(value) ? value : [value];
    const options = [...q.options, ...(q.other ? [{ id: '__other', label: '其他' }] : [])];
    return <>{empty && <p className="response-empty">未作答</p>}<ul className="response-options" aria-label="题目选项与作答">{options.map((option, i) => {
      const checked = selected.includes(option.id);
      return <li key={option.id} className={checked ? 'is-selected' : ''}><span className="response-option-index">{i + 1}</span><div><span>{option.label}</span>{option.id === '__other' && checked && answer?.other && <p className="response-other">{answer.other}</p>}</div>{checked && <span className="response-option-selected"><CheckCircleFilled/> 已选</span>}</li>;
    })}</ul></>;
  }
  if (q.type === 'ranking') {
    if (empty || !Array.isArray(value)) return <p className="response-empty">未作答</p>;
    return <ol className="response-ranking">{value.map((id, i) => <li key={id}><span>第 {i + 1} 名</span><strong>{q.options.find(option => option.id === id)?.label || id}</strong><small>原选项 {q.options.findIndex(option => option.id === id) + 1}</small></li>)}</ol>;
  }
  if (q.type.startsWith('matrix')) {
    const rows = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return <div className="matrix-scroll"><table className="matrix-table response-matrix"><caption className="response-empty">各项目与选项的作答情况</caption><thead><tr><th>项目</th>{q.options.map((option, i) => <th key={option.id}>{i + 1}. {option.label}</th>)}</tr></thead><tbody>{q.rows.map(row => <tr key={row.id}><th>{row.label}{!rows[row.id] && <small> · 未作答</small>}</th>{q.options.map(option => <td key={option.id}>{(Array.isArray(rows[row.id]) ? rows[row.id].includes(option.id) : rows[row.id] === option.id) ? <span className="response-matrix-selected"><CheckCircleFilled aria-hidden="true"/> 已选</span> : <span className="muted">—</span>}</td>)}</tr>)}</tbody></table></div>;
  }
  return <p className={empty ? 'response-empty' : 'response-value'}>{empty ? '未作答' : answerText(q, answer)}</p>;
}
