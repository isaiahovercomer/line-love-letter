// 我的個人資料：編輯姓名／手機；信紙署名可修改
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/profile-sign.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';

let pass = 0, fail = 0;
const ok = (c, name, info = '') => { if (c) { pass++; console.log('✓ ' + name); } else { fail++; console.log('✗ ' + name + (info ? '：' + info : '')); } };

const b = await chromium.launch();
const newPage = async () => {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  pg.errs = []; pg.on('pageerror', e => pg.errs.push(String(e)));
  await pg.route('**/*', r => r.request().url().startsWith(BASE) || r.request().url().startsWith('data:') ? r.continue() : r.abort());
  return pg;
};

// ---- 編輯我的資料 ----
let pg = await newPage();
await pg.goto(BASE + '?demo=mydata&noguide'); await pg.waitForTimeout(800);
ok(await pg.locator('#m-edit').count() === 1, '個人資料頁有「編輯我的資料」');
ok(await pg.locator('#m-form').isHidden(), '表單一開始收起來');
await pg.click('#m-edit'); await pg.waitForTimeout(150);
ok(await pg.locator('#m-form').isVisible(), '按下後展開表單');
const oldName = await pg.inputValue('#m-name');
ok(oldName.length > 0 && (await pg.inputValue('#m-phone')).length >= 9, '表單預先填好目前的姓名與手機');
ok(await pg.locator('#m-warn').isHidden(), '名字沒改時不顯示提醒');
await pg.fill('#m-name', '陳怡君姊妹'); await pg.waitForTimeout(100);
ok(await pg.locator('#m-warn').isVisible(), '改名時顯示「舊名字的信會拆不開」提醒');
await pg.click('#m-cancel'); await pg.waitForTimeout(100);
ok(await pg.locator('#m-form').isHidden() && (await pg.inputValue('#m-name')) === oldName, '取消會還原並收起');

await pg.click('#m-edit'); await pg.fill('#m-phone', '12'); await pg.click('#m-save'); await pg.waitForTimeout(300);
ok(await pg.locator('#m-form').isVisible(), '手機不完整時擋住儲存');
await pg.fill('#m-name', '陳怡君姊妹'); await pg.fill('#m-phone', '0987654321'); await pg.click('#m-save'); await pg.waitForTimeout(900);
const body = await pg.innerText('body');
ok(body.includes('姓名：陳怡君姊妹') && body.includes('0987654321'), '儲存後顯示新的姓名與手機');
ok(pg.errs.length === 0, '個人資料頁沒有錯誤', pg.errs.join(' | '));
await pg.close();

// ---- 信紙署名 ----
pg = await newPage();
await pg.goto(BASE + '?demo=write&noguide'); await pg.waitForTimeout(900);
const me = await pg.evaluate(() => ME.name);
ok(await pg.locator('#w-sign').count() === 1, '信紙署名是可以修改的欄位');
ok((await pg.inputValue('#w-sign')) === me, '署名預設是登記的姓名');
await pg.fill('#w-sign', ''); await pg.locator('#w-sign').blur(); await pg.waitForTimeout(100);
ok((await pg.inputValue('#w-sign')) === me, '清空後離開欄位，自動回到登記的姓名');

// 攔截送出的內容
await pg.evaluate(() => { window.__sent = null; const orig = demoApi; window.demoApi = demoApi = async (a, d) => { if (a === 'writeLetter') window.__sent = JSON.parse(JSON.stringify(d.letter)); return orig(a, d); }; });
await pg.fill('#w-to', '林志豪'); await pg.fill('#w-text', '謝謝你！');
await pg.fill('#w-sign', '你的同伴 怡君');
await pg.click('#w-send'); await pg.waitForTimeout(900);
const sent = await pg.evaluate(() => window.__sent);
ok(sent && sent.sign === '你的同伴 怡君', '送出的信帶著自訂署名', JSON.stringify(sent));
ok(pg.errs.length === 0, '寫信頁沒有錯誤', pg.errs.join(' | '));
await pg.close();

// 署名跟登記姓名一樣時不另存
pg = await newPage();
await pg.goto(BASE + '?demo=write&noguide'); await pg.waitForTimeout(900);
await pg.evaluate(() => { window.__sent = null; const orig = demoApi; window.demoApi = demoApi = async (a, d) => { if (a === 'writeLetter') window.__sent = JSON.parse(JSON.stringify(d.letter)); return orig(a, d); }; });
await pg.fill('#w-to', '林志豪'); await pg.fill('#w-text', '平安！'); await pg.click('#w-send'); await pg.waitForTimeout(900);
ok((await pg.evaluate(() => window.__sent)).sign === '', '沒改署名時不另存（顯示時用登記姓名）');
await pg.close();

// 收信畫面顯示署名
pg = await newPage();
await pg.goto(BASE + '?demo=letter&noguide'); await pg.waitForTimeout(700);
await pg.evaluate(() => { demo.letters.forEach(l => { l.sign = '愛你的小明'; }); });
await pg.click('#l-open'); await pg.waitForTimeout(1500);
const sign = await pg.locator('.paper .sign').first().innerText();
ok(sign.includes('愛你的小明'), '收信畫面顯示寫信人的自訂署名', sign);
ok(await pg.locator('#l-reply').count() === 0 || (await pg.innerText('#l-reply')).includes('王小明'), '回信仍然用登記的真實姓名');
await pg.close();

const gs = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
ok(/function updateMyData/.test(gs) && /'updateMyData'/.test(gs), '後端有編輯我的資料');
ok(/SIGN: 12/.test(gs) && /'署名'\]/.test(gs), '後端存信件署名欄位');

await b.close();
console.log(`${pass}/${pass + fail} 通過`);
process.exit(fail ? 1 : 0);
