// 登出：清掉這台裝置上的通行證、快取、草稿，顯示「已經登出」，不自動再登入
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/logout.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';

let pass = 0, fail = 0;
const ok = (c, name, info = '') => { if (c) { pass++; console.log('✓ ' + name); } else { fail++; console.log('✗ ' + name + (info ? '：' + info : '')); } };

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());

// 個人資料頁的登出按鈕
await pg.goto(BASE + '?demo=mydata&noguide'); await pg.waitForTimeout(800);
ok(await pg.locator('#m-logout').count() === 1, '個人資料頁有登出按鈕');


// 模擬這台裝置上存著的資料（含別的網站的資料，不該被清）
await pg.evaluate(() => {
  localStorage.setItem('loveletter.session', JSON.stringify({ token: 't', expires: Date.now() + 864e5 }));
  localStorage.setItem('loveletter.cache', '{"home":{}}');
  localStorage.setItem('loveletter.draft.A1', '{"to":"林志豪","text":"秘密"}');
  localStorage.setItem('loveletter.lastAct', 'A1');
  localStorage.setItem('other.site', 'keep');
});

await pg.click('#m-logout'); await pg.waitForTimeout(200);
ok(await pg.locator('#m-logout.armed').count() === 1, '第一次按會先要求確認（避免誤按）');
ok(!pg.url().includes('loggedout'), '只按一次不會登出');
await pg.click('#m-logout'); await pg.waitForURL(/loggedout/); await pg.waitForTimeout(500);

ok((await pg.innerText('body')).includes('已經登出'), '登出後顯示「已經登出」');
const left = await pg.evaluate(() => Object.keys(localStorage));
ok(!left.some(k => k.startsWith('loveletter.')), '本平台在這台裝置上的資料都清掉了', left.join(','));
ok(left.includes('other.site'), '不會動到其他網站的資料');
ok(await pg.locator('a.btn', { hasText: '重新登入' }).count() === 1, '有「重新登入」按鈕');

// 重新整理登出頁，不會自動跳去登入
await pg.reload(); await pg.waitForTimeout(500);
ok((await pg.innerText('body')).includes('已經登出'), '重新整理還是停在登出頁，不自動再登入');

// 頁尾登出也要兩段式確認
await pg.goto(BASE + '?demo&noguide'); await pg.waitForTimeout(800);
ok(await pg.locator('#foot-logout').count() === 1, '首頁頁尾有登出連結');
await pg.click('#foot-logout'); await pg.waitForTimeout(150);
ok(!pg.url().includes('loggedout') && (await pg.innerText('#foot-logout')).includes('確定登出'), '頁尾登出第一次按只顯示確認');
await pg.click('#foot-logout'); await pg.waitForURL(/loggedout/);
ok(pg.url().includes('loggedout'), '頁尾登出再按一次就登出');

ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close();
console.log(`${pass}/${pass + fail} 通過`);
process.exit(fail ? 1 : 0);
