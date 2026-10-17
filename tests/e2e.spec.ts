import { test, expect } from '@playwright/test';

test('create, edit, publish, respond, inspect and close a survey', async ({ page, browser }) => {
  await page.goto('/login');
  await page.getByLabel('账号', { exact: true }).fill(process.env.ADMIN_USERNAME || 'admin');
  await page.getByLabel('密码', { exact: true }).fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole('button', { name: '登录工作台' }).click();
  await expect(page).toHaveURL(/surveys$/);
  await page.getByRole('button', { name: '新建问卷' }).first().click();
  await page.getByPlaceholder('例如：产品使用体验调研').fill('自动化验收问卷');
  await page.getByRole('dialog').getByRole('button', { name: /开始创建/ }).click();
  await expect(page).toHaveURL(/\/edit$/);
  const createdId=new URL(page.url()).pathname.split('/')[2];
  await page.getByRole('button', { name: '单选题', exact: true }).click();
  await page.getByLabel('题目标题', { exact: true }).fill('你喜欢这次体验吗？');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('所有更改已保存')).toBeVisible();
  await page.reload();
  await expect(page.getByText('你喜欢这次体验吗？').first()).toBeVisible();
  await page.getByRole('button', { name: '发布问卷', exact: true }).click();
  await page.getByRole('button', { name: '确认发布', exact: true }).click();
  await expect(page.getByText('让更多声音被听见', { exact: true })).toBeVisible();
  const link = await page.getByTestId('share-url').inputValue();
  const qrDownload=page.waitForEvent('download');await page.getByRole('button',{name:/下载二维码/}).click();expect((await qrDownload).suggestedFilename()).toMatch(/\.png$/);
  const guest = await browser.newContext();
  const form = await guest.newPage();
  await form.goto(link);
  await form.getByText('选项 1', { exact: true }).click();
  await form.getByRole('button', { name: '提交问卷' }).click();
  await expect(form.getByText('提交成功，感谢你的参与')).toBeVisible();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('link', { name: '查看结果' }).click();
  await expect(page.getByTestId('response-count')).toHaveText('1');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /导出 CSV/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.goto('/surveys');
  await page.getByPlaceholder('搜索问卷名称').fill('自动化验收问卷');
  await page.getByRole('button', { name: '更多操作' }).first().click();
  await page.getByText('结束收集', { exact: true }).click();
  await form.reload();
  await expect(form.getByText('问卷已结束')).toBeVisible();
  await guest.close();await page.request.delete(`/api/surveys/${createdId}`);
});

test('login and public pages fit mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: '登录工作台' })).toBeVisible();
});

