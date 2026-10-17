import { test, expect, type Locator, type Page } from '@playwright/test';
import { newQuestion } from '../src/lib/survey';
const stage = process.env.THEME_AUDIT_STAGE || 'after';
async function capture(page: Page, name: string) {
  await expect(page.locator('.ant-spin-blur')).toHaveCount(0);
  await expect.poll(() => page.locator('.ant-spin-container').evaluateAll(nodes => nodes.every(el => getComputedStyle(el).opacity === '1' && getComputedStyle(el,'::after').opacity === '0'))).toBe(true);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)); });
  await page.screenshot({ path: `artifacts/interaction-theme/${stage}/${name}.png`, fullPage: true });
}
async function lightSurface(locator: Locator) {
  await expect.soft.poll(() => locator.evaluate(el => {
    const c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
    const alpha = c[3] ?? 1;
    const channels = c.slice(0,3).map(value => ((value * alpha + 255 * (1-alpha))/255)).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  })).toBeGreaterThan(.82);
}

test('all pages keep light interaction surfaces, readable disabled controls and border-only input focus', async ({ page, browser }) => {
  await page.request.post('/api/auth/login', { data: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD } });
  const prefix = `主题状态验收-${Date.now()}`;
  const survey = await (await page.request.post('/api/surveys', { data: { title: prefix } })).json();
  const draft = await (await page.request.post('/api/surveys', { data: { title: `${prefix}-草稿` } })).json();
  const single = newQuestion('single'), multiple = newQuestion('multiple'), select = newQuestion('select'), text = newQuestion('text'), date = newQuestion('date'), rating = newQuestion('rating');
  single.title = '选择方向'; multiple.title = '选择方面'; select.title = '选择城市'; text.title = '补充意见'; date.title = '选择日期'; rating.title = '满意度';
  const content = [single,multiple,select,text,date,rating].map(q=>({...q,required:false}));
  const guest = await browser.newContext();
  try {
    await page.request.patch(`/api/surveys/${survey.id}`, { data: { content } });
    await page.request.patch(`/api/surveys/${draft.id}`, { data: { content } });
    await page.request.post(`/api/surveys/${survey.id}/action`, { data: { action: 'publish' } });
    await page.request.post(`/api/public/${survey.shareId}`, { data: { submissionKey: crypto.randomUUID(), answers: { [single.id]: { value: single.options[0].id } } } });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const login = await guest.newPage(); await login.goto('http://localhost:3218/login');
    await login.getByRole('button', { name: /登录工作台/ }).hover(); await capture(login,'login-hover');
    await page.goto('/surveys'); await page.getByPlaceholder('搜索问卷名称').fill(prefix);
    const card = page.locator('.survey-card').filter({ hasText: `${prefix}-草稿` }); await expect(card).toBeVisible();
    const disabledShare = card.getByRole('button',{name:'分享问卷',exact:true}); await expect(disabledShare).toBeDisabled();
    const before = await disabledShare.evaluate(el => getComputedStyle(el).color); await disabledShare.hover({force:true});
    expect.soft(await disabledShare.evaluate(el=>getComputedStyle(el).color)).toBe(before);
    await page.locator('.filter-tabs button.active').hover(); await lightSurface(page.locator('.filter-tabs button.active')); await capture(page,'surveys-selected');
    await page.getByRole('button',{name:/新建问卷/}).click(); await capture(page,'create-modal');
    await page.getByRole('dialog').locator('.ant-modal-close').click();
    await page.goto('/users');
    const reset = page.getByRole('button',{name:/重置密码/}).first(); await expect(reset).toBeDisabled(); await reset.hover({force:true});
    const disabledSwitch = page.locator('.users-table .ant-switch-disabled').first();
    const disabledBg = await disabledSwitch.evaluate(el=>getComputedStyle(el).backgroundColor); await disabledSwitch.hover({force:true});
    expect.soft(await disabledSwitch.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(disabledBg);
    expect.soft(await disabledSwitch.locator('.ant-switch-inner-checked').evaluate(el=>getComputedStyle(el).color)).not.toBe('rgb(255, 255, 255)');
    await capture(page,'users-disabled');
    await page.getByRole('button',{name:'用户菜单',exact:true}).click();
    const menu = page.locator('.ant-dropdown-menu-item').first(); await menu.hover(); await lightSurface(menu); await capture(page,'menu-hover');
    await page.keyboard.press('Escape');
    await page.goto('/account'); await page.getByRole('button',{name:'更新密码',exact:true}).hover(); await capture(page,'account-hover');
    await page.goto(`/surveys/${survey.id}/results`); await page.getByRole('tab',{name:/原始答卷/}).click();
    await page.locator('.ant-table-thead input[type=checkbox]').check();
    const selectedRow = page.locator('.ant-table-row-selected').first(); await lightSurface(selectedRow.locator('td').nth(1));
    await selectedRow.hover(); await lightSurface(selectedRow.locator('td').nth(1)); await capture(page,'results-selected');
    await page.getByRole('combobox',{name:'筛选答卷状态',exact:true}).click();
    await lightSurface(page.locator('.ant-select-dropdown:visible .ant-select-item-option-selected')); await capture(page,'select-selected'); await page.keyboard.press('Escape');
    await page.goto(`/surveys/${survey.id}/edit`); await page.locator('.question-type-grid button').first().waitFor();
    const disabledType = page.locator('.question-type-grid button').first(); await expect(disabledType).toBeDisabled();
    const disabledTypeColor = await disabledType.evaluate(el=>getComputedStyle(el).color); await disabledType.hover({force:true});
    expect.soft(await disabledType.evaluate(el=>getComputedStyle(el).color)).toBe(disabledTypeColor);
    expect.soft(await disabledType.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
    await lightSurface(disabledType);
    await lightSurface(page.locator('.canvas-submit button')); await capture(page,'editor-disabled');
    await page.goto(`/surveys/${draft.id}/edit`);
    const type = page.getByRole('button',{name:'单选题',exact:true}); await type.hover(); await lightSurface(type);
    await page.getByRole('tab',{name:/外观/}).click();
    const template = page.getByRole('button',{name:'页面背景：清新薄荷',exact:true}); await template.hover(); await lightSurface(template); await capture(page,'appearance-selected');
    const form = await guest.newPage(); await form.setViewportSize({width:390,height:844}); await form.goto(`http://localhost:3218/s/${survey.shareId}`);
    const radio = form.locator(`#question-${single.id}`).getByRole('radio',{name:'选项 1',exact:true}); await radio.check();
    await form.locator(`#question-${multiple.id}`).getByRole('checkbox',{name:'选项 1',exact:true}).check();
    await lightSurface(form.locator('.choice-options .ant-radio-wrapper-checked'));
    await form.getByRole('textbox',{name:'补充意见',exact:true}).focus();
    expect.soft(await form.getByRole('textbox',{name:'补充意见',exact:true}).evaluate(el=>getComputedStyle(el).boxShadow)).toBe('none');
    await form.getByRole('combobox',{name:'选择城市',exact:true}).click(); await form.locator('.ant-select-dropdown').getByText('选项 1',{exact:true}).click();
    await form.getByRole('combobox',{name:'选择城市',exact:true}).click(); await lightSurface(form.locator('.ant-select-dropdown:visible .ant-select-item-option-selected')); await capture(form,'mobile-options'); await form.keyboard.press('Escape');
    await form.getByRole('textbox',{name:'选择日期',exact:true}).click();
    const today = form.locator('.ant-picker-dropdown:visible .ant-picker-cell-today').first(); await today.hover(); await capture(form,'date-hover'); await form.keyboard.press('Escape');
    await form.locator('.rating-field .ant-rate-star').nth(3).click(); await capture(form,'mobile-filled');
    expect(await form.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally { await guest.close(); await page.request.delete(`/api/surveys/${survey.id}`); await page.request.delete(`/api/surveys/${draft.id}`); }
});
