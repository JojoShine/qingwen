import type { AttachmentInfo, AttachmentRules } from './attachment';
import { validDateValue, type DatePrecision } from './date-question';

export const questionTypes = {
  single: '单选题', multiple: '多选题', select: '下拉选择', text: '单行填空', textarea: '多行填空',
  number: '数字题', date: '日期题', rating: '评分题', ranking: '排序题', matrixSingle: '矩阵单选', matrixMultiple: '矩阵多选', attachment: '附件上传', section: '分类标题',
} as const;
export type QuestionType = keyof typeof questionTypes;
export type Option = { id: string; label: string };
export type Question = AttachmentRules & { id: string; type: QuestionType; title: string; description: string; required: boolean; options: Option[]; rows: Option[]; other: boolean; otherInputMode?: 'single' | 'multiline'; datePrecision?: DatePrecision; placeholder: string; min?: number; max?: number; maxLength: number; textFormat?: 'text' | 'phone' | 'email'; exclusiveOptionId?: string | null; showWhen?: { questionId: string; optionId: string } | null };
export type Answer = { value: string | string[] | number | Record<string, string | string[]> | null; other?: string; files?: AttachmentInfo[] };
export type Answers = Record<string, Answer>;
export type SurveyData = { id: string; title: string; browserTitle?: string; description: string; status: 'DRAFT' | 'ACTIVE' | 'CLOSED'; platform: 'mobile' | 'desktop'; showBranding?: boolean; brandName?: string; brandDescription?: string; startsAt?: string | null; endsAt?: string | null; maxResponses?: number | null; browserLimit?: number | null; ipLimit?: number | null; canLimitIp?: boolean; availability?: 'NOT_STARTED' | 'ENDED' | 'FULL' | 'LIMIT_REACHED'; availabilityMessage?: string; background: string; banner: string; bannerTitle?: string | null; bannerSubtitle?: string | null; bannerImage?: string | null; content: Question[]; publishedAt: string | null; updatedAt: string; createdAt: string; shareId: string; owner?: { name: string; username: string }; _count?: { responses: number } };
export const themes = [{ id: 'none', name: '不使用', color: '#ffffff' }, { id: 'mint', name: '清新薄荷', color: '#e5f3ef' }, { id: 'warm', name: '日落杏色', color: '#fcf0df' }, { id: 'blue', name: '晴空蔚蓝', color: '#e7effa' }, { id: 'ink', name: '简约墨色', color: '#edf0f2' }];
export const bannerCaptions: Record<string, { title: string; subtitle: string }> = {
  mint: { title: '从你的声音开始', subtitle: 'MAKE ROOM FOR ANSWERS' },
  warm: { title: '听见每一份热爱', subtitle: 'EVERY VOICE MATTERS' },
  blue: { title: '好奇，是探索的开始', subtitle: 'A LITTLE CURIOSITY' },
  ink: { title: '好问题，自有回响', subtitle: 'IDEAS START WITH YOU' },
};
export const ratingLabels = ['很不满意', '不太满意', '一般', '比较满意', '非常满意'] as const;
export const choiceTypes: QuestionType[] = ['single', 'multiple', 'select', 'ranking', 'matrixSingle', 'matrixMultiple'];
export function uid(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function newQuestion(type: QuestionType): Question {
  return { id: uid(), type, title: type === 'section' ? '新的分类' : '请输入题目标题', description: '', required: type !== 'section', options: choiceTypes.includes(type) ? [1, 2].map(n => ({ id: uid(), label: `选项 ${n}` })) : [], rows: type.startsWith('matrix') ? [1, 2].map(n => ({ id: uid(), label: `项目 ${n}` })) : [], other: false, ...(['single','multiple'].includes(type) ? { otherInputMode: 'multiline' as const } : {}), placeholder: '', maxLength: 500, ...(type === 'rating' ? { min: 1, max: 5 } : {}), ...(type === 'attachment' ? { fileMode: 'all' as const, maxFiles: 1, maxFileSizeMB: 10 } : {}) };
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const validString = (v: unknown, max: number, nonempty = false) => typeof v === 'string' && v.length <= max && (!nonempty || v.trim().length > 0);
const unique = (a: string[]) => new Set(a).size === a.length;
const isEmptyValue = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0) || (record(v) && Object.values(v).every(x => x === '' || (Array.isArray(x) && !x.length)));
export function validateContent(content: unknown, publishing = true): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Array.isArray(content) || (publishing && !content.length) || content.length > 100) return { content: '请添加 1–100 个题目或分类' };
  if (publishing && !content.some(q => record(q) && q.type !== 'section')) errors.content = '至少添加一道题目';
  const ids: string[] = [];
  content.forEach((raw, i) => {
    const key = record(raw) && typeof raw.id === 'string' ? raw.id : `item-${i}`;
    if (!record(raw)) { errors[key] = '题目格式无效'; return; }
    const q = raw;
    if (!validString(q.id, 100, true) || !validString(q.title, 300, publishing) || typeof q.type !== 'string' || !Object.hasOwn(questionTypes, q.type) || !validString(q.description, 2000) || typeof q.required !== 'boolean' || typeof q.other !== 'boolean' || !validString(q.placeholder, 300) || !Number.isInteger(q.maxLength) || Number(q.maxLength) < 1 || Number(q.maxLength) > 5000) { errors[key] = '请填写有效的题目标题与配置'; return; }
    ids.push(q.id as string);
    for (const field of ['options', 'rows'] as const) {
      const items = q[field];
      if (!Array.isArray(items) || items.length > (field === 'rows' ? 20 : q.type.startsWith('matrix') ? 10 : 50) || items.some(o => !record(o) || !validString(o.id, 100, true) || o.id === '__other' || !validString(o.label, 300, publishing)) || !unique(items.map(o => o.id))) errors[key] = '选项或矩阵项目无效，名称不能为空、ID 不能重复';
    }
    if (errors[key]) return;
    if (publishing && choiceTypes.includes(q.type as QuestionType) && (!Array.isArray(q.options) || q.options.length < 2)) errors[key] = '至少需要两个选项';
    if (publishing && q.type.startsWith('matrix') && (!Array.isArray(q.rows) || !q.rows.length)) errors[key] = '矩阵至少需要一行';
    for (const field of ['min', 'max']) if (q[field] !== undefined && (typeof q[field] !== 'number' || !Number.isFinite(q[field]))) errors[key] = '范围设置无效';
    if (q.fileMode !== undefined && (q.type !== 'attachment' || !['all','images','documents'].includes(String(q.fileMode)))) errors[key] = '附件类型设置无效';
    if (q.maxFiles !== undefined && (q.type !== 'attachment' || !Number.isInteger(q.maxFiles) || Number(q.maxFiles) < 1 || Number(q.maxFiles) > 5)) errors[key] = '每题附件数量应为 1–5 个';
    if (q.maxFileSizeMB !== undefined && (q.type !== 'attachment' || !Number.isInteger(q.maxFileSizeMB) || Number(q.maxFileSizeMB) < 1 || Number(q.maxFileSizeMB) > 10)) errors[key] = '单个附件大小应为 1–10MB';
    if (q.otherInputMode !== undefined && (!['single','multiline'].includes(String(q.otherInputMode)) || !['single','multiple'].includes(q.type))) errors[key] = '其他填空方式无效';
    if (q.datePrecision !== undefined && (!['date','minute','second'].includes(String(q.datePrecision)) || q.type !== 'date')) errors[key] = '日期精度设置无效';
    if (q.textFormat !== undefined && (!['text','phone','email'].includes(String(q.textFormat)) || q.type !== 'text')) errors[key] = '输入格式设置无效';
    if (q.exclusiveOptionId != null && (q.type !== 'multiple' || !(q.options as Option[]).some(o => o.id === q.exclusiveOptionId))) errors[key] = '互斥选项设置无效';
    if (q.showWhen != null) {
      const condition = q.showWhen;
      const source = record(condition) ? content.slice(0,i).find(source => record(source) && source.id === condition.questionId) : undefined;
      if (q.type === 'section' || !record(condition) || !source || !['single','multiple','select'].includes(source.type) || !Array.isArray(source.options) || !(source.options.some((o: unknown) => record(o) && o.id === condition.optionId) || (condition.optionId === '__other' && source.other && source.type !== 'select'))) errors[key] = '显示条件必须引用前面的选择题及有效选项，请先调整条件';
    }
    if (typeof q.min === 'number' && typeof q.max === 'number' && q.min > q.max) errors[key] = '最小值不能超过最大值';
    if (q.type === 'multiple' && [q.min, q.max].some(v => v !== undefined && (!Number.isInteger(v) || Number(v) < 0 || Number(v) > (q.options as unknown[]).length + (q.other ? 1 : 0)))) errors[key] = '多选数量范围无效';
  });
  if (!unique(ids)) errors.content = '题目 ID 不能重复';
  return errors;
}
export function validateAnswers(content: Question[], input: unknown): Record<string, string> {
  if (!record(input)) return { answers: '答卷格式无效' };
  const errors: Record<string, string> = {};
  const questions = visibleContent(content, input as Answers).filter(q => q.type !== 'section');
  for (const key of Object.keys(input)) if (!content.some(q => q.type !== 'section' && q.id === key)) errors[key] = '存在未知题目';
  for (const q of questions) {
    const raw = input[q.id];
    if (raw !== undefined && (!record(raw) || !('value' in raw) || Object.keys(raw).some(k => !(q.type === 'attachment' ? ['value', 'files'] : ['value', 'other']).includes(k)))) { errors[q.id] = '答案格式无效'; continue; }
    const a = raw as Answer | undefined;
    const v = a?.value;
    if (a?.other !== undefined && !validString(a.other, 5000)) { errors[q.id] = '补充文字格式无效'; continue; }
    const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every(v => typeof v === 'string');
    const validType = v === undefined || v === null || (
      ['single', 'select', 'text', 'textarea', 'date'].includes(q.type) ? typeof v === 'string' :
      ['number', 'rating'].includes(q.type) ? typeof v === 'number' && Number.isFinite(v) :
      ['multiple', 'ranking', 'attachment'].includes(q.type) ? strings(v) :
      q.type.startsWith('matrix') && record(v) && Object.keys(v).every(id => q.rows.some(row => row.id === id)) && Object.values(v).every(cell => q.type === 'matrixSingle' ? typeof cell === 'string' : strings(cell))
    );
    if (!validType) { errors[q.id] = '答案格式无效'; continue; }
    const empty = isEmptyValue(v);
    if (empty) { if (q.required) errors[q.id] = '请回答此题'; continue; }
    let valid = true;
    const allowed = q.options.map(o => o.id);
    if (q.other && ['single', 'multiple'].includes(q.type)) allowed.push('__other');
    const validChoice = (x: unknown) => typeof x === 'string' && allowed.includes(x);
    const validMany = (x: unknown) => Array.isArray(x) && x.every(validChoice) && unique(x);
    switch (q.type) {
      case 'single': case 'select': valid = validChoice(v); break;
      case 'multiple': valid = validMany(v) && (q.exclusiveOptionId && (v as string[]).includes(q.exclusiveOptionId) ? (v as string[]).length === 1 && (v as string[]).length <= (q.max ?? allowed.length) : (v as string[]).length >= (q.min ?? 0) && (v as string[]).length <= (q.max ?? allowed.length)); break;
      case 'text': case 'textarea': valid = typeof v === 'string' && v.length <= q.maxLength; break;
      case 'number': valid = typeof v === 'number' && Number.isFinite(v) && v >= (q.min ?? -Infinity) && v <= (q.max ?? Infinity); break;
      case 'date': valid = typeof v === 'string' && validDateValue(v, q.datePrecision); break;
      case 'rating': valid = typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5; break;
      case 'attachment': valid = strings(v) && unique(v) && v.length <= (q.maxFiles ?? 1) && v.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)); break;
      case 'ranking': valid = validMany(v) && (v as string[]).length === q.options.length; break;
      case 'matrixSingle': case 'matrixMultiple': valid = record(v) && Object.keys(v).every(id => q.rows.some(r => r.id === id)) && q.rows.every(r => q.type === 'matrixSingle' ? validChoice(v[r.id]) : validMany(v[r.id]) && (v[r.id] as string[]).length > 0); break;
    }
    if (q.type === 'text' && typeof v === 'string') {
      if (q.textFormat === 'phone' && !/^1[3-9]\d{9}$/.test(v.trim())) { errors[q.id] = '请输入有效的 11 位手机号码'; continue; }
      if (q.textFormat === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) { errors[q.id] = '请输入有效的邮箱地址'; continue; }
    }
    if (!valid) errors[q.id] = '请检查答案、选项或允许范围';
    if (q.type !== 'attachment' && (v === '__other' || (Array.isArray(v) && v.includes('__other')))) {
      if (!validString(a?.other, 5000, true)) errors[q.id] = '请填写“其他”的具体内容';
    }
    if (a?.other !== undefined && !validString(a.other, 5000)) errors[q.id] = '补充文字格式无效';
  }
  return errors;
}
export function initialAnswers(content: Question[]): Answers {
  return Object.fromEntries(content.filter(q => q.type === 'ranking').map(q => [q.id, { value: q.options.map(o => o.id) }]));
}
export function answerText(q: Question, a?: Answer): string {
  if (!a || a.value === null || a.value === undefined) return '—';
  if (q.type === 'attachment') return a.files?.map(file => file.name).join('、') || (Array.isArray(a.value) && a.value.length ? `${a.value.length} 个附件` : '—');
  const label = (v: string) => v === '__other' ? `其他：${a.other || ''}` : q.options.find(o => o.id === v)?.label || v;
  if (q.type.startsWith('matrix') && record(a.value)) return q.rows.map(r => `${r.label}：${Array.isArray((a.value as Record<string, unknown>)[r.id]) ? ((a.value as Record<string, string[]>)[r.id]).map(label).join('、') : label(String((a.value as Record<string, string>)[r.id] || '—'))}`).join('\n');
  if (Array.isArray(a.value)) return a.value.map(label).join(q.type === 'ranking' ? ' → ' : '、');
  if (['single', 'select'].includes(q.type)) return label(String(a.value));
  return q.type === 'date' ? String(a.value).replace('T', ' ') : String(a.value);
}
export function buildCsv(content: Question[], responses: { createdAt: string | Date; answers: Answers; isValid?: boolean }[]): string {
  const columns = content.filter(q => q.type !== 'section').flatMap<{ q: Question; row: Option | undefined; title: string }>(q => q.type.startsWith('matrix') ? q.rows.map(r => ({ q, row: r, title: `${q.title} / ${r.label}` })) : [{ q, row: undefined, title: q.title }]);
  const cell = (v: unknown) => { let s = String(v ?? ''); if (/^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
  return '\uFEFF' + [['提交时间', '答卷状态', ...columns.map(c => c.title)], ...responses.map(r => [new Date(r.createdAt).toISOString(), r.isValid === false ? '无效' : '有效', ...columns.map(c => {
    const a = r.answers[c.q.id];
    if (c.row) { const v = (a?.value as Record<string, string | string[]> | undefined)?.[c.row.id]; return answerText({ ...c.q, type: Array.isArray(v) ? 'multiple' : 'single' }, { value: v ?? null }); }
    return answerText(c.q, a);
  })])].map(row => row.map(cell).join(',')).join('\r\n');
}
export function summarize(q: Question, answers: Answers[]) {
  const items = answers.map(a => a[q.id]).filter(a => a && !isEmptyValue(a.value));
  const numeric = items.map(a => a.value).filter((v): v is number => typeof v === 'number');
  const options = [...q.options, ...(q.other ? [{ id: '__other', label: '其他' }] : [])].map(o => ({ ...o, count: items.filter(a => Array.isArray(a.value) ? a.value.includes(o.id) : a.value === o.id).length, averageRank: q.type === 'ranking' && items.length ? items.reduce((n, a) => n + (Array.isArray(a.value) ? a.value.indexOf(o.id) + 1 : 0), 0) / items.length : 0 }));
  return { answered: items.length, options, average: numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null, min: numeric.length ? Math.min(...numeric) : null, max: numeric.length ? Math.max(...numeric) : null, distribution: [1, 2, 3, 4, 5].map(value => ({ value, count: numeric.filter(v => v === value).length })), rows: q.rows.map(row => ({ ...row, options: q.options.map(o => ({ ...o, count: items.filter(a => { const v = (a.value as Record<string, string | string[]> | null)?.[row.id]; return Array.isArray(v) ? v.includes(o.id) : v === o.id; }).length })) })), texts: items.map(a => answerText(q, a)), others: items.filter(a => a.other).map(a => a.other!) };
}

export const defaultBranding = { brandName: '轻问.', brandDescription: '提供支持，让每一份回答都有价值' };

export function visibleContent(content: Question[], answers: Answers): Question[] {
  const visible = new Set<string>();
  return content.filter(q => {
    const condition = q.showWhen;
    if (condition) {
      if (!visible.has(condition.questionId)) return false;
      const value = answers[condition.questionId]?.value;
      if (value !== condition.optionId && !(Array.isArray(value) && value.includes(condition.optionId))) return false;
    }
    visible.add(q.id);
    return true;
  });
}
export function visibleAnswers(content: Question[], answers: Answers): Answers {
  const ids = new Set(visibleContent(content, answers).filter(q => q.type !== 'section').map(q => q.id));
  return Object.fromEntries(Object.entries(answers).filter(([id]) => ids.has(id)));
}
