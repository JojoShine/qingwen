import { describe, expect, it } from 'vitest';
import { newQuestion, validateAnswers, validateContent, buildCsv, summarize } from './survey';

describe('survey validation', () => {
  it('requires a meaningful question before publishing', () => { expect(Object.keys(validateContent([])).length).toBeGreaterThan(0); });
  it('rejects missing required answers', () => {
    const q = newQuestion('text'); q.required = true;
    expect(validateAnswers([q], {})[q.id]).toBeTruthy();
  });
  it('requires text only when other is selected', () => {
    const q = newQuestion('single'); q.other = true;
    expect(validateAnswers([q], { [q.id]: { value: '__other', other: '' } })[q.id]).toBeTruthy();
    expect(validateAnswers([q], { [q.id]: { value: '__other', other: '补充' } })).toEqual({});
    expect(validateAnswers([q], { [q.id]: { value: 'forged' } })[q.id]).toBeTruthy();
  });
  it('enforces choice limits and unique answers', () => {
    const q = newQuestion('multiple'); q.min = 2;
    expect(validateAnswers([q], { [q.id]: { value: [q.options[0].id] } })[q.id]).toBeTruthy();
    expect(validateAnswers([q], { [q.id]: { value: [q.options[0].id, q.options[0].id] } })[q.id]).toBeTruthy();
  });
  it('requires all matrix rows once an optional matrix is started', () => {
    const q = newQuestion('matrixSingle'); q.required = false;
    expect(validateAnswers([q], {})).toEqual({});
    expect(validateAnswers([q], { [q.id]: { value: { [q.rows[0].id]: q.options[0].id } } })[q.id]).toBeTruthy();
  });
  it('rejects incomplete or duplicate ranking options', () => {
    const q = newQuestion('ranking');
    expect(validateAnswers([q], { [q.id]: { value: [q.options[0].id, q.options[0].id] } })[q.id]).toBeTruthy();
    expect(validateAnswers([q], { [q.id]: { value: q.options.map(o => o.id) } })).toEqual({});
  });
  it('rejects out-of-range numbers and impossible dates', () => {
    const q = newQuestion('number'); q.min = 3;
    expect(validateAnswers([q], { [q.id]: { value: 2 } })[q.id]).toBeTruthy();
    const date = newQuestion('date');
    expect(validateAnswers([date], { [date.id]: { value: '2026-02-31' } })[date.id]).toBeTruthy();
  });
  it('rejects unknown fields, non-object answers, and invalid configuration', () => {
    const q = newQuestion('single');
    expect(Object.keys(validateAnswers([q], { fake: { value: 'x' } })).length).toBeGreaterThan(0);
    expect(Object.keys(validateAnswers([q], null)).length).toBeGreaterThan(0);
    q.options[1].id = q.options[0].id;
    expect(Object.keys(validateContent([q])).length).toBeGreaterThan(0);
  });
});

describe('results and CSV', () => {
  it('escapes CSV quotes/newlines and prevents spreadsheet formulas', () => {
    const q = newQuestion('text'); q.title = '留言';
    const csv = buildCsv([q], [{ createdAt: '2026-10-16T00:00:00Z', answers: { [q.id]: { value: '=1+1,"换行\n中文"' } } }]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=1+1"); expect(csv).toContain('""换行');
  });
  it('counts multiple choice percentage per answered response', () => {
    const q = newQuestion('multiple');
    const s = summarize(q, [{ [q.id]: { value: q.options.map(o => o.id) } }]);
    expect(s.answered).toBe(1); expect(s.options[0].count).toBe(1); expect(s.options[1].count).toBe(1);
  });
});
