import { describe, expect, it } from 'vitest';
import { validDateValue, type DatePrecision } from '../src/lib/date-question';
import { answerText, buildCsv, newQuestion, validateAnswers, validateContent } from '../src/lib/survey';

describe('question date precision', () => {
  it.each<[DatePrecision, string, string]>([
    ['date', '2024-02-29', '2026-02-29'],
    ['minute', '2024-02-29T23:59', '2024-02-29T24:00'],
    ['second', '2024-02-29T23:59:59', '2024-02-29T23:59:60'],
  ])('validates calendar dates and the exact %s precision', (precision, valid, invalid) => {
    const q = { ...newQuestion('date'), datePrecision: precision };
    expect(validDateValue(valid, precision)).toBe(true);
    expect(validDateValue(invalid, precision)).toBe(false);
    expect(validateAnswers([q], { [q.id]: { value: valid } })).toEqual({});
    expect(validateAnswers([q], { [q.id]: { value: invalid } })[q.id]).toBeTruthy();
    expect(validDateValue('2024-02-29T12:30Z', precision)).toBe(false);
  });
  it('keeps existing questions date-only and rejects invalid settings and precision', () => {
    const q = newQuestion('date');
    expect(validateAnswers([q], { [q.id]: { value: '2026-10-17' } })).toEqual({});
    expect(validateAnswers([q], { [q.id]: { value: '2026-10-17T12:30' } })[q.id]).toBeTruthy();
    expect(validateContent([{ ...q, datePrecision: 'hour' }])[q.id]).toBeTruthy();
    expect(validateContent([{ ...newQuestion('text'), datePrecision: 'minute' }])).not.toEqual({});
  });
  it('preserves local wall-clock time in answer details and CSV without timezone shifts', () => {
    const q = { ...newQuestion('date'), datePrecision: 'second' as const };
    const a = { value: '2026-10-17T00:05:09' };
    expect(answerText(q, a)).toBe('2026-10-17 00:05:09');
    expect(buildCsv([q], [{ createdAt: '2026-10-17T12:00:00Z', answers: { [q.id]: a } }])).toContain('2026-10-17 00:05:09');
  });
});
