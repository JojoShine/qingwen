import { test, expect } from '@playwright/test';
import { newQuestion } from '../src/lib/survey';

test('share dialog resolves the browser origin and honors the optional configured origin', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  expect(login.status()).toBe(200);
  const survey = await (await page.request.post('/api/surveys', { data: { title: '访问地址验收' } })).json();
  try {
    expect((await page.request.patch(`/api/surveys/${survey.id}`, { data: { content: [newQuestion('single')] } })).status()).toBe(200);
    expect((await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'publish' } })).status()).toBe(200);
    await page.goto(`/surveys/${survey.id}/edit`);
    await page.getByRole('button', { name: /分享问卷/ }).click();
    const origin = process.env.APP_URL || new URL(page.url()).origin;
    await expect(page.getByTestId('share-url')).toHaveValue(new URL(`/s/${survey.shareId}`, origin).toString());
    await expect(page.locator('.qr-box canvas')).toBeVisible();
    if (!process.env.APP_URL) {
      const api = await page.request.get(`/api/surveys/${survey.id}/share`);
      expect(await api.json()).toEqual({ url: `/s/${survey.shareId}`, qrLogoImage: null });
    }
  } finally { await page.request.delete(`/api/surveys/${survey.id}`); }
});
