// 活動後台：選取、全選、刪除已選的信（只刪這個活動、要按兩次確認）
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/bulk-delete.mjs
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
await pg.click('[data-act=A1]'); await pg.waitForTimeout(900);
const total = await pg.locator('[data-row]').count();
const otherActs = await pg.evaluate(() => demo.letters.filter(l => l.actId !== 'A1').length);
ok(total >= 3 && await pg.locator('#d-sel').isVisible(), '活動後台有「選取」', String(total));

await pg.click('#d-sel'); await pg.waitForTimeout(200);
ok(await pg.locator('[data-pick]').count() === total && await pg.locator('#d-seldel').isDisabled(), '進入選取模式：每封信可勾，沒選時不能刪');
const ids = await pg.locator('[data-pick]').evaluateAll(els => els.map(e => e.dataset.pick));
await pg.click(`[data-pick="${ids[0]}"]`); await pg.click(`[data-pick="${ids[1]}"]`); await pg.waitForTimeout(150);
ok((await pg.innerText('#d-selcount')).includes('已選 2 封') && await pg.locator(`[data-pick="${ids[0]}"][aria-checked=true]`).count() === 1, '可以勾選多封');
await pg.click(`[data-pick="${ids[1]}"]`); await pg.waitForTimeout(100);
ok((await pg.innerText('#d-selcount')).includes('已選 1 封'), '再點一次取消勾選');

await pg.click('#d-selall'); await pg.waitForTimeout(150);
ok((await pg.innerText('#d-selcount')).includes(`已選 ${total} 封`) && (await pg.innerText('#d-selall')).includes('取消全選'), '全選目前列出的信');
await pg.click('#d-selall'); await pg.waitForTimeout(150);
ok((await pg.innerText('#d-selcount')).includes('已選 0 封'), '再按一次取消全選');

// 篩選「待收信」後全選，只選到待收信的
await pg.click('[data-f=pending]'); await pg.waitForTimeout(200);
const pending = await pg.locator('[data-pick]').count();
await pg.click('#d-selall'); await pg.waitForTimeout(150);
ok((await pg.innerText('#d-selcount')).includes(`已選 ${pending} 封`), '篩選後全選只選目前列出的', String(pending));

await pg.click('#d-seldel'); await pg.waitForTimeout(150);
ok((await pg.innerText('#d-seldel')).includes('確定刪除這') && await pg.evaluate(() => demo.letters.filter(l => l.actId === 'A1').length) === total, '第一次按只確認，還沒刪');
await pg.click('#d-seldel'); await pg.waitForTimeout(800);
const left = await pg.evaluate(() => demo.letters.filter(l => l.actId === 'A1').length);
ok(left === total - pending, '再按一次刪除已選的信', `${left} vs ${total - pending}`);
ok(await pg.evaluate(() => demo.letters.filter(l => l.actId !== 'A1').length) === otherActs, '其他活動的信不受影響');
ok(await pg.locator('#d-sel').isVisible() && (await pg.innerText('body')).includes(`已刪除 ${pending} 封信`), '刪完回到一般模式並提示');

await pg.click('[data-f=all]'); await pg.waitForTimeout(200);
await pg.click('#d-sel'); await pg.click('#d-seldone'); await pg.waitForTimeout(150);
ok(await pg.locator('[data-row]').count() === left && await pg.locator('[data-pick]').count() === 0, '「完成」離開選取模式');

const gs = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
const fn = gs.slice(gs.indexOf('function deleteLetters'), gs.indexOf('/** 寫信的人選好朋友'));
ok(/requireOwner\(user, actId\)/.test(fn) && /LT\.ACT\]\) === String\(actId\)/.test(fn) && /'deleteLetters'/.test(gs.slice(0, gs.indexOf('function once'))), '後端批次刪除：限活動管理者、只刪這個活動、防重複送出');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
