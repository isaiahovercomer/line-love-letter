// 預覽頁煙霧測試：只開 ?demo 頁面，用範例資料，不連真正的後端、不送任何東西到 LINE。
// 用法：先在 repo 根目錄開靜態伺服器（例如 python3 -m http.server 18765），再
//   NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/demo-smoke.mjs
// 可選：CHROME_PATH=/usr/bin/google-chrome（不給就用 Playwright 內建的 Chromium）、SHOTS_DIR=_shots（順便存截圖 after-*.png）
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';
const SHOTS = process.env.SHOTS_DIR || '';
const CHROME = process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'zh-TW' });
// 外部資源（LINE SDK、Google 字型）不需要：擋掉讓測試穩定、也確保不會連到外面
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());

const results = [];
async function check(name, path, fn) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(new URL(path, BASE).href, { waitUntil: 'load' });
    await fn(page);
    if (errors.length) throw new Error('頁面錯誤：' + errors.join(' | '));
    results.push([name, 'ok']);
  } catch (e) {
    results.push([name, 'FAIL ' + e.message.split('\n')[0]]);
  } finally {
    await page.close();
  }
}
const shot = (page, name) => SHOTS ? page.screenshot({ path: join(SHOTS, `after-${name}.png`) }) : null;
const expectText = async (page, sel, text) => {
  await page.locator(sel).filter({ hasText: text }).first().waitFor({ state: 'visible', timeout: 5000 });
};
const clickOpen = async page => {
  await page.locator('#l-open').click();
  await page.waitForTimeout(2000); // 拆信動畫 .7s，750ms 後換成信紙，再等信紙 .6s 淡入結束
};

await check('home（使用說明）', '?demo', async page => {
  await expectText(page, '.guide h3', '建立流通神聖的愛活動');
  await shot(page, 'home');
});

await check('home-noguide：活動卡與截止時間不被拆行', '?demo&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  if (await page.locator('.guide').count()) throw new Error('noguide 仍出現使用說明');
  const n = await page.locator('.card.act').count();
  if (n !== 2) throw new Error(`活動卡數量 ${n}`);
  const lines = await page.locator('.card.act .s .nowrap', { hasText: '截止' }).first().evaluate(el => el.getClientRects().length);
  if (lines !== 1) throw new Error('截止時間被拆成兩行');
  await shot(page, 'home-noguide');
});

await check('write（使用說明）', '?demo=write', async page => {
  await expectText(page, '.guide h3', '寫一封信');
  await shot(page, 'write');
});

await check('write-noguide：寫信並送出', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  await shot(page, 'write-noguide');
  await page.fill('#w-to', '林志豪');
  await page.fill('#w-text', '煙霧測試的悄悄話');
  await page.locator('#w-send').click();
  await expectText(page, 'h2', '信送出了');
});

await check('bind：第一次寫信先填姓名手機', '?demo=bind&noguide', async page => {
  await page.locator('#b-name').waitFor();
  await shot(page, 'bind');
  await page.fill('#b-name', '測試者');
  await page.fill('#b-phone', '0912345678');
  await page.locator('#b-go').click();
  await page.locator('#w-to').waitFor({ timeout: 5000 });
});

await check('letter：收信後看到內容', '?demo=letter&noguide', async page => {
  await expectText(page, 'h2', '有一封給「陳怡君」的信');
  await shot(page, 'letter');
  await clickOpen(page);
  await expectText(page, '.paper .text', '謝謝你這一年');
  await expectText(page, 'p', /收信成功|已經收過這封信/);   // 範例信 L1 已被收過，顯示「已經收過」
  await shot(page, 'letter-opened');
});

await check('wrong：不是給你的信', '?demo=wrong&noguide', async page => {
  await clickOpen(page);
  await expectText(page, 'h2', '這封信不是給你的');
  if (await page.locator('.paper .text').count()) throw new Error('不該看到信件內容');
  await shot(page, 'wrong-opened');
});

await check('newbie：先登記才能收信', '?demo=newbie&noguide', async page => {
  await clickOpen(page);
  await expectText(page, 'h2', '收信前，先確認你是誰');
  await page.locator('#b-name').waitFor();
  if (await page.locator('.paper .text').count()) throw new Error('不該看到信件內容');
  await shot(page, 'newbie-opened');
});

await check('mydata：我的個人資料', '?demo=mydata&noguide', async page => {
  await expectText(page, 'h2', '我的個人資料');
  await expectText(page, '.card', '陳怡君');
  await shot(page, 'mydata');
});

await check('verses：點備選經文，出處與恢復本內容都填好', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  const n = await page.locator('[data-v]').count();
  if (n !== 21) throw new Error(`備選經文 ${n} 條`);
  const picks = page.locator('#v-picks');
  await picks.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 120));
  await shot(page, 'verses-menu');
  // 每一條都要有內容（不檢查文字本身）
  for (let i = 0; i < n; i++) {
    await page.locator(`[data-v="${i}"]`).click();
    const [ref, text] = await page.evaluate(() => [document.getElementById('v-ref').value, document.getElementById('v-text').value]);
    if (!ref || !text) throw new Error(`第 ${i + 1} 條沒有出處或內容`);
    if (/\[|\]/.test(text)) throw new Error(`第 ${i + 1} 條還有補字中括號`);
    if (/請把這節經文/.test(await page.locator('#toast').textContent())) throw new Error('還會跳出「請把這節經文貼在下面」');
  }
  await page.locator('[data-v="0"]').click();
  await page.locator('#v-text').scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 160));
  await shot(page, 'verses-picked');
});

await browser.close();
for (const [n, r] of results) console.log(`${r === 'ok' ? '✓' : '✗'} ${n}${r === 'ok' ? '' : '：' + r}`);
const failed = results.filter(r => r[1] !== 'ok').length;
console.log(`${results.length - failed}/${results.length} 通過`);
process.exit(failed ? 1 : 0);
