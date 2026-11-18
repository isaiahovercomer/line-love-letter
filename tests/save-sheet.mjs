// 手機（LINE 內建瀏覽器）按「存成圖片」：打開圖片讓人長按儲存；分享被擋時也一樣；再按「分享／儲存」才打開分享
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/save-sheet.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';
let pass = 0, fail = 0;
const ok = (c, name, info = '') => { if (c) { pass++; console.log('✓ ' + name); } else { fail++; console.log('✗ ' + name + (info ? '：' + info : '')); } };
const b = await chromium.launch();
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.19.0';
async function page(shareMode) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  pg.errs = []; pg.on('pageerror', e => pg.errs.push(String(e)));
  await pg.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  await pg.addInitScript(mode => {
    window.__shares = 0;
    if (mode === 'none') { delete Navigator.prototype.share; delete Navigator.prototype.canShare; navigator.share = undefined; navigator.canShare = undefined; }
    else {
      let first = true;
      navigator.canShare = () => true;
      navigator.share = async () => { window.__shares++; if (mode === 'blocked' && first) { first = false; const e = new Error('not allowed'); e.name = 'NotAllowedError'; throw e; } };
    }
  }, shareMode);
  return pg;
}
// 1) LINE 沒有分享功能
let pg = await page('none');
await pg.goto(BASE + '?demo=letter&noguide'); await pg.waitForTimeout(800);
await pg.click('#l-open'); await pg.waitForTimeout(1600);
await pg.click('[data-shot=l-paper]'); await pg.waitForTimeout(2500);
ok(await pg.locator('.save-sheet').isVisible(), '沒有分享功能：打開存圖畫面');
ok((await pg.innerText('.save-sheet')).includes('長按下面的圖片'), '說明長按圖片儲存');
const src = await pg.locator('.save-sheet .ss-img').getAttribute('src');
ok(/^data:image\/png;base64,/.test(src || '') && (src || '').length > 5000, '圖片是可長按儲存的 PNG');
ok(await pg.locator('#ss-share').count() === 0 && await pg.locator('#ss-dl').count() === 1, '不能分享時不顯示分享按鈕，保留下載');
await pg.click('#ss-close'); await pg.waitForTimeout(200);
ok(await pg.locator('.save-sheet').count() === 0, '可以關閉');
ok(pg.errs.length === 0, '頁面沒有錯誤（無分享）', pg.errs.join(' | '));
await pg.context().close();

// 2) 截圖後分享被擋（點擊過期）→ 存圖畫面，再按「分享／儲存」才打開分享
pg = await page('blocked');
await pg.goto(BASE + '?mine&demo=mine&noguide'); await pg.waitForTimeout(900);
await pg.locator('[data-ml]').first().click(); await pg.waitForTimeout(600);
await pg.click('[data-shot=ml-paper]'); await pg.waitForTimeout(2500);
ok(await pg.locator('.save-sheet').isVisible() && await pg.locator('#ss-share').isVisible(), '分享被擋時打開存圖畫面，有「分享／儲存」');
await pg.click('#ss-share'); await pg.waitForTimeout(400);
ok(await pg.evaluate(() => window.__shares) === 2 && await pg.locator('.save-sheet').count() === 0, '按「分享／儲存」打開分享並關閉畫面');
ok(pg.errs.length === 0, '頁面沒有錯誤（分享被擋）', pg.errs.join(' | '));
await pg.context().close();

// 3) 分享直接可用 → 直接打開分享，不出現存圖畫面
pg = await page('ok');
await pg.goto(BASE + '?mine&demo=mine&noguide'); await pg.waitForTimeout(900);
await pg.locator('[data-ml]').first().click(); await pg.waitForTimeout(600);
await pg.click('[data-shot=ml-paper]'); await pg.waitForTimeout(2500);
ok(await pg.evaluate(() => window.__shares) === 1 && await pg.locator('.save-sheet').count() === 0, '可以分享時直接打開分享選單');
await pg.context().close();
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
