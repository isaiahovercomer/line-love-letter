// 活動後台資料不完整（沒有 act）時：自動再讀一次；還是不完整就清楚提示，不會卡住
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/detail-guard.mjs
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
await pg.goto(BASE + '?demo&noguide'); await pg.waitForTimeout(900);
ok(await pg.evaluate(() => !detailOk({ ok: true }) && !detailOk({ ok: true, act: {} }) && detailOk({ act: { id: 'A1' }, list: [] })), '判斷資料是否完整');

// 第一次回傳不完整、第二次正常 → 照常打開
await pg.evaluate(() => { let n = 0; const o = demoApi; window.demoApi = async (a, d) => { if (a === 'actDetail' && n++ === 0) return { ok: true }; return o(a, d); }; });
await pg.click('[data-act=A1]'); await pg.waitForTimeout(900);
ok(await pg.locator('#d-back').count() === 1 && (await pg.innerText('h2')).includes('冬天的第一個問候'), '不完整時自動再讀一次就打開');

// 一直不完整 → 提示並回首頁，不是沒反應
await pg.goto(BASE + '?demo&noguide'); await pg.waitForTimeout(900);
await pg.evaluate(() => { const o = demoApi; window.demoApi = async (a, d) => a === 'actDetail' ? { ok: true } : o(a, d); });
await pg.click('[data-act=A1]'); await pg.waitForTimeout(900);
ok((await pg.innerText('body')).includes('活動資料讀取不完整') && await pg.locator('#h-new').count() === 1, '一直不完整時提示並回到活動列表');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
