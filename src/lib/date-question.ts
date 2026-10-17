export type DatePrecision = 'date' | 'minute' | 'second';

export function validDateValue(value: string, precision: DatePrecision = 'date'): boolean {
  const pattern = precision === 'date' ? /^\d{4}-\d{2}-\d{2}$/ : precision === 'minute' ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
  if (!pattern.test(value) || value.startsWith('0000-')) return false;
  const date = value.slice(0, 10), parsed = Date.parse(date);
  if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) return false;
  return precision === 'date' || (Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && (precision !== 'second' || Number(value.slice(17, 19)) < 60));
}
