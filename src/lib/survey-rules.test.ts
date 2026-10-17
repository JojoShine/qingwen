import { describe, expect, it } from 'vitest';
import { newQuestion, validateAnswers, validateContent, visibleContent, visibleAnswers } from './survey';

describe('basic question rules', () => {
  it('defaults other answers to multiline and validates the input mode', () => {
    const q = newQuestion('multiple'); q.other = true;
    expect(q.otherInputMode).toBe('multiline');
    expect(validateContent([{ ...q, otherInputMode: 'single' }])).toEqual({});
    expect(validateContent([{ ...q, otherInputMode: undefined }])).toEqual({});
    expect(Object.keys(validateContent([{ ...q, otherInputMode: 'forged' }]))).not.toHaveLength(0);
    expect(validateAnswers([q], { [q.id]: { value: ['__other'], other: '第一行\n第二行' } })).toEqual({});
  });
  it('validates mainland phone numbers and basic email format, leaving optional blanks allowed', () => {
    const phone = { ...newQuestion('text'), textFormat: 'phone' as const };
    const email = { ...newQuestion('text'), textFormat: 'email' as const };
    expect(validateAnswers([phone], { [phone.id]: { value: '123' } })[phone.id]).toBeTruthy();
    expect(validateAnswers([phone], { [phone.id]: { value: '13800138000' } })).toEqual({});
    expect(validateAnswers([email], { [email.id]: { value: 'bad@' } })[email.id]).toBeTruthy();
    expect(validateAnswers([email], { [email.id]: { value: 'test+survey@example.com' } })).toEqual({});
    expect(validateAnswers([{ ...phone, required: false }], {})).toEqual({});
    expect(Object.keys(validateContent([{ ...phone, textFormat: 'forged' }]))).not.toHaveLength(0);
  });
  it('rejects an exclusive option combined with normal options, even when bypassing the UI', () => {
    const q = newQuestion('multiple'); q.exclusiveOptionId = q.options[1].id;
    expect(validateAnswers([q], { [q.id]: { value: q.options.map(o => o.id) } })[q.id]).toBeTruthy();
    expect(validateAnswers([q], { [q.id]: { value: [q.options[1].id] } })).toEqual({});
    q.min = 2;
    expect(validateAnswers([q], { [q.id]: { value: [q.options[1].id] } })).toEqual({});
    expect(Object.keys(validateContent([{ ...q, exclusiveOptionId: 'missing' }]))).not.toHaveLength(0);
  });
  it('only validates and keeps visible answers, including cascaded conditions', () => {
    const a = newQuestion('single'), b = newQuestion('single'), c = newQuestion('text');
    b.showWhen = { questionId: a.id, optionId: a.options[0].id };
    c.showWhen = { questionId: b.id, optionId: b.options[0].id };
    const answers = { [a.id]: { value: a.options[1].id }, [b.id]: { value: b.options[0].id }, [c.id]: { value: 'stale hidden answer' } };
    expect(validateAnswers([a,b,c], answers)).toEqual({});
    expect(visibleContent([a,b,c], answers).map(q => q.id)).toEqual([a.id]);
    expect(visibleAnswers([a,b,c], answers)).toEqual({ [a.id]: answers[a.id] });
    expect(validateAnswers([a,b,c], { [a.id]: { value: a.options[0].id } })[b.id]).toBeTruthy();
  });
  it('rejects malformed referenced options without crashing', () => {
    const a = newQuestion('single'), b = newQuestion('text');
    b.showWhen = { questionId: a.id, optionId: a.options[0].id };
    expect(() => validateContent([{ ...a, options: [null] },b])).not.toThrow();
  });
  it('supports multiple-choice triggers and rejects forward, missing and section references', () => {
    const a = newQuestion('multiple'), b = newQuestion('text');
    b.showWhen = { questionId: a.id, optionId: a.options[0].id };
    expect(visibleContent([a,b], { [a.id]: { value: [a.options[0].id] } })).toHaveLength(2);
    expect(validateContent([a,b])).toEqual({});
    expect(Object.keys(validateContent([b,a]))).not.toHaveLength(0);
    expect(Object.keys(validateContent([{ ...b, showWhen: { questionId: 'missing', optionId: 'missing' } }]))).not.toHaveLength(0);
    expect(Object.keys(validateContent([a, { ...b, showWhen: 'bad' }]))).not.toHaveLength(0);
  });
});
