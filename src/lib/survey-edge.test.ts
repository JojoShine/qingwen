import { expect, it } from 'vitest';
import { newQuestion, validateContent, validateAnswers, summarize } from './survey';
it('does not crash on malformed options and rejects inherited question types',()=>{
  const q=newQuestion('multiple');q.min=1;
  expect(()=>validateContent([{...q,options:null}])).not.toThrow();
  expect(Object.keys(validateContent([{...q,type:'toString'}])).length).toBeGreaterThan(0);
});
it('rejects malformed matrix answer arrays',()=>{
  const q=newQuestion('matrixMultiple');
  expect(validateAnswers([q],{[q.id]:{value:{[q.rows[0].id]:['forged']}}})[q.id]).toBeTruthy();
});
it('can save incomplete drafts while requiring complete published content',()=>{
  expect(validateContent([],false)).toEqual({});
  const q={...newQuestion('single'),title:'',options:[]};
  expect(validateContent([q],false)).toEqual({});
  expect(Object.keys(validateContent([q])).length).toBeGreaterThan(0);
});
it('rejects malformed optional answer containers before applying empty rules',()=>{
  const q=newQuestion('single');q.required=false;
  expect(validateAnswers([q],{[q.id]:{value:{},other:{bad:1}}})[q.id]).toBeTruthy();
  expect(validateAnswers([q],{[q.id]:{value:{}}})[q.id]).toBeTruthy();
  const matrix=newQuestion('matrixMultiple');matrix.required=false;
  expect(validateAnswers([matrix],{[matrix.id]:{value:{forged:[]}}})[matrix.id]).toBeTruthy();
});
it('rejects object answers that could break result rendering and export',()=>{
  const q=newQuestion('text');q.required=false;
  expect(validateAnswers([q],{[q.id]:{value:{toString:''}}})[q.id]).toBeTruthy();
});
it('does not count a cleared optional matrix as answered',()=>{
  const q=newQuestion('matrixMultiple');q.required=false;
  expect(validateAnswers([q],{[q.id]:{value:{[q.rows[0].id]:[]}}})).toEqual({});
  expect(summarize(q,[{[q.id]:{value:{[q.rows[0].id]:[]}}}]).answered).toBe(0);
});
