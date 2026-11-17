// 每個頁面最上面的圖示與標題都是連結，點了回首頁
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/top-home.mjs
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
for (const [q, label] of [['?demo=write&new&noguide', '寫信頁'], ['?demo=letter&noguide', '收信頁'], ['?mine&demo=mine&noguide', '我寫過的信'], ['?mydata&demo=mydata&noguide', '個人資料']]) {
  await pg.goto(BASE + q); await pg.waitForTimeout(900);
  const a = pg.locator('header.top a.brand');
  ok(await a.count() === 1 && (await a.getAttribute('href')) === '?demo&noguide', label + '：標題是回首頁的連結');
}
await pg.goto(BASE + '?demo=write&new&noguide'); await pg.waitForTimeout(900);
await pg.click('header.top a.brand'); await pg.waitForTimeout(1000);
ok(await pg.locator('#h-new').count() === 1, '點標題回到首頁');
await pg.click('[data-act=A1]'); await pg.waitForTimeout(900);
await pg.click('header.top img'); await pg.waitForTimeout(1000);
ok(await pg.locator('#h-new').count() === 1, '在活動後台點圖示也回首頁');
const deco = await pg.evaluate(() => getComputedStyle(document.querySelector('header.top a.brand')).textDecorationLine);
ok(deco === 'none', '標題不顯示底線，外觀不變');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
