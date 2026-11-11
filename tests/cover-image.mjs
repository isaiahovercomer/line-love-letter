// 建立活動：封面圖片（上傳／貼網址）、即時預覽、入口卡 hero
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/cover-image.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';

let pass = 0, fail = 0;
const ok = (c, name, info = '') => { if (c) { pass++; console.log('✓ ' + name); } else { fail++; console.log('✗ ' + name + (info ? '：' + info : '')); } };

// 一張 1x1 的 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.route('**/*', r => r.request().url().startsWith(BASE) || r.request().url().startsWith('data:') ? r.continue() : r.abort());
await pg.goto(BASE + '?demo&noguide'); await pg.waitForTimeout(800);
await pg.click('#h-new'); await pg.waitForTimeout(300);

ok(await pg.locator('#a-preview .pv-card').count() === 1, '建立頁下方有群組卡片預覽');
ok(await pg.locator('#a-preview .pv-hero').count() === 0, '沒有封面時預覽不顯示圖片區');
await pg.fill('#a-title', '寒假問候');
ok((await pg.innerText('#a-preview .pv-name')) === '寒假問候', '活動名稱即時同步到預覽');

await pg.setInputFiles('#a-file', { name: 'c.png', mimeType: 'image/png', buffer: PNG }); await pg.waitForTimeout(800);
ok(await pg.locator('#a-preview .pv-hero img').count() === 1, '上傳圖片後預覽出現封面');
ok((await pg.inputValue('#a-img')).length > 0, '上傳後圖片網址欄自動填入');

await pg.fill('#a-img', 'http://example.com/a.jpg'); await pg.waitForTimeout(200);
ok(await pg.locator('.cover-err').count() === 1 && await pg.locator('#a-preview .pv-hero').count() === 0, 'http 網址顯示錯誤、預覽不放圖');
await pg.click('#a-save'); await pg.waitForTimeout(300);
ok(await pg.locator('#a-save').count() === 1, 'http 網址擋住建立');

await pg.fill('#a-img', 'https://example.com/cover.jpg'); await pg.waitForTimeout(200);
ok(await pg.locator('#a-preview .pv-hero img').count() === 1, 'https 網址放進預覽');
const flex = await pg.evaluate(() => actFlex({ id: 'A1', title: 't', desc: '', deadline: '', paper: 'rose', image: 'https://example.com/cover.jpg' }));
ok(flex.contents.hero && flex.contents.hero.url === 'https://example.com/cover.jpg', '入口卡有 hero 圖片');
const flex2 = await pg.evaluate(() => actFlex({ id: 'A1', title: 't', desc: '', deadline: '', paper: 'rose', image: 'data:image/png;base64,xx' }));
ok(!flex2.contents.hero, '非 https 圖片不放進入口卡');

// 按鈕文字：預設、可修改、同步到預覽與入口卡
ok((await pg.innerText('#a-preview .pv-btn')) === '書寫一封溫暖的問候', '按鈕文字預設「書寫一封溫暖的問候」');
await pg.fill('#a-btn', '寫信給我的同伴'); await pg.waitForTimeout(150);
ok((await pg.innerText('#a-preview .pv-btn')) === '寫信給我的同伴', '修改按鈕文字即時同步到預覽');
const fb = await pg.evaluate(() => actFlex({ id: 'A1', title: 't', desc: '', deadline: '', paper: 'rose', button: '寫信給我的同伴' }));
ok(fb.contents.footer.contents[0].action.label === '寫信給我的同伴', '入口卡按鈕用自訂文字');
const fd = await pg.evaluate(() => actFlex({ id: 'A1', title: 't', desc: '', deadline: '', paper: 'rose', button: '' }));
ok(fd.contents.footer.contents[0].action.label === '書寫一封溫暖的問候', '沒填按鈕文字時入口卡用預設');
await pg.fill('#a-btn', ''); await pg.waitForTimeout(150);
ok((await pg.innerText('#a-preview .pv-btn')) === '書寫一封溫暖的問候', '清空後預覽回到預設文字');

await pg.click('#a-img-x'); await pg.waitForTimeout(200);
ok((await pg.inputValue('#a-img')) === '' && await pg.locator('#a-preview .pv-hero').count() === 0, '按 × 移除封面');

const gs = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
ok(/'封面圖片'/.test(gs) && /IMAGE: 8/.test(gs) && /function cleanImageUrl/.test(gs), '後端存封面圖片欄位並檢查網址');
ok(/'按鈕文字'\]/.test(gs) && /BUTTON: 9/.test(gs), '後端存按鈕文字欄位');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));

await b.close();
console.log(`${pass}/${pass + fail} 通過`);
process.exit(fail ? 1 : 0);