test('all eleven question types accept valid mobile responses', async ({ page, browser }) => {
  const {newQuestion,questionTypes}=await import('../src/lib/survey');
  const types=['single','multiple','select','text','textarea','number','date','rating','ranking','matrixSingle','matrixMultiple'] as const;
  const content=types.map(type=>{const q=newQuestion(type);q.title=questionTypes[type]+'验证';if(type==='single'||type==='multiple')q.other=true;if(type==='multiple')q.min=2;return q;});
  await page.request.post('/api/auth/login',{data:{username:process.env.ADMIN_USERNAME||'admin',password:process.env.ADMIN_PASSWORD}});
  const s=await(await page.request.post('/api/surveys',{data:{title:'全题型验收问卷'}})).json();
  expect((await page.request.patch(`/api/surveys/${s.id}`,{data:{content}})).ok()).toBe(true);
  expect((await page.request.post(`/api/surveys/${s.id}/action`,{data:{action:'publish'}})).ok()).toBe(true);
  const guest=await browser.newContext({viewport:{width:390,height:844}});const form=await guest.newPage();
  await form.goto(`/s/${s.shareId}`);
  await form.getByRole('button',{name:'提交问卷'}).click();
  await expect(form.getByText('请回答此题').first()).toBeVisible();
  for(const q of content){
    const block=form.locator(`[id="question-${q.id}"]`);
    if(q.type==='single'){await block.getByText('其他',{exact:true}).click();await block.getByRole('textbox',{name:'其他补充内容'}).fill('单选补充');}
    if(q.type==='multiple'){await block.getByText('选项 1',{exact:true}).click();await block.getByText('其他',{exact:true}).click();await block.getByRole('textbox',{name:'其他补充内容'}).fill('多选补充');}
    if(q.type==='select'){await block.getByRole('combobox').focus();await form.keyboard.press('ArrowDown');await form.keyboard.press('Enter');}
    if(q.type==='text'||q.type==='textarea')await block.getByRole('textbox').fill('真实的文字回答');
    if(q.type==='number')await block.getByRole('spinbutton').fill('12');
    if(q.type==='date'){await block.getByRole('textbox').fill('2026-10-16');await block.getByRole('textbox').press('Enter');}
    if(q.type==='rating')await block.locator('.ant-rate-star').nth(3).click();
    if(q.type==='ranking')await block.getByRole('button',{name:'上移 选项 2',exact:true}).click();
    if(q.type==='matrixSingle'||q.type==='matrixMultiple')for(const row of q.rows)await block.getByLabel(`${row.label} - ${q.options[0].label}`,{exact:true}).check();
  }
  expect(await form.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await form.getByRole('button',{name:'提交问卷'}).click();
  await expect(form.getByText('提交成功，感谢你的参与')).toBeVisible();
  const result=await(await page.request.get(`/api/surveys/${s.id}/results`)).json();expect(result.total).toBe(1);
  expect(result.items[0].answers[content[0].id].other).toBe('单选补充');
  expect(result.items[0].answers[content[8].id].value).toEqual([...content[8].options].reverse().map(o=>o.id));
  await guest.close();await page.request.delete(`/api/surveys/${s.id}`);
});

test('editor reorders by keyboard, persists templates, and warns before leaving', async ({ page }) => {
  const{newQuestion}=await import('../src/lib/survey');const a=newQuestion('single');a.title='第一题';const b=newQuestion('text');b.title='第二题';
  await page.request.post('/api/auth/login',{data:{username:process.env.ADMIN_USERNAME||'admin',password:process.env.ADMIN_PASSWORD}});
  const s=await(await page.request.post('/api/surveys',{data:{title:'编辑器验收问卷'}})).json();try { await page.request.patch(`/api/surveys/${s.id}`,{data:{content:[a,b]}});
  await page.goto('/surveys');await page.locator(`a[href="/surveys/${s.id}/edit"]`).first().click();
  const handle=page.getByRole('button',{name:'拖动题目 1',exact:true});await handle.focus();await page.keyboard.press('Space');await expect(page.locator('.editor-block').first()).toHaveClass(/dragging/);await page.keyboard.press('ArrowDown');await expect(page.getByRole('status')).toContainText(`droppable area ${b.id}`);await page.keyboard.press('Space');
  await expect(page.locator('.editor-block').first()).toHaveAttribute('data-question-id',b.id);
  await page.getByRole('tab',{name:'外观'}).click();await page.locator('.theme-grid button').filter({hasText:'日落杏色'}).click();
  await page.getByRole('link',{name:/我的问卷/}).click();await expect(page.locator('.ant-modal-confirm')).toBeVisible();
  await page.getByRole('button',{name:'继续编辑',exact:true}).click();
  await page.getByRole('button',{name:'保存',exact:true}).click();await expect(page.getByText('所有更改已保存')).toBeVisible();
  await page.reload();await expect(page.locator('.editor-device')).toHaveClass(/bg-warm/);await expect(page.locator('.editor-block').first()).toHaveAttribute('data-question-id',b.id);
  await page.getByRole('link',{name:/我的问卷/}).click();await page.locator(`a[href="/surveys/${s.id}/edit"]`).first().click();
  await page.getByLabel('问卷标题',{exact:true}).fill('未保存标题');
  await page.evaluate(()=>history.back());await expect(page.locator('.ant-modal-confirm')).toBeVisible();
  await page.getByRole('button',{name:'继续编辑',exact:true}).click();await expect(page).toHaveURL(/\/edit$/);
  await page.getByRole('button',{name:'用户菜单',exact:true}).click();await page.getByRole('menuitem',{name:/退出登录/}).click();
  await expect(page.locator('.ant-modal-confirm')).toBeVisible();await page.getByRole('button',{name:'继续编辑',exact:true}).click();
  await page.getByRole('button',{name:'返回问卷列表',exact:true}).click();await page.getByRole('button',{name:'放弃更改',exact:true}).click();await expect(page).toHaveURL(/\/surveys$/);
  } finally { await page.request.delete(`/api/surveys/${s.id}`); }
});

test('plain HTTP LAN supports anonymous submissions without secure-context APIs', async ({ page, browser })=>{
  test.skip(!process.env.LAN_TEST_URL,'Set LAN_TEST_URL to a reachable plain HTTP LAN address');
  const lan=process.env.LAN_TEST_URL!;const local='http://localhost:3218';
  const {newQuestion}=await import('../src/lib/survey');const q=newQuestion('single');
  const login=await page.request.post(local+'/api/auth/login',{data:{username:process.env.ADMIN_USERNAME||'admin',password:process.env.ADMIN_PASSWORD}});expect(login.ok()).toBe(true);
  const s=await(await page.request.post(local+'/api/surveys',{data:{title:'局域网兼容验收问卷'}})).json();
  expect((await page.request.patch(local+`/api/surveys/${s.id}`,{data:{content:[q]}})).ok()).toBe(true);
  expect((await page.request.post(local+`/api/surveys/${s.id}/action`,{data:{action:'publish'}})).ok()).toBe(true);
  const guest=await browser.newContext({viewport:{width:390,height:844}});const phone=await guest.newPage();
  await phone.goto(lan+`/s/${s.shareId}`);
  expect(await phone.evaluate(()=>window.isSecureContext)).toBe(false);
  expect(await phone.evaluate(()=>typeof crypto.randomUUID)).toBe('undefined');
  await phone.getByText('选项 1',{exact:true}).click();await phone.getByRole('button',{name:'提交问卷'}).click();
  await expect(phone.getByText('提交成功，感谢你的参与')).toBeVisible();await guest.close();await page.request.delete(local+`/api/surveys/${s.id}`);
});
