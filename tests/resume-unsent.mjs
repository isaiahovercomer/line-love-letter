// 未送出的信：寫信時先打開暫存的信接著寫；「我寫過的信」點未送出的信可以繼續編輯
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/resume-unsent.mjs
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

// 活動裡有未送出的信（L5 給王小明）→ 我要寫信時直接打開它
await pg.goto(BASE + '?demo=write&noguide'); await pg.waitForTimeout(900);
ok((await pg.innerText('h2')).includes('繼續寫給「王小明」的信'), '進寫信頁先打開未送出的信', await pg.innerText('h2'));
ok(await pg.locator('#w-resume').isVisible(), '提醒這封信還沒送出');
ok((await pg.inputValue('#w-to')) === '王小明' && (await pg.inputValue('#w-text')).includes('謝謝你常關心新人'), '帶出原本寫的內容');
ok((await pg.innerText('#w-send')).includes('儲存並送出'), '按鈕是「儲存並送出」');

// 改內容後送出：會存好並接著選朋友送（預覽沒有 LINE，停在「信已存好」）
await pg.fill('#w-text', '小明弟兄，謝謝你常關心新人。補一句：主祝福你！');
await pg.click('#w-send'); await pg.waitForTimeout(1200);
const saved = await pg.evaluate(() => demo.letters.find(l => l.id === 'L5').text);
ok(saved.includes('補一句'), '修改存回同一封信，不會多一封', saved);
ok(await pg.evaluate(() => demo.letters.filter(l => l.fromUid === demo.me.userId && l.actId === 'A1').length) === 2, '沒有多出新的信');
ok(await pg.locator('#s-again').count() === 1, '存好後到送出畫面');

// 「改寫一封新的信」可以跳過暫存
await pg.goto(BASE + '?demo=write&noguide'); await pg.waitForTimeout(900);
await pg.click('#w-cancel'); await pg.waitForTimeout(300);
ok((await pg.innerText('h2')).includes('冬天的第一個問候') && (await pg.inputValue('#w-to')) === '', '可以改寫一封新的信');

// 回信給別人時，不會打開寫給另一個人的暫存信
await pg.goto(BASE + '?demo=write&to=' + encodeURIComponent('李美玲') + '&noguide'); await pg.waitForTimeout(900);
ok((await pg.inputValue('#w-to')) === '李美玲' && !(await pg.innerText('h2')).includes('繼續寫給'), '指定收信人時只接續寫給同一人的信');

// 我寫過的信：未送出的那封標示「繼續編輯」，點了去寫信頁接著寫
await pg.goto(BASE + '?demo=mine&noguide'); await pg.waitForTimeout(900);
const row = pg.locator('[data-mledit="L5"]');
ok(await row.count() === 1 && (await row.innerText()).includes('繼續編輯'), '未送出的信顯示「繼續編輯」');
await row.click(); await pg.waitForURL(/edit=L5/); await pg.waitForTimeout(900);
ok((await pg.innerText('h2')).includes('繼續寫給「王小明」的信'), '點了直接打開那封信編輯');

ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close();
console.log(`${pass}/${pass + fail} 通過`);
process.exit(fail ? 1 : 0);
