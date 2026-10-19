import { fromBuffer, type Entry } from 'yauzl';
const formats: Record<string, { path: string; contentType: string; mime: string }> = {
  docx: { path: 'word/document.xml', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { path: 'xl/workbook.xml', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  pptx: { path: 'ppt/presentation.xml', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
};
// Read the directory and bounded content-type manifest, never extract user files.
export function officeDocumentMime(data: Buffer, extension: string): Promise<string | null> {
  const format = formats[extension];
  if (!format) return Promise.resolve(null);
  return new Promise(resolve => {
    fromBuffer(data, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return resolve(null);
      const names = new Set<string>(); const root = format.path.split('/')[0] + '/'; let count = 0, expanded = 0, manifest = '';
      let finished = false;
      const finish = (mime: string | null) => { if (finished) return; finished = true; clearTimeout(timer); zip.close(); resolve(mime); };
      const timer = setTimeout(() => finish(null), 2_000);
      zip.on('error', () => finish(null));
      zip.on('end', () => finish(names.has(format.path) && names.has('_rels/.rels') && manifest.includes(format.contentType) && manifest.includes('/' + format.path) ? format.mime : null));
      zip.on('entry', (entry: Entry) => {
        if (finished) return;
        const name = entry.fileName;
        count++; expanded += entry.uncompressedSize;
        const type = (entry.externalFileAttributes >>> 16) & 0xf000;
        if (!(name === '[Content_Types].xml' || name.startsWith('_rels/') || name.startsWith('docProps/') || name.startsWith(root)) || count > 1000 || expanded > 32 * 1024 * 1024 || entry.isEncrypted() || names.has(name) || type === 0xa000 || /(^|\/)\.\.(\/|$)|\\|^\//.test(name) || /vba|macros?|activex|embeddings\//i.test(name) || /\.(exe|dll|js|html?|zip|rar|7z)$/i.test(name)) return finish(null);
        names.add(name);
        if (name !== '[Content_Types].xml') { zip.readEntry(); return; }
        if (entry.uncompressedSize > 64 * 1024) return finish(null);
        zip.openReadStream(entry, (error, stream) => {
          if (finished) { stream?.destroy(); return; }
          if (error || !stream) return finish(null);
          const chunks: Buffer[] = []; let size = 0;
          stream.on('error', () => finish(null));
          stream.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 64 * 1024) { stream.destroy(); finish(null); } else chunks.push(chunk); });
          stream.on('end', () => {
            manifest = Buffer.concat(chunks).toString('utf8');
            if (/<!DOCTYPE|<!ENTITY|macroEnabled|vbaProject|activeX/i.test(manifest)) return finish(null);
            if (!finished) zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}
