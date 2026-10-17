import { test, expect } from '@playwright/test';
import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/password';

test('demo account cannot open personal settings or change its password, while ordinary accounts retain access', async ({ page, browser }) => {
  test.skip(!process.env.DEMO_USERNAME || !process.env.DEMO_PASSWORD, 'Requires a configured demo account identity');
  const username = process.env.DEMO_USERNAME!, password = process.env.DEMO_PASSWORD!;
  const passwordHash = await hashPassword(password);
  const user = await db.user.create({ data: { username, name: '体验账号验收', passwordHash } });
  const ordinary = await browser.newContext();
  try {
    expect((await page.request.post('/api/auth/login', { data: { username, password } })).ok()).toBe(true);
    expect((await (await page.request.get('/api/auth/me')).json()).isDemo).toBe(true);
    await page.goto('/surveys');
    await expect(page.locator('.side-nav a[href$="/account"]')).toHaveCount(0);
    await page.getByRole('button', { name: '用户菜单', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: '个人设置' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /退出登录/ })).toBeVisible();
    await page.goto('/account');
    await expect(page).toHaveURL(/\/surveys$/);
    const denied = await page.request.patch('/api/account', { data: { currentPassword: password, password: 'AttemptedChange!123456' } });
    expect(denied.status()).toBe(403);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash).toBe(passwordHash);
    expect((await page.request.get('/api/auth/me')).ok()).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '打开导航', exact: true }).click();
    await expect(page.getByRole('dialog').locator('a[href$="/account"]')).toHaveCount(0);
    expect((await ordinary.request.post('http://localhost:3218/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } })).ok()).toBe(true);
    const account = await ordinary.newPage();
    await account.goto('http://localhost:3218/account');
    await expect(account.getByLabel('当前密码', { exact: true })).toBeVisible();
    await expect(account.locator('.side-nav a[href$="/account"]')).toBeVisible();
    expect((await ordinary.request.patch('http://localhost:3218/api/account', { data: { currentPassword: 'incorrect', password: 'AttemptedChange!123456' } })).status()).toBe(422);
  } finally {
    await ordinary.close();
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
