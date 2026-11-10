// 連點測試：送出類按鈕連按 5 次，後端呼叫與朋友／群組選單都只能各 1 次；失敗後可以再按。
// 只開 ?demo 頁面，擋掉所有外部網路；後端（demoApi）與 liff.shareTargetPicker 在頁面裡包一層計數，不打真實後端。
// 另外檢查信封上的封蠟不會蓋到「To. 名字」（390px 與 320px）。
// 用法：NODE_PATH=<有 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18766/ node tests/no-double-submit.mjs
// 可選：CHROME_PATH=/usr/bin/google-chrome、SHOTS_DIR=_shots（存 after5-env-390.png、after5-env-320.png）
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:18766/';
const SHOTS = process.env.SHOTS_DIR || '';
const CHROME = process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const newCtx = async (width, height) => {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: 'zh-TW' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());
  return ctx;
};
const ctx = await newCtx(390, 844);

const results = [];
async function check(name, path, fn, c = ctx) {
  const page = await c.newPage();
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

/** 在頁面裡計數：後端每個 action 的呼叫次數、送出的 rid、選單開了幾次；fail 裡的 action 第一次會失敗 */
const spy = (page, { fail = [], cancel = false } = {}) => page.evaluate(({ fail, cancel }) => {
  const S = window.__spy = { calls: {}, rids: {}, picker: 0 };
  const orig = window.demoApi, failing = new Set(fail);
  window.demoApi = async (action, d) => {
    S.calls[action] = (S.calls[action] || 0) + 1;
    (S.rids[action] = S.rids[action] || []).push(d && d.rid);
    if (failing.has(action)) { failing.delete(action); await new Promise(r => setTimeout(r, 200)); throw new Error('測試：模擬連線失敗'); }
    return orig(action, d);
  };
  liff.shareTargetPicker = () => { S.picker++; return new Promise(r => setTimeout(() => r(cancel ? undefined : { status: 'success' }), 300)); };
}, { fail, cancel });
const stats = page => page.evaluate(() => window.__spy);

/** 連按 5 次：直接呼叫 onclick（略過 disabled，測旗標本身），再加 5 次真的滑鼠點擊 */
async function hammer(page, sel) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: 'visible', timeout: 5000 });
  const box = await loc.boundingBox();
  await loc.evaluate(b => { for (let i = 0; i < 5; i++) b.onclick({ currentTarget: b, target: b }); });
  for (let i = 0; i < 5; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const settle = page => page.waitForTimeout(1500);
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const once = (s, action) => expect((s.calls[action] || 0) === 1, `${action} 呼叫 ${s.calls[action] || 0} 次`);

await check('儲存並送出：連按 5 次 → writeLetter、選單、markSent 各 1 次', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  await spy(page);
  await page.fill('#w-to', '林志豪');
  await page.fill('#w-text', '連點測試');
  await hammer(page, '#w-send');
  await page.locator('h2', { hasText: '信送出了' }).waitFor({ timeout: 5000 });
  await settle(page);
  const s = await stats(page);
  once(s, 'writeLetter'); once(s, 'markSent');
  expect(s.picker === 1, `選單開了 ${s.picker} 次`);
  expect(s.rids.writeLetter[0], 'writeLetter 沒有帶 rid');
});

await check('再傳給其他人（#s-again）：連按 5 次 → 選單、markSent 各 1 次', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  await page.fill('#w-to', '林志豪');
  await page.fill('#w-text', '連點測試');
  await page.locator('#w-send').click();
  await page.locator('#s-again').waitFor({ timeout: 5000 });
  await spy(page);
  await hammer(page, '#s-again');
  await settle(page);
  const s = await stats(page);
  once(s, 'markSent');
  expect(s.picker === 1, `選單開了 ${s.picker} 次`);
});

