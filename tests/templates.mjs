// 活動範本：活動後台存成範本、建立頁從範本開始、刪除範本；範本不含截止時間與個資
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/templates.mjs
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
await pg.goto(BASE + '?demo&noguide'); await pg.waitForTimeout(900);

// ---- 建立頁：從範本開始 ----
await pg.click('#h-new'); await pg.waitForTimeout(600);
ok(await pg.locator('#a-tpl').isVisible(), '建立頁上方顯示「從範本開始」');
ok(await pg.locator('[data-tpl]').count() === 2, '列出我的範本和別人分享的範本');
const meta = await pg.locator('.tpl-meta').allInnerTexts();
ok(meta[0].includes('我的') && meta[1].includes('共享'), '標示我的／共享', meta.join(' | '));
const isAdmin = await pg.evaluate(() => !!(ME && (ME.isAdmin || ME.isSuper)));
ok((await pg.locator('[data-tpl="T2"] [data-tdel]').count() === 1) === isAdmin, '別人的範本只有管理員能刪');
ok(await pg.locator('[data-tpl="T1"] [data-tdel]').count() === 1, '自己的範本可以刪');

await pg.click('[data-tpl="T2"]'); await pg.waitForTimeout(200);
ok((await pg.inputValue('#a-title')) === '寫給福音朋友的一封信', '點範本會填入活動名稱');
ok((await pg.inputValue('#a-paper')) === 'gospel' && (await pg.inputValue('#a-btn')) === '寫一封關心的信', '一併填入信紙與按鈕文字');
ok((await pg.inputValue('#a-dl')) === '', '範本不帶截止時間');
ok((await pg.innerText('#a-preview .pv-name')) === '寫給福音朋友的一封信', '預覽同步更新');
ok((await pg.locator('[data-tpl="T2"]').getAttribute('aria-pressed')) === 'true', '選到的範本有標示');
await pg.fill('#a-title', '改過的名字'); await pg.waitForTimeout(100);
ok((await pg.innerText('#a-preview .pv-name')) === '改過的名字', '套用後還可以修改');

// 刪除自己的範本（兩段式）
await pg.click('[data-tpl="T1"] [data-tdel]'); await pg.waitForTimeout(100);
ok(await pg.locator('[data-tpl]').count() === 2, '刪除要按兩次（第一次只確認）');
await pg.click('[data-tpl="T1"] [data-tdel]'); await pg.waitForTimeout(400);
ok(await pg.locator('[data-tpl="T1"]').count() === 0, '再按一次就刪掉自己的範本');
ok((await pg.inputValue('#a-title')) === '改過的名字', '刪範本不會清掉已填的內容');

// ---- 活動後台：存成範本 ----
await pg.click('#f-back'); await pg.waitForTimeout(400);
await pg.click('[data-act=A1]'); await pg.waitForTimeout(700);
ok(await pg.locator('#d-tpl').count() === 1, '活動後台有「存成範本」');
await pg.click('#d-tpl'); await pg.waitForTimeout(200);
ok(await pg.locator('#d-tpl-form').isVisible(), '按下後展開存範本表單');
const hint = await pg.innerText('#d-tpl-form');
ok(hint.includes('不含截止時間、信件、收信人或名單') && hint.includes('確認說明裡沒有個人資料'), '提醒範本內容與分享前確認個資');
ok(!(await pg.isChecked('#t-shared')), '預設不分享');
await pg.fill('#t-name', '我的冬季範本');
await pg.click('#t-save'); await pg.waitForTimeout(500);
ok(await pg.locator('#d-tpl-form').isHidden(), '存好後收起表單');

// 回到建立頁，新範本在最前面
await pg.click('#d-back'); await pg.waitForTimeout(400);
await pg.click('#h-new'); await pg.waitForTimeout(600);
const names = await pg.locator('.tpl-name').allInnerTexts();
ok(names[0] === '我的冬季範本', '新存的範本出現在建立頁最前面', names.join(' | '));
ok((await pg.locator('.tpl-meta').first().innerText()) === '我的', '沒勾分享就只有自己看得到');

// 編輯活動時不顯示範本
await pg.click('#f-back'); await pg.waitForTimeout(300);
await pg.click('[data-act=A1]'); await pg.waitForTimeout(600); await pg.click('#d-edit'); await pg.waitForTimeout(300);
ok(await pg.locator('#a-tpl').count() === 0, '編輯既有活動時不顯示範本');

const gs = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
ok(/function saveTemplate/.test(gs) && /function listTemplates/.test(gs) && /function deleteTemplate/.test(gs), '後端有範本的存、列、刪');
ok(/'活動範本'/.test(gs) && /templates = deleteRows\(SH\.TEMPLATES/.test(gs), '刪除我的資料時一併刪除範本');
const saveFn = gs.slice(gs.indexOf('function saveTemplate'), gs.indexOf('function deleteTemplate'));
ok(!/deadline|LETTERS|ROSTER\b/.test(saveFn), '存範本不寫入截止時間、信件或名單');

ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close();
console.log(`${pass}/${pass + fail} 通過`);
process.exit(fail ? 1 : 0);
