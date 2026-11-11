// 信紙一鍵存成圖片：拆開的信、我寫過的信、寫信頁、活動後台（總管理者）都有「存成圖片」，產生只含信紙的 PNG
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/paper-shot.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';
let pass = 0, fail = 0;
const ok = (c, name, info = '') => { if (c) { pass++; console.log('✓ ' + name); } else { fail++; console.log('✗ ' + name + (info ? '：' + info : '')); } };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());

async function shoot(sel, label, paperSel) {
  // 測試用瀏覽器遇到中文檔名會改叫 download，所以直接記下網頁給的檔名
  await pg.evaluate(() => { if (window.__pngNames) return; const o = shareOrDownloadPng; window.__pngNames = []; shareOrDownloadPng = (b, n) => { window.__pngNames.push(n); return o(b, n); }; });
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 20000 }).catch(() => null), pg.click(sel)]);
  if (!dl) { ok(false, label + '：產生圖片', '沒有下載'); return; }
  const path = await dl.path(); const buf = readFileSync(path);
  const png = buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  let want = null;
  if (paperSel) want = await pg.locator(paperSel).first().boundingBox();
  const name = await pg.evaluate(() => window.__pngNames.pop() || '');
  ok(png && /^流通神聖的愛-給.+-\d{4}年\d{1,2}月\d{1,2}日\.png$/.test(name), label + '：存成 PNG 檔', name);
  if (want) ok(Math.abs(w / h - want.width / want.height) < 0.03 && w >= want.width * 1.9, label + '：圖片只含信紙範圍（比例相同、2 倍解析度）', `${w}x${h} vs ${Math.round(want.width)}x${Math.round(want.height)}`);
  else ok(w > 300 && h > 300, label + '：圖片有內容', `${w}x${h}`);
  return buf;
}

await pg.goto(BASE + '?demo=letter&noguide'); await pg.waitForTimeout(700);
await pg.click('#l-open'); await pg.waitForTimeout(1600);
ok(await pg.locator('[data-shot=l-paper]').isVisible(), '拆開的信有「存成圖片」');
await shoot('[data-shot=l-paper]', '拆開的信', '#l-paper');

await pg.goto(BASE + '?mine&demo=mine&noguide'); await pg.waitForTimeout(900);
await pg.locator('[data-ml]').first().click(); await pg.waitForTimeout(600);
ok(await pg.locator('[data-shot=ml-paper]').isVisible(), '我寫過的信有「存成圖片」');
await shoot('[data-shot=ml-paper]', '我寫過的信', '#ml-paper');

await pg.goto(BASE + '?demo=write&new&noguide'); await pg.waitForTimeout(900);
ok(await pg.locator('[data-shot=w-shot]').count() === 1, '寫信頁有「存成圖片」');
await pg.click('[data-shot=w-shot]'); await pg.waitForTimeout(400);
ok((await pg.innerText('body')).includes('先寫一些話'), '還沒寫內容時提醒先寫');
await pg.fill('#w-to', '王小明'); await pg.fill('#w-text', '冬天的第一個問候，願主祝福你。');
await shoot('[data-shot=w-shot]', '寫信頁');
ok(await pg.locator('#w-shot-paper').count() === 0, '截完移除暫時排出的信紙');

await pg.goto(BASE + '?demo=admin&noguide'); await pg.waitForTimeout(900);
await pg.click('[data-act=A1]'); await pg.waitForTimeout(900);
await pg.locator('[data-row]').first().click(); await pg.waitForTimeout(400);
const s = pg.locator('.body [data-shot]');
ok(await s.count() === 1, '總管理者在活動後台展開信件也能存成圖片');
if (await s.count()) await shoot('.body [data-shot]', '活動後台的信', '.body .paper.mini');

ok(existsSync(new URL('../lib/modern-screenshot.js', import.meta.url)), '截圖工具放在網站裡，不靠外部 CDN');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
