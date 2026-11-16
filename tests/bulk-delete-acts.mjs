// 活動列表：選取、全選、刪除已選的活動（只有建立者／總管理者能刪；按兩次確認；連同信件）
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/bulk-delete-acts.mjs
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
const info = await pg.evaluate(() => ACTS.map(a => ({ id: a.id, del: canDel(a), letters: a.letters })));
const del = info.filter(a => a.del), nodel = info.filter(a => !a.del);
ok(del.length >= 2 && await pg.locator('#h-sel').isVisible(), '活動列表有「選取」', JSON.stringify(info));

await pg.click('#h-sel'); await pg.waitForTimeout(200);
ok(await pg.locator('[data-hpick]').count() === del.length && await pg.locator('#h-seldel').isDisabled(), '可刪的活動能勾選，沒選時不能刪');
if (nodel.length) ok(await pg.locator('.card.act.nopick').count() === nodel.length && (await pg.innerText('body')).includes('只有活動建立者'), '別人建立的活動不能勾並說明原因');
await pg.click(`[data-hpick="${del[0].id}"]`); await pg.waitForTimeout(150);
ok((await pg.innerText('#h-selcount')).includes('已選 1 個活動'), '可以勾選');
await pg.click('#h-selall'); await pg.waitForTimeout(150);
ok((await pg.innerText('#h-selcount')).includes(`已選 ${del.length} 個活動`) && (await pg.innerText('#h-selall')).includes('取消全選'), '全選可刪的活動');
await pg.click('#h-selall'); await pg.waitForTimeout(150);
ok((await pg.innerText('#h-selcount')).includes('已選 0 個活動'), '取消全選');

const target = del.slice(0, 2);
for (const a of target) await pg.click(`[data-hpick="${a.id}"]`);
const before = await pg.evaluate(() => ({ acts: demo.acts.length, letters: demo.letters.length }));
await pg.click('#h-seldel'); await pg.waitForTimeout(150);
ok((await pg.innerText('#h-seldel')).includes('確定刪除 2 個活動') && await pg.evaluate(() => demo.acts.length) === before.acts, '第一次按只確認（含會一起刪的信件數）', await pg.innerText('#h-seldel'));
await pg.click('#h-seldel'); await pg.waitForTimeout(800);
const after = await pg.evaluate(ids => ({ acts: demo.acts.length, left: demo.acts.filter(a => ids.includes(a.id)).length, letters: demo.letters.filter(l => ids.includes(l.actId)).length }), target.map(a => a.id));
ok(after.acts === before.acts - 2 && after.left === 0 && after.letters === 0, '再按一次刪除選取的活動與信件', JSON.stringify(after));
ok(await pg.locator('[data-act]').count() === info.length - 2 && (await pg.innerText('body')).includes('已刪除 2 個活動'), '列表更新並提示');
ok(await pg.locator('[data-hpick]').count() === 0, '刪完離開選取模式');

const gs = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
const fn = gs.slice(gs.indexOf('function deleteActs'), gs.indexOf('/* ---------- 備選經文'));
ok(/requireCreator\(user, id\)/.test(fn) && /'deleteActs'/.test(gs.slice(0, gs.indexOf('function once'))) && /canDelete: mine \|\| sup/.test(gs), '後端：每個活動都檢查建立者、防重複送出、列表附可刪除');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
