import { test, expect } from '@playwright/test';
import { newQuestion, type Answers } from '../src/lib/survey';

test('custom browser titles, native dates and contextual answer details work together', async ({ page, browser }) => {
  const login = await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  expect(login.ok()).toBe(true);
  const survey = await (await page.request.post('/api/surveys', { data: { title: '填写与答卷详情验收' } })).json();
  const single = newQuestion('single'); single.title = '选择服务'; single.options = [
    { id: 'consult', label: '咨询服务' }, { id: 'delivery', label: '配送服务' }, { id: 'support', label: '售后服务' },
  ];
  const multiple = newQuestion('multiple'); multiple.title = '改进建议'; multiple.other = true;
  const date = newQuestion('date'); date.title = '服务日期';
  const rating = newQuestion('rating'); rating.title = '服务满意度';
  const matrix = newQuestion('matrixSingle'); matrix.title = '服务环节评价';
  matrix.rows = [{ id: 'speed', label: '响应速度' }, { id: 'attitude', label: '服务态度' }];
  matrix.options = [{ id: 'good', label: '满意' }, { id: 'bad', label: '待改进' }];
  const ranking = newQuestion('ranking'); ranking.title = '服务优先级';
  ranking.options = [{ id: 'quality', label: '品质' }, { id: 'price', label: '价格' }];
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    expect((await page.request.patch(`/api/surveys/${survey.id}`, { data: { content: [single, multiple, date, rating, matrix, ranking] } })).ok()).toBe(true);
    await page.goto(`/surveys/${survey.id}/edit`);
    await page.getByRole('tab', { name: /外观/ }).click();
    await page.getByRole('textbox', { name: '浏览器标题', exact: true }).fill('欢迎评价本次服务');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('所有更改已保存')).toBeVisible();
    expect((await (await page.request.get(`/api/surveys/${survey.id}`)).json()).browserTitle).toBe('欢迎评价本次服务');
    expect((await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'publish' } })).ok()).toBe(true);
    const form = await guest.newPage();
    await form.goto(`http://localhost:3218/s/${survey.shareId}`);
    await expect(form).toHaveTitle('欢迎评价本次服务');
    await form.getByRole('radio', { name: '售后服务', exact: true }).check();
    await form.getByRole('checkbox', { name: '其他', exact: true }).check();
    await form.getByRole('textbox', { name: '其他补充内容' }).fill('增加夜间服务\n保留电话支持');
    const dateInput = form.getByLabel('服务日期', { exact: true });
    await dateInput.fill('2024-02-29');
    await expect(dateInput).toHaveValue('2024-02-29');
    await dateInput.fill('');
    await expect(dateInput).toHaveValue('');
    await dateInput.fill('2026-10-17');
    await form.locator('.rating-field .ant-rate-star').nth(3).click();
    await expect(form.locator('.rating-selection')).toHaveText('比较满意');
    await form.getByRole('radio', { name: '响应速度 - 满意', exact: true }).check();
    await form.getByRole('radio', { name: '服务态度 - 待改进', exact: true }).check();
    for (const element of [dateInput, form.getByRole('textbox', { name: '其他补充内容' }), form.getByRole('radio', { name: '售后服务', exact: true })]) {
      expect(await element.evaluate(el => getComputedStyle(el).getPropertyValue('-webkit-tap-highlight-color'))).toBe('rgba(0, 0, 0, 0)');
    }
    await expect(form.locator('.ant-wave')).toHaveCount(0);
    await expect(form.locator('.ant-picker-dropdown')).toHaveCount(0);
    expect(await form.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await form.getByRole('button', { name: '提交问卷' }).click();
    await expect(form.getByRole('heading', { name: '提交成功，感谢你的参与' })).toBeVisible();
    const results = await (await page.request.get(`/api/surveys/${survey.id}/results`)).json();
    const answers = results.items[0].answers as Answers;
    expect(answers[date.id].value).toBe('2026-10-17');
    expect(answers[rating.id].value).toBe(4);
    await page.goto(`/surveys/${survey.id}/results`);
    await page.getByRole('tab', { name: /原始答卷/ }).click();
    await page.getByRole('button', { name: '查看答卷', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: '答卷详情' });
    const service = drawer.locator('.response-question').filter({ has: page.getByRole('heading', { name: '1. 选择服务', exact: true }) });
    await expect(service.locator('.response-options>li')).toHaveCount(3);
    await expect(service.locator('.is-selected')).toContainText('售后服务');
    await expect(service.locator('.is-selected .response-option-index')).toHaveText('3');
    await expect(drawer.locator('.response-other')).toHaveText('增加夜间服务\n保留电话支持');
    await expect(drawer.getByLabel('4 星，比较满意', { exact: true })).toBeVisible();
    await expect(drawer.locator('.response-rating .ant-rate-star-full')).toHaveCount(4);
    await expect(drawer.locator('.response-matrix tbody tr').nth(1)).toContainText('服务态度');
    await expect(drawer.locator('.response-matrix tbody tr').nth(1).locator('td').nth(1)).toContainText('已选');
    await expect(drawer.locator('.response-ranking li').first()).toContainText('品质');
    await drawer.locator('.response-rating').scrollIntoViewIfNeeded();
    await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)); });
    await page.screenshot({ path: 'artifacts/respondent-experience/response-detail.png' });
    // Clearing a custom title falls back to the survey name, including closed surveys.
    await page.request.patch(`/api/surveys/${survey.id}`, { data: { browserTitle: '' } });
    await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'close' } });
    await form.reload();
    await expect(form).toHaveTitle('填写与答卷详情验收');
    await expect(form.getByText('问卷已结束', { exact: true })).toBeVisible();
  } finally {
    await guest.close();
    await page.request.delete(`/api/surveys/${survey.id}`);
  }
});
