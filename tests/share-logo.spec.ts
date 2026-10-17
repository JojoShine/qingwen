import { test, expect } from '@playwright/test';
import { newQuestion } from '../src/lib/survey';

test('black and white share QR supports saved logos and includes them in downloaded PNGs', async ({ page }) => {
  expect((await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } })).ok()).toBe(true);
  const survey = await (await page.request.post('/api/surveys', { data: { title: '分享二维码 Logo 验收' } })).json();
  try {
    await page.request.patch(`/api/surveys/${survey.id}`, { data: { content: [newQuestion('single')] } });
    await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'publish' } });
    await page.goto(`/surveys/${survey.id}/edit`);
    await page.getByRole('button', { name: /分享问卷$/ }).click();
    const canvas = page.locator('.qr-box canvas');
    await expect(canvas).toBeVisible();
    const monochrome = () => canvas.evaluate(el => {
      const canvas = el as HTMLCanvasElement;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let black = 0, white = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] !== 255 || pixels[i] !== pixels[i + 1] || pixels[i] !== pixels[i + 2]) return false;
        if (pixels[i] === 0) black++;
        if (pixels[i] === 255) white++;
      }
      return black > 0 && white > 0;
    });
    await expect.poll(monochrome).toBe(true);
    const logo = await page.evaluate(() => {
      const image = document.createElement('canvas'); image.width = 320; image.height = 160;
      const context = image.getContext('2d')!; context.fillStyle = '#e02424'; context.fillRect(0, 0, 320, 160);
      return image.toDataURL('image/png').split(',')[1];
    });
    const upload = page.getByLabel('上传二维码 Logo', { exact: true });
    await upload.setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    await expect(page.getByText('请选择 PNG、JPG 或 WebP 图片', { exact: true })).toBeVisible();
    await upload.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(logo, 'base64') });
    await expect(page.getByText('Logo 已保存', { exact: true })).toBeVisible();
    await expect.poll(() => canvas.evaluate(el => {
      const canvas = el as HTMLCanvasElement;
      return Array.from(canvas.getContext('2d')!.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data);
    })).toEqual([224, 36, 36, 255]);
    const saved = await (await page.request.get(`/api/surveys/${survey.id}/share`)).json();
    expect(saved.qrLogoImage).toMatch(/^data:image\/png;base64,/);
    const link = await page.getByTestId('share-url').inputValue();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: /下载二维码$/ }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('问卷二维码.png');
    const stream = (await download.createReadStream())!;
    const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const png = Buffer.concat(chunks);
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
    const dataUrl = 'data:image/png;base64,' + png.toString('base64');
    const exported = await page.evaluate(async data => {
      const image = new Image(); image.src = data; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
      return { center: Array.from(context.getImageData(image.width / 2, image.height / 2, 1, 1).data), corner: Array.from(context.getImageData(0, 0, 1, 1).data) };
    }, dataUrl);
    expect(exported).toEqual({ center: [224,36,36,255], corner: [255,255,255,255] });
    await download.saveAs('artifacts/share-logo/with-logo.png');
    await page.getByRole('dialog', { name: '分享问卷' }).screenshot({ path: 'artifacts/share-logo/dialog.png' });
    await page.getByRole('dialog', { name: '分享问卷' }).locator('.ant-modal-close').click();
    await page.getByRole('button', { name: /分享问卷$/ }).click();
    await expect(page.getByRole('button', { name: /更换中心 Logo$/ })).toBeVisible();
    await expect(page.getByTestId('share-url')).toHaveValue(link);
    await page.getByRole('button', { name: /移除 Logo$/ }).click();
    await expect(page.getByText('Logo 已移除', { exact: true })).toBeVisible();
    await expect.poll(monochrome).toBe(true);
    expect((await (await page.request.get(`/api/surveys/${survey.id}/share`)).json()).qrLogoImage).toBeNull();
    const plainDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: /下载二维码$/ }).click();
    await (await plainDownload).saveAs('artifacts/share-logo/plain.png');
    await page.reload();
    await page.getByRole('button', { name: /分享问卷$/ }).click();
    await expect(page.getByRole('button', { name: /上传中心 Logo$/ })).toBeVisible();
  } finally { await page.request.delete(`/api/surveys/${survey.id}`); }
});
