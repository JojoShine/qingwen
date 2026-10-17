// Uploaded banners are raster images only; SVG and external URLs are not accepted.
export function decodeBannerImage(value: string) {
  if (value.length > 700_000) return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 512_000 || bytes.length < 12 || bytes.toString('base64') !== match[2]) return null;
  const mime = match[1];
  const valid = mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
    mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217 :
    bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return valid ? { mime, bytes } : null;
}
