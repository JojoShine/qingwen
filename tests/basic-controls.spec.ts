import { test, expect } from '@playwright/test';
import { newQuestion } from '../src/lib/survey';

test('basic settings, conditional questions, repeat protection and response management work together', async ({ page, browser }) => {
  await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  const survey = await (await page.request.post('/api/surveys', { data: { title: '基础问卷能力验收' } })).json();
  const satisfaction = newQuestion('single'); satisfaction.title = '是否满意'; satisfaction.options[0].label = '不满意'; satisfaction.options[1].label = '满意';
  const phone = newQuestion('text'); phone.title = '联系手机';
  const email = newQuestion('text'); email.title = '联系邮箱';
  const multiple = newQuestion('multiple'); multiple.title = '关注方面'; multiple.options[0].label = '体验'; multiple.options[1].label = '以上均无';
  const ranking = newQuestion('ranking'); ranking.title = '优先顺序'; ranking.showWhen = { questionId: satisfaction.id, optionId: satisfaction.options[0].id };
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await page.request.patch(`/api/surveys/${survey.id}`, { data: { content: [satisfaction,phone,email,multiple,ranking] } });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/surveys/${survey.id}/edit`);
    await page.locator(`[data-question-id="${phone.id}"]`).click();
    await page.getByRole('combobox', { name: '输入格式', exact: true }).click();
    await page.getByText('手机号码（中国大陆 11 位）', { exact: true }).click();
    await page.getByRole('switch', { name: '按条件显示本题', exact: true }).check();
    await page.locator(`[data-question-id="${email.id}"]`).click();
    await page.getByRole('combobox', { name: '输入格式', exact: true }).click();
    await page.getByText('邮箱地址', { exact: true }).click();
    await page.locator(`[data-question-id="${multiple.id}"]`).click();
    await page.getByRole('combobox', { name: '互斥选项', exact: true }).click();
    await page.locator('.ant-select-dropdown').getByText('以上均无', { exact: true }).click();
    await page.getByRole('tab', { name: '收集设置', exact: true }).click();
    await page.getByRole('switch', { name: '限制收集份数', exact: true }).check();
    await page.getByRole('spinbutton', { name: '最多收集份数', exact: true }).fill('10');
    await page.getByRole('switch', { name: '限制同一浏览器提交次数', exact: true }).check();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('所有更改已保存', { exact: true })).toBeVisible();
    await page.reload(); await page.getByRole('tab', { name: '收集设置', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: '最多收集份数', exact: true })).toHaveValue('10');
    await expect(page.getByRole('switch', { name: '限制同一浏览器提交次数', exact: true })).toBeChecked();
    await page.screenshot({ path: 'artifacts/basic-controls/collection-desktop.png' });
    await page.getByRole('button', { name: /预览/ }).click();
    const preview = page.frameLocator('iframe[title="手机问卷预览"]');
    await expect(preview.getByRole('textbox', { name: '联系手机', exact: true })).toHaveCount(0);
    await preview.getByRole('radio', { name: '不满意', exact: true }).check();
    await expect(preview.getByRole('textbox', { name: '联系手机', exact: true })).toBeVisible();
    await preview.getByRole('textbox', { name: '联系手机', exact: true }).fill('123');
    await preview.getByRole('textbox', { name: '联系邮箱', exact: true }).fill('bad@');
    await preview.getByRole('checkbox', { name: '体验', exact: true }).check();
    await preview.getByRole('checkbox', { name: '以上均无', exact: true }).check();
    await expect(preview.getByRole('checkbox', { name: '体验', exact: true })).not.toBeChecked();
    await preview.getByRole('button', { name: /提交问卷/ }).click();
    await expect(preview.getByText('请输入有效的 11 位手机号码', { exact: true })).toBeVisible();
    await expect(preview.getByText('请输入有效的邮箱地址', { exact: true })).toBeVisible();
    await preview.getByRole('radio', { name: '满意', exact: true }).check();
    await expect(preview.getByRole('textbox', { name: '联系手机', exact: true })).toHaveCount(0);
    await preview.getByRole('textbox', { name: '联系邮箱', exact: true }).fill('hello@example.com');
    await preview.getByRole('button', { name: /提交问卷/ }).click();
    await expect(preview.getByText('预览校验通过，正式发布后即可提交答卷').last()).toBeVisible();
    await preview.getByRole('radio', { name: '不满意', exact: true }).check();
    await preview.getByRole('textbox', { name: '联系手机', exact: true }).fill('13800138000');
    await preview.getByRole('button', { name: /提交问卷/ }).click();
    await expect(preview.getByText('预览校验通过，正式发布后即可提交答卷').last()).toBeVisible();
    await page.getByRole('dialog', { name: '问卷预览' }).locator('.ant-modal-close').click();
    await page.getByRole('button', { name: '发布问卷', exact: true }).click();
    await page.getByRole('button', { name: '确认发布', exact: true }).click();
    await expect(page.getByText('让更多声音被听见', { exact: true })).toBeVisible();
    const form = await guest.newPage();
    await form.goto(`http://localhost:3218/s/${survey.shareId}`);
    await form.getByRole('radio', { name: '满意', exact: true }).check();
    await form.getByRole('textbox', { name: '联系邮箱', exact: true }).fill('hello@example.com');
    await form.getByRole('checkbox', { name: '以上均无', exact: true }).check();
    await form.getByRole('button', { name: /提交问卷/ }).click();
    await expect(form.getByText('提交成功，感谢你的参与')).toBeVisible();
    await form.reload(); await expect(form.getByText('此浏览器已达到提交次数上限', { exact: true })).toBeVisible();
    await form.screenshot({ path: 'artifacts/basic-controls/browser-limit-mobile.png' });
    await page.goto(`/surveys/${survey.id}/results`);
    await expect(page.getByTestId('response-count')).toHaveText('1');
    await page.getByRole('tab', { name: '原始答卷 (1)', exact: true }).click();
    await page.getByRole('row').filter({ hasText: '查看答卷' }).getByRole('button', { name: '标记无效', exact: true }).click();
    await expect(page.getByTestId('response-count')).toHaveText('0');
    await page.getByRole('combobox', { name: '筛选答卷状态', exact: true }).click();
    await page.locator('.ant-select-dropdown').getByText('无效答卷', { exact: true }).click();
    await page.getByRole('button', { name: '筛选', exact: true }).click();
    await expect(page.getByTestId('response-count')).toHaveText('1');
    const row = page.getByRole('row').filter({ hasText: '查看答卷' });
    await row.getByRole('checkbox').check();
    await page.getByRole('button', { name: '批量恢复有效', exact: true }).click();
    await expect(page.getByTestId('response-count')).toHaveText('0');
    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expect(page.getByTestId('response-count')).toHaveText('1');
    const download = page.waitForEvent('download'); await page.getByRole('link', { name: '导出 CSV', exact: true }).click(); await expect((await download).suggestedFilename()).toContain('.csv');
    for (const width of [1920,1280,390]) { await page.setViewportSize({ width, height: 1000 }); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); await page.screenshot({ path: `artifacts/basic-controls/results-${width}.png`, fullPage: true }); }
  } finally {
    await guest.close(); await page.request.delete(`/api/surveys/${survey.id}`);
  }
});


test('an existing IP restriction can be switched off when IP support is unavailable', async ({ page }) => {
  await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  const survey = await (await page.request.post('/api/surveys', { data: { title: 'IP 设置恢复验收' } })).json();
  try {
    await page.route(`**/api/surveys/${survey.id}`, async route => {
      if (route.request().method() !== 'GET') { await route.continue(); return; }
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...await response.json(), canLimitIp: false, ipLimit: 1 } });
    });
    await page.goto(`/surveys/${survey.id}/edit`);
    await page.getByRole('tab', { name: '收集设置', exact: true }).click();
    const toggle = page.getByRole('switch', { name: '限制同一 IP 提交次数', exact: true });
    await expect(toggle).toBeChecked(); await expect(toggle).toBeEnabled();
    await toggle.uncheck(); await expect(toggle).toBeDisabled();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('所有更改已保存', { exact: true })).toBeVisible();
  } finally { await page.request.delete(`/api/surveys/${survey.id}`); }
});
