import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { officeDocumentMime } from '../src/lib/office-document';
const fixture = (name: string) => readFileSync(new URL('./fixtures/' + name, import.meta.url));
it('accepts ordinary OOXML documents without allowing renamed or macro archives', async () => {
  expect(await officeDocumentMime(fixture('attachment.docx'), 'docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  expect(await officeDocumentMime(fixture('attachment.xlsx'), 'xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  expect(await officeDocumentMime(fixture('attachment.pptx'), 'pptx')).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
  expect(await officeDocumentMime(fixture('attachment.docx'), 'xlsx')).toBeNull();
  expect(await officeDocumentMime(fixture('archive-renamed.docx'), 'docx')).toBeNull();
  expect(await officeDocumentMime(fixture('macro.docx'), 'docx')).toBeNull();
  expect(await officeDocumentMime(Buffer.from('PK\u0003\u0004broken'), 'docx')).toBeNull();
});
