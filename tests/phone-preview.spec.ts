import { test, expect } from '@playwright/test';
import { newQuestion } from '../src/lib/survey';

test('filling controls keep a thin focus border and space before Other input', async ({ page }) => {
  await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  const survey = await (await page.request.post('/api/surveys', { data: { title: '控件样式验收' } })).json();
  const choice = newQuestion('multiple'); choice.title = '选择关注的方面'; choice.other = true;
  const select = newQuestion('select'); select.title = '选择城市';
  try {
    await page.request.patch(`/api/surveys/${survey.id}`, { data: { content: [select, choice] } });
    await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'publish' } });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/s/${survey.shareId}`);
    await page.getByRole('combobox', { name: '选择城市' }).click();
    const control = page.locator('.public-question .ant-select');
    await expect.poll(() => control.evaluate(el => {
      const s = getComputedStyle(el);
      return s.boxShadow === 'none' || s.boxShadow === 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
    })).toBe(true);
    await page.locator('.public-intro h1').click();
    await expect(page.locator('.ant-select-dropdown')).toBeHidden();
    await page.getByRole('checkbox', { name: '其他', exact: true }).check();
    const group = await page.locator('.choice-options').boundingBox();
    const other = page.getByRole('textbox', { name: '其他补充内容' });
    const input = await other.boundingBox();
    expect(input!.y - group!.y - group!.height).toBeGreaterThanOrEqual(12);
    await other.fill('更多建议');
    await page.screenshot({ path: 'artifacts/phone-preview/other-mobile.png', fullPage: true });
  } finally { await page.request.delete(`/api/surveys/${survey.id}`); }
});

test('mobile preview uses a fitted phone shell and isolated 390px viewport without saving answers', async ({ page }) => {
  await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  const survey = await (await page.request.post('/api/surveys', { data: { title: '手机外壳验收' } })).json();
  const choice = newQuestion('multiple'); choice.title = '请选择你希望了解的内容，我们会根据你的反馈持续完善产品体验'; choice.other = true;
  const select = newQuestion('select'); select.title = '选择城市';
  try {
    await page.request.patch(`/api/surveys/${survey.id}`, { data: { content: [select, choice] } });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/surveys/${survey.id}/edit`);
    await page.getByRole('textbox', { name: '问卷标题', exact: true }).fill('未保存的手机预览');
    await page.getByRole('button', { name: /预览/ }).click();
    const frame = page.frameLocator('iframe[title="手机问卷预览"]');
    await expect(frame.getByRole('heading', { name: '未保存的手机预览', exact: true })).toBeVisible();
    expect(await frame.locator('body').evaluate(() => innerWidth)).toBe(390);
    expect(await frame.locator('.public-sheet').evaluate(el => getComputedStyle(el).borderRadius)).toBe('0px');
    expect(await frame.locator('.public-survey').evaluate(el => getComputedStyle(el).paddingLeft)).toBe('0px');
    expect(await frame.locator('.public-survey').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    expect(await frame.locator('html').evaluate(el => getComputedStyle(el).scrollbarWidth)).toBe('none');
    expect(await frame.locator('.public-sheet').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
    await expect(page.locator('.phone-device')).toBeVisible();
    for (const title of await frame.locator('.public-question-title').all()) {
      const alignment = await title.evaluate(el => {
        const number = el.querySelector('.question-number')!.getBoundingClientRect();
        const heading = el.querySelector('h2')!;
        const firstLineCenter = heading.getBoundingClientRect().top + parseFloat(getComputedStyle(heading).lineHeight) / 2;
        return { centerOffset: Math.abs(number.top + number.height / 2 - firstLineCenter), heightOffset: Math.abs(number.height - parseFloat(getComputedStyle(heading).lineHeight)) };
      });
      expect(alignment.centerOffset).toBeLessThanOrEqual(1);
      expect(alignment.heightOffset).toBeLessThanOrEqual(1);
    }
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(async () => {
        const r = await page.locator('.phone-device').boundingBox();
        return !!r && r.x >= 0 && r.y >= 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height;
      }).toBe(true);
      expect(await frame.locator('body').evaluate(() => innerWidth)).toBe(390);
      await page.screenshot({ path: `artifacts/phone-preview/preview-${viewport.width}.png` });
    }
    const field = await frame.locator('.public-question .ant-select').boundingBox();
    const nextTitle = await frame.locator('.public-question-title').nth(1).boundingBox();
    expect(nextTitle!.y - field!.y - field!.height).toBeLessThanOrEqual(32);
    await frame.getByRole('combobox', { name: '选择城市' }).click();
    await expect(frame.locator('.ant-select-dropdown .ant-select-item-option-content').filter({ hasText: /^选项 1$/ })).toBeVisible();
    await frame.locator('.ant-select-dropdown .ant-select-item-option-content').filter({ hasText: /^选项 1$/ }).click();
    await frame.getByRole('checkbox', { name: '其他', exact: true }).check();
    await frame.getByRole('textbox', { name: '其他补充内容' }).fill('预览中的建议');
    await frame.getByRole('button', { name: '提交问卷' }).click();
    await expect(frame.getByText('预览校验通过，正式发布后即可提交答卷')).toBeVisible();
    const saved = await (await page.request.get(`/api/surveys/${survey.id}`)).json();
    expect(saved.title).toBe('手机外壳验收'); expect(saved._count.responses).toBe(0);
    await page.getByRole('dialog', { name: '问卷预览' }).locator('.ant-modal-close').click();
    await page.getByRole('tab', { name: '外观' }).click();
    await expect(page.getByLabel('上传 Banner 图片', { exact: true })).toBeHidden();
    await page.getByText('PC 端', { exact: true }).first().click();
    await page.getByRole('button', { name: /预览/ }).click();
    await expect(page.locator('.desktop-preview-content .public-desktop')).toBeVisible();
    await expect(page.locator('iframe[title="手机问卷预览"]')).toHaveCount(0);
  } finally { await page.request.delete(`/api/surveys/${survey.id}`); }
});
