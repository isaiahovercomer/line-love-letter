// 活動後台：新增／移除共同管理者、停止寫信、切換篩選後，畫面停在原來的位置，不跳回最上面
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/keep-scroll.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';
let pass = 0, fail = 0;
const ok = (c, name, info = '') => { if (c) { pass++; console.log('✓ ' + name); } else { fail++; console.log('✗ ' + name + (info ? '：' + info : '')); } };
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 390, height: 700 } });
const errs = []; pg.on('pageerror', e => errs.push(String(e)));
await pg.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
await pg.goto(BASE + '?demo&noguide'); await pg.waitForTimeout(900);
await pg.click('[data-act=A1]'); await pg.waitForTimeout(900);

const add = pg.locator('[data-coadd]').filter({ hasText: '簡晨光' }).first();
await add.scrollIntoViewIfNeeded(); await pg.waitForTimeout(200);
const y0 = await pg.evaluate(() => scrollY);
await add.click(); await pg.waitForTimeout(100); await add.click(); await pg.waitForTimeout(900);
const y1 = await pg.evaluate(() => scrollY);
ok(y0 > 300 && Math.abs(y1 - y0) < 5, '新增共同管理者後停在原位置', `${y0} → ${y1}`);
ok((await pg.innerText('#d-coadmins')).includes('簡晨光'), '新增成功');

const rem = pg.locator('#d-coadmins [data-corem]').first();
await rem.scrollIntoViewIfNeeded(); await pg.waitForTimeout(200);
const y2 = await pg.evaluate(() => scrollY);
await rem.click(); await pg.waitForTimeout(100); await rem.click(); await pg.waitForTimeout(900);
ok(Math.abs((await pg.evaluate(() => scrollY)) - y2) < 5, '移除共同管理者後停在原位置');

await pg.locator('#d-open').scrollIntoViewIfNeeded(); await pg.waitForTimeout(200);
const y3 = await pg.evaluate(() => scrollY);
await pg.click('#d-open'); await pg.waitForTimeout(900);
ok(Math.abs((await pg.evaluate(() => scrollY)) - y3) < 5 && (await pg.innerText('#d-open')).includes('重新開放寫信'), '停止寫信後停在原位置');
ok(errs.length === 0, '頁面沒有錯誤', errs.join(' | '));
await b.close(); console.log(`${pass}/${pass + fail} 通過`); process.exit(fail ? 1 : 0);
