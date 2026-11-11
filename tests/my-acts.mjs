// 我參加過的活動：個人資料頁列出寫過／收過信的活動，結束的也留著；點進去去寫信或看自己的信
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/my-acts.mjs
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

await pg.goto(BASE + '?demo=mydata&noguide'); await pg.waitForTimeout(900);
const expect = await pg.evaluate(() => demoMyActs());
ok(expect.length > 0, '預覽資料裡有參加過的活動', JSON.stringify(expect));
ok(await pg.locator('.myacts h3').count() === 1, '個人資料頁有「我參加過的活動」');
ok(await pg.locator('[data-myact]').count() === expect.length, '每個參加過的活動列一筆');

const ended = expect.find(a => a.state !== 'open');
const open = expect.find(a => a.state === 'open');
ok(!!ended, '結束或停止寫信的活動也留在清單上', JSON.stringify(expect.map(a => a.state)));
if (ended) {
  const t = await pg.innerText(`[data-myact="${ended.id}"]`);
  ok(t.includes(ended.title) && t.includes('看我的信'), '結束的活動顯示「看我的信」', t);
}
if (open) {
  const t = await pg.innerText(`[data-myact="${open.id}"]`);
  ok(t.includes('去寫信') && t.includes(`寫了 ${open.written} 封`), '進行中的活動顯示「去寫信」與寫了幾封', t);
}

// 點結束的活動 → 只看那個活動寫過的信
if (ended) {
  await pg.click(`[data-myact="${ended.id}"]`); await pg.waitForURL(/mine/); await pg.waitForTimeout(800);
  ok(pg.url().includes('only=' + ended.id), '帶著活動代碼到我寫過的信');
  ok((await pg.innerText('h2')).includes(ended.title), '標題寫明是哪個活動的信');
  const rows = await pg.locator('[data-ml]').count();
  const want = await pg.evaluate(id => demo.letters.filter(l => l.fromUid === demo.me.userId && l.actId === id).length, ended.id);
  ok(rows === want, '只列這個活動裡我寫的信', `${rows} vs ${want}`);
  ok(await pg.locator('a', { hasText: '看全部活動寫過的信' }).count() === 1, '可以回到全部的信');
}

// 點進行中的活動 → 去寫信
if (open) {
  await pg.goto(BASE + '?demo=mydata&noguide'); await pg.waitForTimeout(800);
  await pg.click(`[data-myact="${open.id}"]`); await pg.waitForTimeout(800);
  ok(/act=/.test(pg.url()) && !/mine/.test(pg.url()), '進行中的活動點了去寫信頁', pg.url());
}

const gs = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
ok(/function myActs/.test(gs) && /acts: myActs\(user\)/.test(gs), '後端個人資料附上參加過的活動');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close();
console.log(`${pass}/${pass + fail} 通過`);
process.exit(fail ? 1 : 0);
