// 信末署名下的日期含年份：寫信頁、拆信、看自己寫過的信都是「2026年11月10日」格式
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/sign-date.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';

let pass = 0, fail = 0;
const ok = (c, name, info = '') => { if (c) { pass++; console.log('✓ ' + name); } else { fail++; console.log('✗ ' + name + (info ? '：' + info : '')); } };
const FULL = /^\d{4}年\d{1,2}月\d{1,2}日$/;

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());

// 換算規則
const conv = await pg.goto(BASE + '?demo&noguide').then(() => pg.waitForTimeout(500)).then(() => pg.evaluate(() => [
  sigDate('2026/11/10 18:02'), sigDate('2026/6/1 21:05'), sigDate('2026-12-24 23:59'), sigDate(new Date(2027, 0, 5)), sigDate('剛剛'),
]));
ok(conv[0] === '2026年11月10日' && conv[1] === '2026年6月1日' && conv[2] === '2026年12月24日', '舊信的寫信時間換成含年份的日期', conv.join(' | '));
ok(conv[3] === '2027年1月5日', '今天的日期也含年份');
ok(conv[4] === '剛剛', '看不懂的時間原樣顯示');

// 寫信頁
await pg.goto(BASE + '?demo=write&noguide'); await pg.waitForTimeout(800);
const d1 = (await pg.locator('#paper .date').innerText()).trim();
const y = new Date().getFullYear();
ok(FULL.test(d1) && d1.startsWith(y + '年'), '寫信頁信末日期含今年年份', d1);

// 拆信
await pg.goto(BASE + '?demo=letter&noguide'); await pg.waitForTimeout(700);
await pg.click('#l-open'); await pg.waitForTimeout(1500);
const d2 = (await pg.locator('.paper .date').first().innerText()).trim();
ok(FULL.test(d2), '拆開的信信末日期含年份、不含時間', d2);

// 看自己寫過的信
await pg.goto(BASE + '?mine&demo=mine&noguide'); await pg.waitForTimeout(900);
await pg.locator('[data-ml]').first().click(); await pg.waitForTimeout(500);
const d3 = (await pg.locator('.paper .date').first().innerText()).trim();
ok(FULL.test(d3), '我寫過的信信末日期含年份', d3);

ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close();
console.log(`${pass}/${pass + fail} 通過`);
process.exit(fail ? 1 : 0);
