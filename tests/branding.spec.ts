import { test, expect } from '@playwright/test';
import { newQuestion } from '../src/lib/survey';

test('branding switch previews immediately and persists on form, success, and closed pages', async ({ page, browser }) => {
  await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  const survey = await (await page.request.post('/api/surveys', { data: { title: '页脚开关验收' } })).json();
  const guest = await browser.newContext();
  try {
    await page.request.patch(`/api/surveys/${survey.id}`, { data: { content: [newQuestion('single')] } });
    await page.goto(`/surveys/${survey.id}/edit`);
    await expect(page.locator('.editor-device > .survey-brand-footer')).toHaveCount(1);
    await page.getByRole('tab', { name: '外观' }).click();
    const toggle = page.getByRole('switch', { name: '显示底部品牌信息', exact: true });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await expect(page.locator('.editor-device > .survey-brand-footer')).toHaveCount(0);
    await page.getByRole('button', { name: /预览/ }).click();
    const phone = page.frameLocator('iframe[title="手机问卷预览"]');
    await expect(phone.getByRole('heading', { name: '页脚开关验收', exact: true })).toBeVisible();
    await expect(phone.locator('.survey-brand-footer')).toHaveCount(0);
    await page.getByRole('dialog', { name: '问卷预览' }).locator('.ant-modal-close').click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('所有更改已保存', { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: '外观' }).click();
    await expect(toggle).not.toBeChecked();
    await page.getByRole('button', { name: '发布问卷', exact: true }).click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
    await expect(page.getByText('让更多声音被听见', { exact: true })).toBeVisible();
    const form = await guest.newPage();
    await form.goto(`http://localhost:3218/s/${survey.shareId}`);
    await expect(form.getByRole('heading', { name: '页脚开关验收', exact: true })).toBeVisible();
    await expect(form.locator('.survey-brand-footer')).toHaveCount(0);
    await form.getByRole('radio', { name: '选项 1', exact: true }).check();
    await form.getByRole('button', { name: /提交问卷/ }).click();
    await expect(form.getByText('提交成功，感谢你的参与')).toBeVisible();
    await expect(form.locator('.survey-brand-footer')).toHaveCount(0);
    await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'close' } });
    await form.reload();
    await expect(form.getByText('问卷已结束', { exact: true })).toBeVisible();
    await expect(form.locator('.survey-brand-footer')).toHaveCount(0);
    await page.goto(`/surveys/${survey.id}/edit`);
    await page.getByRole('tab', { name: '外观' }).click();
    await toggle.check();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('所有更改已保存', { exact: true })).toBeVisible();
    await form.reload();
    await expect(form.locator('.survey-brand-footer')).toHaveCount(1);
  } finally {
    await guest.close();
    await page.request.delete(`/api/surveys/${survey.id}`);
  }
});


test('custom brand copy survives saving and appears in previews, submissions and closed pages', async ({ page, browser }) => {
  await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  const survey = await (await page.request.post('/api/surveys', { data: { title: '品牌文案验收' } })).json();
  const guest = await browser.newContext();
  const brand = '知行研究', description = '你的反馈，让产品更好';
  try {
    await page.request.patch(`/api/surveys/${survey.id}`, { data: { content: [newQuestion('single')] } });
    await page.goto(`/surveys/${survey.id}/edit`);
    await page.getByRole('tab', { name: '外观' }).click();
    const nameInput = page.getByRole('textbox', { name: '底部品牌名称', exact: true });
    const descriptionInput = page.getByRole('textbox', { name: '底部说明文字', exact: true });
    await expect(nameInput).toHaveValue('轻问.');
    await nameInput.fill(brand); await descriptionInput.fill(description);
    await expect(page.locator('.editor-device > .survey-brand-footer')).toContainText(brand);
    await expect(page.locator('.editor-device > .survey-brand-footer')).toContainText(description);
    const toggle = page.getByRole('switch', { name: '显示底部品牌信息', exact: true });
    await toggle.uncheck(); await expect(nameInput).toHaveCount(0);
    await toggle.check(); await expect(nameInput).toHaveValue(brand);
    await page.getByRole('button', { name: /预览/ }).click();
    const phone = page.frameLocator('iframe[title="手机问卷预览"]');
    await expect(phone.locator('.survey-brand-footer')).toContainText(brand);
    await expect(phone.locator('.survey-brand-footer')).toContainText(description);
    await page.getByRole('dialog', { name: '问卷预览' }).locator('.ant-modal-close').click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('所有更改已保存', { exact: true })).toBeVisible();
    await page.reload(); await page.getByRole('tab', { name: '外观' }).click();
    await expect(nameInput).toHaveValue(brand); await expect(descriptionInput).toHaveValue(description);
    await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'publish' } });
    const form = await guest.newPage();
    await form.goto(`http://localhost:3218/s/${survey.shareId}`);
    await expect(form.locator('.survey-brand-footer')).toContainText(brand);
    await expect(form.locator('.survey-brand-footer')).toContainText(description);
    await form.getByRole('radio', { name: '选项 1', exact: true }).check();
    await form.getByRole('button', { name: /提交问卷/ }).click();
    await expect(form.getByText('提交成功，感谢你的参与')).toBeVisible();
    await expect(form.locator('.survey-brand-footer')).toContainText(description);
    await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'close' } });
    await form.reload();
    await expect(form.getByText('问卷已结束', { exact: true })).toBeVisible();
    await expect(form.locator('.survey-brand-footer')).toContainText(brand);
    await expect(form.locator('.survey-brand-footer')).toContainText(description);
    await page.request.patch(`/api/surveys/${survey.id}`, { data: { brandName: '长'.repeat(40), brandDescription: '说明'.repeat(60) } });
    await form.setViewportSize({ width: 320, height: 700 }); await form.reload();
    await expect(form.locator('.survey-brand-footer')).toContainText('长'.repeat(40));
    expect(await form.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await form.screenshot({ path: 'artifacts/branding/custom-long-mobile.png' });
  } finally {
    await guest.close(); await page.request.delete(`/api/surveys/${survey.id}`);
  }
});
