// 好友清單找不到對方時：送出畫面與「我在這個活動寫的信」都能複製收信連結，複製後算已送出
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/copy-link.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';
let pass = 0, fail = 0;
const ok = (c, name, info = '') => { if (c) { pass++; console.log('✓ ' + name); } else { fail++; console.log('✗ ' + name + (info ? '：' + info : '')); } };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());

// 寫完信 → 送出畫面有「複製收信連結」
await pg.goto(BASE + '?demo=write&new&noguide'); await pg.waitForTimeout(900);
await pg.fill('#w-to', '鄭敦仁'); await pg.fill('#w-text', '敦仁弟兄，平安！');
await pg.click('#w-send'); await pg.waitForTimeout(1200);
ok(await pg.locator('#s-copy').isVisible(), '送出畫面有「複製收信連結」');
ok((await pg.innerText('.copy-alt')).includes('外部應用程式存取'), '說明找不到好友的原因');
await pg.click('#s-copy'); await pg.waitForTimeout(600);
const clip = await pg.evaluate(() => navigator.clipboard.readText());
const id = await pg.evaluate(() => LETTER.id);
ok(clip.includes('給「鄭敦仁」的信') && clip.includes('https://liff.line.me/2012412693-IhnpCNtr?letter=' + id), '複製的文字含收信連結', clip);
ok(await pg.evaluate(i => demo.letters.find(l => l.id === i).sent, id), '複製連結後算已送出');
ok((await pg.innerText('h2')).includes('信送出了'), '畫面變成已送出');

// 我在這個活動寫的信：沒收信的都可以複製連結
await pg.goto(BASE + '?demo=write&new&noguide'); await pg.waitForTimeout(900);
const n = await pg.locator('#w-mine [data-copy]').count();
ok(n > 0, '我寫的信列表有「複製連結」', String(n));
ok(await pg.locator('#w-mine [data-copy]').count() === await pg.evaluate(() => demo.letters.filter(l => l.fromUid === demo.me.userId && l.actId === 'A1' && !l.openedAt).length), '對方已收信的就不顯示');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