await check('取消選單後「選擇朋友或群組送出」、我的信「送出」：連按各只開 1 次', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  await spy(page, { cancel: true });
  await page.fill('#w-to', '林志豪');
  await page.fill('#w-text', '連點測試');
  await page.locator('#w-send').click();
  await page.locator('h2', { hasText: '還沒送出' }).waitFor({ timeout: 5000 });
  let s = await stats(page);
  expect(s.picker === 1 && !s.calls.markSent, '取消後不應記為已送出');
  await spy(page, { cancel: true });
  await hammer(page, '#s-again');
  await settle(page);
  s = await stats(page);
  expect(s.picker === 1, `#s-again 選單開了 ${s.picker} 次`);
  // 回寫信頁，下方「我在這個活動寫的信」有剛剛沒送出的那封
  await page.locator('#s-new').click();
  await page.locator('[data-resend]').first().waitFor({ timeout: 5000 });
  await spy(page);
  await hammer(page, '[data-resend]');
  await settle(page);
  s = await stats(page);
  expect(s.picker === 1, `[data-resend] 選單開了 ${s.picker} 次`);
  once(s, 'markSent');
});

await check('失敗後可以再按：第一次 writeLetter 失敗 → 按鈕恢復，再按成功，兩次用同一個 rid', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  await spy(page, { fail: ['writeLetter'] });
  await page.fill('#w-to', '林志豪');
  await page.fill('#w-text', '連點測試');
  await hammer(page, '#w-send');
  await page.waitForFunction(() => { const b = document.getElementById('w-send'); return b && !b.disabled; }, null, { timeout: 5000 });
  let s = await stats(page);
  once(s, 'writeLetter');
  expect(s.picker === 0, '失敗時不應開選單');
  await hammer(page, '#w-send');
  await page.locator('h2', { hasText: '信送出了' }).waitFor({ timeout: 5000 });
  await settle(page);
  s = await stats(page);
  expect(s.calls.writeLetter === 2, `writeLetter 共 ${s.calls.writeLetter} 次（應為 2：失敗 1＋重按 1）`);
  expect(s.rids.writeLetter[0] && s.rids.writeLetter[0] === s.rids.writeLetter[1], '重試沒有沿用同一個 rid');
  expect(s.picker === 1, `選單開了 ${s.picker} 次`);
});

await check('故意連寫兩封不同的信：各自一個 rid，都寫得進去', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  await spy(page);
  for (const to of ['林志豪', '王小明']) {
    await page.fill('#w-to', to);
    await page.fill('#w-text', '給' + to);
    await page.locator('#w-send').click();
    await page.locator('#s-new').waitFor({ timeout: 5000 });
    await page.locator('#s-new').click();
    await page.locator('#w-to').waitFor();
  }
  const s = await stats(page);
  expect(s.calls.writeLetter === 2, `writeLetter ${s.calls.writeLetter} 次`);
  expect(s.rids.writeLetter[0] !== s.rids.writeLetter[1], '兩封不同的信用了同一個 rid');
});

await check('建立活動並發到群組：連按 5 次 → createAct、選單各 1 次', '?demo&noguide', async page => {
  await page.locator('#h-new').click();
  await spy(page);
  await page.fill('#a-title', '連點測試活動');
  await hammer(page, '#a-save');
  await page.locator('#d-share').waitFor({ timeout: 5000 });
  await settle(page);
  const s = await stats(page);
  once(s, 'createAct');
  expect(s.picker === 1, `選單開了 ${s.picker} 次`);
});

await check('活動後台：發寫信入口、停止寫信、刪除活動 連按都只 1 次', '?demo&noguide', async page => {
  await page.locator('[data-act="A1"]').click();
  await page.locator('#d-share').waitFor({ timeout: 5000 });
  await spy(page);
  await hammer(page, '#d-share');
  await settle(page);
  let s = await stats(page);
  expect(s.picker === 1, `#d-share 選單開了 ${s.picker} 次`);
  await hammer(page, '#d-open');
  await settle(page);
  s = await stats(page);
  once(s, 'setOpen');
  await page.locator('#d-del').click();             // 第一次按：變成「確定刪除？」
  await hammer(page, '#d-del');
  await page.locator('h2', { hasText: '我的流通神聖的愛活動' }).waitFor({ timeout: 5000 });
  s = await stats(page);
  once(s, 'deleteAct');
});

