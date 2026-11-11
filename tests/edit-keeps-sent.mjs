// 修改已送出的信（含改收信人名字）：還是同一封信，不會變回「未送出」
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/edit-keeps-sent.mjs
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
const sent = await pg.evaluate(() => demo.letters.find(l => l.fromUid === demo.me.userId && l.actId === 'A1' && l.sent && !l.openedAt));
ok(!!sent, '預覽資料有一封已送出、對方未收的信');
const before = await pg.evaluate(() => demo.letters.length);
await pg.click(`[data-edit="${sent.id}"]`); await pg.waitForTimeout(400);
await pg.fill('#w-to', '*' + sent.to);   // 像「*教安」→ 改名字
await pg.click('#w-send'); await pg.waitForTimeout(900);
const after = await pg.evaluate(id => demo.letters.find(l => l.id === id), sent.id);
ok(after.to === '*' + sent.to && after.sent === true, '改了收信人名字仍是「已送出」', JSON.stringify({ to: after.to, sent: after.sent }));
ok(await pg.evaluate(() => demo.letters.length) === before, '沒有多出一封信');
ok((await pg.innerText('body')).includes('還是同一封信'), '提示仍是同一封信');
ok(await pg.locator('#w-to').count() === 1 && !(await pg.innerText('h2')).includes('修改'), '存好回到寫信頁，不要求重新送出');
const gs = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
const fn = gs.slice(gs.indexOf('function updateLetter'), gs.indexOf('function deleteLetter'));
ok(!/LT\.SENT/.test(fn), '後端修改信件不會改動已送出狀態');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
