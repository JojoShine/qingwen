import { test, expect } from '@playwright/test';
import { newQuestion } from '../src/lib/survey';

test('card actions align right and drafts preview directly without becoming shareable', async ({ page }) => {
  await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  const prefix = `列表预览验收-${Date.now()}`;
  const draft = await (await page.request.post('/api/surveys', { data: { title: `${prefix}-草稿` } })).json();
  let published: { id: string } | null = null;
  try {
    published = await (await page.request.post('/api/surveys', { data: { title: `${prefix}-已发布`, platform: 'desktop' } })).json();
    await page.request.patch(`/api/surveys/${published!.id}`, { data: { content: [newQuestion('single')] } });
    await page.request.post(`/api/surveys/${published!.id}/action`, { data: { action: 'publish' } });
    await page.goto('/surveys');
    await page.getByPlaceholder('搜索问卷名称').fill(prefix);
    const card = page.locator('.survey-card').filter({ hasText: `${prefix}-草稿` });
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: '分享问卷', exact: true })).toBeDisabled();
    await card.getByRole('button', { name: '预览问卷', exact: true }).click();
    const phone = page.frameLocator('iframe[title="手机问卷预览"]');
    await expect(phone.getByRole('heading', { name: `${prefix}-草稿`, exact: true })).toBeVisible();
    await page.getByRole('dialog', { name: '问卷预览' }).locator('.ant-modal-close').click();
    expect((await page.request.get(`/api/public/${draft.shareId}`)).status()).toBe(404);
    expect((await (await page.request.get(`/api/surveys/${draft.id}`)).json()).status).toBe('DRAFT');
    for (const width of [1920, 1440, 1280, 1251, 1100, 1051, 851, 701, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const footer = card.locator('.card-footer');
      await footer.scrollIntoViewIfNeeded();
      const { edit, results, preview, share, edge } = await footer.evaluate(el => {
        const edit = el.querySelector('a[href$="/edit"]')!.getBoundingClientRect().toJSON();
        const results = el.querySelector('a[href$="/results"]')!.getBoundingClientRect().toJSON();
        const preview = el.querySelector('[aria-label="预览问卷"]')!.getBoundingClientRect().toJSON();
        const share = el.querySelector('[aria-label="分享问卷"]')!.getBoundingClientRect().toJSON();
        const r = el.getBoundingClientRect(), style = getComputedStyle(el);
        return { edit, results, preview, share, edge: { left: r.left, right: r.right, paddingLeft: parseFloat(style.paddingLeft), padding: parseFloat(style.paddingRight) } };
      });
      expect(edit!.height).toBeLessThan(28); expect(results!.height).toBeLessThan(28);
      expect(Math.abs(edit!.y + edit!.height / 2 - share!.y - share!.height / 2)).toBeLessThanOrEqual(2);
      const minGap = width < 360 ? 10 : 14;
      expect(results!.x - edit!.x - edit!.width).toBeGreaterThanOrEqual(minGap - 1);
      expect(preview!.x - results!.x - results!.width).toBeGreaterThanOrEqual(minGap - 1);
      expect(share!.x - preview!.x - preview!.width).toBeGreaterThanOrEqual(minGap - 1);
      expect(edit!.x).toBeGreaterThanOrEqual(edge.left + edge.paddingLeft - 1);
      expect(Math.abs(edge.right - edge.padding - share!.x - share!.width)).toBeLessThan(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if ([1440,1051,390].includes(width)) await card.screenshot({ path: `artifacts/list-preview/card-${width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const active = page.locator('.survey-card').filter({ hasText: `${prefix}-已发布` });
    await expect(active.getByRole('button', { name: '分享问卷', exact: true })).toBeEnabled();
    await active.getByRole('button', { name: '预览问卷', exact: true }).click();
    await expect(page.locator('.desktop-preview-content .public-desktop h1')).toHaveText(`${prefix}-已发布`);
    await page.getByRole('dialog', { name: '问卷预览' }).locator('.ant-modal-close').click();
    await page.getByRole('button', { name: '列表视图', exact: true }).click();
    const row = page.getByRole('row').filter({ hasText: `${prefix}-草稿` });
    await row.getByRole('button', { name: '预览问卷', exact: true }).click();
    await expect(phone.getByRole('heading', { name: `${prefix}-草稿`, exact: true })).toBeVisible();
  } finally {
    await page.request.delete(`/api/surveys/${draft.id}`);
    if (published) await page.request.delete(`/api/surveys/${published.id}`);
  }
});