await check('轉傳信封（?fwd）：連按 5 次只開 1 次選單', '?demo&fwd=L1&noguide', async page => {
  await page.locator('#f-go').waitFor();
  await spy(page);
  await hammer(page, '#f-go');
  await settle(page);
  const s = await stats(page);
  expect(s.picker === 1, `選單開了 ${s.picker} 次`);
  once(s, 'markSent');
});

await check('轉傳寫信入口（?share）：連按 5 次只開 1 次選單', '?demo&share=A1&noguide', async page => {
  await page.locator('#f-go').waitFor();
  await spy(page);
  await hammer(page, '#f-go');
  await settle(page);
  const s = await stats(page);
  expect(s.picker === 1, `選單開了 ${s.picker} 次`);
});

await check('綁定、收信：連按 5 次 bind、openLetter 各 1 次', '?demo=newbie&noguide', async page => {
  await page.locator('#l-open').waitFor();
  await spy(page);
  await hammer(page, '#l-open');
  await page.locator('#b-name').waitFor({ timeout: 5000 });
  let s = await stats(page);
  once(s, 'openLetter');
  await page.fill('#b-name', '陳怡君');
  await page.fill('#b-phone', '0912345678');
  await hammer(page, '#b-go');
  await settle(page);
  s = await stats(page);
  once(s, 'bind');
});

await check('刪除我的資料：連按 5 次 deleteMyData 1 次', '?demo=mydata&noguide', async page => {
  await page.locator('#m-del').waitFor();
  await spy(page);
  await page.locator('#m-del').click();
  await hammer(page, '#m-del');
  await settle(page);
  once(await stats(page), 'deleteMyData');
});

// 封蠟不蓋到「To. 名字」：寫信送出後的信封、收信頁還沒拆的信封，390 與 320 兩種寬度
for (const [w, h] of [[390, 844], [320, 694]]) {
  const c = await newCtx(w, h);
  const noOverlap = async page => {
    const r = await page.evaluate(() => {
      const box = el => el.getBoundingClientRect();
      const seal = box(document.querySelector('.env .seal')), to = box(document.querySelector('.env .to')), env = box(document.querySelector('.env'));
      return { gap: to.top - seal.bottom, inside: to.bottom <= env.bottom + 0.5 && seal.top >= env.top };
    });
    expect(r.gap > 0, `封蠟與 To. 重疊 ${(-r.gap).toFixed(1)}px`);
    expect(r.inside, '封蠟或收信人超出信封');
  };
  await check(`信封 ${w}px：寫信送出後封蠟不蓋 To.`, '?demo=write&noguide', async page => {
    await page.locator('#w-to').waitFor();
    await page.fill('#w-to', '林志豪');
    await page.fill('#w-text', '截圖用');
    await page.locator('#w-send').click();
    await page.locator('.env .to').waitFor({ timeout: 5000 });
    await page.waitForTimeout(3300);   // 等提示訊息消失再截圖
    await noOverlap(page);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `after5-env-${w}.png`) });
  }, c);
  await check(`信封 ${w}px：收信頁封蠟不蓋 To.`, '?demo=letter&noguide', async page => {
    await page.locator('#env').waitFor();
    await noOverlap(page);
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `after5-letter-env-${w}.png`) });
  }, c);
  await c.close();
}

await browser.close();
let fail = 0;
for (const [n, r] of results) { console.log(`${r === 'ok' ? '✓' : '✗'} ${n}${r === 'ok' ? '' : '：' + r}`); if (r !== 'ok') fail++; }
console.log(`${results.length - fail}/${results.length} 通過`);
process.exit(fail ? 1 : 0);
