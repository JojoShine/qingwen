import { test, expect, type Page } from '@playwright/test';
import { newQuestion } from '../src/lib/survey';

async function choose(page: Page, unit: string, target: number) {
  const wheel = page.getByRole('spinbutton', { name: unit, exact: true });
  let current = Number(await wheel.getAttribute('aria-valuenow'));
  while (current !== target) {
    const distance = target - current;
    await wheel.press(Math.abs(distance) >= 10 ? distance > 0 ? 'PageDown' : 'PageUp' : distance > 0 ? 'ArrowDown' : 'ArrowUp');
    current = Number(await wheel.getAttribute('aria-valuenow'));
  }
}

test('themed date wheels cancel, clamp calendar days, persist precision and retain submitted times', async ({ page, browser }) => {
  expect((await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } })).ok()).toBe(true);
  const survey = await (await page.request.post('/api/surveys', { data: { title: '日期时间精度验收' } })).json();
  const date = newQuestion('date'); date.title = '日期';
  const minute = { ...newQuestion('date'), title: '预约时间', datePrecision: 'minute' as const };
  const second = { ...newQuestion('date'), title: '事件时间', datePrecision: 'second' as const };
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    expect((await page.request.patch(`/api/surveys/${survey.id}`, { data: { content: [date, minute, second] } })).ok()).toBe(true);
    await page.goto(`/surveys/${survey.id}/edit`);
    await page.locator(`[data-question-id="${minute.id}"]`).click();
    await expect(page.getByRole('radio', { name: '日期＋时分', exact: true })).toBeChecked();
    await page.getByRole('radio', { name: '日期＋时分秒', exact: true }).check();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('所有更改已保存', { exact: true })).toBeVisible();
    await page.reload();
    await page.locator(`[data-question-id="${minute.id}"]`).click();
    await expect(page.getByRole('radio', { name: '日期＋时分秒', exact: true })).toBeChecked();
    // Restore minute precision before publication; the second question remains second precision.
    await page.getByRole('radio', { name: '日期＋时分', exact: true }).check();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('所有更改已保存', { exact: true })).toBeVisible();
    expect((await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'publish' } })).ok()).toBe(true);
    const form = await guest.newPage();
    await form.goto(`/s/${survey.shareId}`);
    await form.getByRole('textbox', { name: '日期', exact: true }).fill('2024-02-29');
    await form.getByRole('textbox', { name: '日期', exact: true }).click();
    await expect(form.getByRole('spinbutton')).toHaveCount(3);
    await choose(form, '年', 2025);
    await expect(form.getByRole('spinbutton', { name: '日', exact: true })).toHaveAttribute('aria-valuenow', '28');
    await form.getByRole('button', { name: '取消', exact: true }).click();
    await expect(form.getByRole('textbox', { name: '日期', exact: true })).toHaveValue('2024-02-29');
    await form.getByRole('textbox', { name: '日期', exact: true }).click();
    await form.getByRole('button', { name: '清空', exact: true }).click();
    await expect(form.getByRole('textbox', { name: '日期', exact: true })).toHaveValue('');
    for (const [title, value, expectedCount] of [['日期', '2026-10-17', 3], ['预约时间', '2026-10-17 09:15', 5], ['事件时间', '2026-10-17 19:42:35', 6]] as const) {
      const field = form.getByRole('textbox', { name: title, exact: true });
      await field.fill(value);
      await field.click();
      await expect(form.getByRole('spinbutton')).toHaveCount(expectedCount);
      if (title === '事件时间') {
        await choose(form, '秒', 36);
        const selected = form.locator('.date-wheel-item.is-selected').first();
        expect(await selected.evaluate(el => getComputedStyle(el).color)).toBe('rgb(22, 136, 120)');
        expect(await form.getByRole('button', { name: '确定', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(22, 136, 120)');
        await form.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)); });
        const modal = await form.locator('.question-date-modal').boundingBox();
        expect(modal!.x).toBeGreaterThanOrEqual(0); expect(modal!.width).toBeLessThanOrEqual(390);
        expect(modal!.y).toBeGreaterThanOrEqual(0); expect(modal!.y + modal!.height).toBeLessThanOrEqual(845);
        await form.screenshot({ path: 'artifacts/date-question/mobile-seconds.png' });
      }
      await form.getByRole('button', { name: '确定', exact: true }).click();
    }
    await expect(form.getByRole('textbox', { name: '事件时间', exact: true })).toHaveValue('2026-10-17 19:42:36');
    await form.getByRole('button', { name: '提交问卷' }).click();
    await expect(form.getByRole('heading', { name: '提交成功，感谢你的参与' })).toBeVisible();
    const results = await (await page.request.get(`/api/surveys/${survey.id}/results`)).json();
    expect(results.items[0].answers[minute.id].value).toBe('2026-10-17T09:15');
    expect(results.items[0].answers[second.id].value).toBe('2026-10-17T19:42:36');
    await page.goto(`/surveys/${survey.id}/results`);
    await expect(page.getByText('2026-10-17 19:42:36', { exact: true })).toBeVisible();
    const csv = await (await page.request.get(`/api/surveys/${survey.id}/export`)).text();
    expect(csv).toContain('2026-10-17 09:15'); expect(csv).toContain('2026-10-17 19:42:36');
  } finally { await guest.close(); await page.request.delete(`/api/surveys/${survey.id}`); }
});
