// 寫信頁上方有「回首頁」；活動管理者另外有「活動後台」，點了直接打開那個活動的後台
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/write-nav.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';
let pass = 0, fail = 0;
const ok = (c, name, info = '') => { if (c) { pass++; console.log('✓ ' + name); } else { fail++; console.log('✗ ' + name + (info ? '：' + info : '')); } };
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());

await pg.goto(BASE + '?demo=write&new&noguide'); await pg.waitForTimeout(900);
ok(await pg.locator('#w-home').isVisible(), '寫信頁有「回首頁」');
const canManage = await pg.evaluate(() => CAN_MANAGE);
ok(canManage && await pg.locator('#w-manage').isVisible(), '活動管理者看得到「活動後台」');
const nav = await pg.locator('.w-nav').boundingBox(), h2 = await pg.locator('h2').first().boundingBox();
ok(nav && h2 && nav.y < h2.y, '導覽在標題上方');

await pg.click('#w-manage'); await pg.waitForTimeout(1500);
ok(await pg.locator('#d-back').count() === 1 && (await pg.innerText('h2')).includes('冬天的第一個問候'), '點「活動後台」直接打開這個活動的後台', await pg.innerText('h2'));
ok(!pg.url().includes('manage='), '網址整理回首頁，重新整理不會一直跳後台');
await pg.click('#d-back'); await pg.waitForTimeout(500);
ok(await pg.locator('#h-new').count() === 1, '後台按返回回到首頁');

// 未送出的信（接續編輯）畫面也有導覽
await pg.goto(BASE + '?demo=write&noguide'); await pg.waitForTimeout(900);
ok(await pg.locator('#w-home').count() === 1, '接續編輯的畫面也有「回首頁」');
await pg.click('#w-home'); await pg.waitForTimeout(900);
ok(await pg.locator('#h-new').count() === 1, '點「回首頁」回到首頁');

// 不是管理者：只有回首頁
await pg.goto(BASE + '?demo=write&new&noguide'); await pg.waitForTimeout(900);
await pg.evaluate(() => { CAN_MANAGE = false; writeForm(); });
ok(await pg.locator('#w-manage').count() === 0 && await pg.locator('#w-home').count() === 1, '一般寫信的人只看到「回首頁」');

const gs = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
ok(/canManage: a \? canManage\(user, a\.id\) : false/.test(gs) && /function canManage/.test(gs), '後端寫信資料附上能不能管理');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
