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

await check('theme-groups：節日／場合換行並與日常對齊；愛情牧養建造都在', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  if (await page.locator('.music-hint', { hasText: '點選主題，會配上相應的背景音樂' }).count() === 0)
    throw new Error('沒有主題音樂說明');
  for (const name of ['愛情', '牧養', '建造', '福音']) {
    if (await page.locator(`[data-paper]`, { hasText: name }).count() === 0) throw new Error('缺少信紙：' + name);
  }
  const gospelSym = await page.locator('[data-paper=gospel] i').textContent();
  if (new RegExp('[' + ['\\u271D','\\u271E','\\u271F','\\u2020','\\u2626','\\u2671','\\u26EA','\\u2629','\\u2719','\\u{1F547}'].join('') + ']', 'u').test(gospelSym || '')) throw new Error('福音仍用十字架符號：' + gospelSym);
  const rows = await page.locator('.papers .pg-row').count();
  if (rows !== 2) throw new Error('信紙分組列數 ' + rows);
  const [daily, fest] = await page.locator('.papers .pg-row .pg').evaluateAll(els => els.map(el => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), x: Math.round(r.left), y: Math.round(r.top) };
  }));
  if (daily.text !== '日常' || fest.text !== '節日／場合') throw new Error('分組標籤不對：' + daily.text + ' / ' + fest.text);
  if (fest.y <= daily.y + 8) throw new Error('節日／場合沒有換到下一行');
  if (Math.abs(fest.x - daily.x) > 2) throw new Error(`節日／場合未與日常左對齊（${fest.x} vs ${daily.x}）`);
  await shot(page, 'theme-groups-390');
});

await check('verse-picks：21 條都在頁面內、可換行', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  const n = await page.locator('#v-picks [data-v]').count();
  if (n !== 21) throw new Error('備選經文 ' + n + ' 條');
  const info = await page.evaluate(() => {
    const box = document.getElementById('v-picks');
    const br = box.getBoundingClientRect();
    const cs = getComputedStyle(box);
    const buttons = [...box.querySelectorAll('[data-v]')].map(b => b.getBoundingClientRect());
    const clipped = buttons.filter(r => r.right > br.right + 2 || r.left < br.left - 2 || r.bottom > br.bottom + 2 || r.top < br.top - 2);
    const ys = [...new Set(buttons.map(r => Math.round(r.top / 4) * 4))];
    return { overflowX: cs.overflowX, clipped: clipped.length, rows: ys.length, boxW: br.width };
  });
  if (info.overflowX === 'auto' || info.overflowX === 'scroll') throw new Error('經文選單仍左右滑動：' + info.overflowX);
  if (info.clipped) throw new Error('有 ' + info.clipped + ' 條經文被裁切');
  if (info.rows < 2) throw new Error('經文沒有換行，只有 ' + info.rows + ' 列');
  await page.locator('#v-picks').scrollIntoViewIfNeeded();
  await shot(page, 'verse-picks-390');
});

await check('privacy：活動建立人看不到信件內容', '?demo&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  await page.locator('.card.act').first().click();
  await expectText(page, '#d-privacy', '信件內容使用者可見');
  await page.locator('[data-row]').first().click();
  if (await page.locator('.paper.mini .text').count()) throw new Error('建立人不該看到信件內容');
  await shot(page, 'privacy-host');
});

await check('privacy-admin：總管理者看得到信件內容', '?demo=admin&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  await page.locator('.card.act').first().click();
  if (await page.locator('#d-privacy').count()) throw new Error('總管理者不該看到鎖定說明');
  await page.locator('[data-row]').first().click();
  await expectText(page, '.paper.mini .text', '願主祝福你的新工作');
});

await check('music：點選主題才載入，音量輕柔', '?demo=write&noguide', async page => {
  await page.addInitScript(() => {}); // 無效：頁已載入。改在下面覆寫。
  await page.locator('#w-to').waitFor();
  const before = await page.evaluate(() => {
    const store = [];
    window.__audio = store;
    window.Audio = class {
      constructor() { this.paused = true; this.volume = 1; this.loop = false; this.src = ''; store.push(this); }
      play() { this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
      load() {}
      removeAttribute() { this.src = ''; }
    };
    return store.length;
  });
  if (before !== 0) throw new Error('還沒點主題就建立了 Audio');
  await expectText(page, '.music-hint', '點選主題，會配上相應的背景音樂');
  await page.locator('[data-paper=love]').click();
  const after = await page.evaluate(() => window.__audio.map(a => ({ src: a.src, vol: a.volume, loop: a.loop, paused: a.paused })));
  if (after.length !== 1) throw new Error('應只載入一首，實際 ' + after.length);
  if (!/love\.mp3$/.test(after[0].src)) throw new Error('音檔不是 love.mp3：' + after[0].src);
  if (Math.abs(after[0].vol - 0.35) > 0.001) throw new Error('音量不是 0.35：' + after[0].vol);
  if (!after[0].loop || after[0].paused) throw new Error('應循環並播放');
  await page.locator('[data-paper=shepherd]').click();
  const sw = await page.evaluate(() => window.__audio.map(a => ({ src: a.src, paused: a.paused })));
  const playing = sw.filter(a => !a.paused);
  if (playing.length !== 1 || !/shepherd\.mp3$/.test(playing[0].src)) throw new Error('換主題後應只播牧養：' + JSON.stringify(sw));
  await page.locator('#w-music-toggle').click();
  const stopped = await page.evaluate(() => window.__audio.every(a => a.paused));
  if (!stopped) throw new Error('按停止後仍在播放');
  await shot(page, 'theme-music');
});

await check('listen-hint：收信頁有打開聲音提示、不自動播放', '?demo=letter&noguide', async page => {
  await page.evaluate(() => {
    window.__audio = [];
    window.Audio = class {
      constructor() { this.paused = true; this.volume = 1; this.loop = false; this.src = ''; window.__audio.push(this); }
      play() { this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
      load() {}
      removeAttribute() { this.src = ''; }
    };
  });
  await expectText(page, '#l-music', '打開聲音聆聽');
  if (await page.evaluate(() => (window.__audio || []).length)) throw new Error('收信頁不該自動載入音樂');
  await page.locator('#l-music').click();
  const a = await page.evaluate(() => (window.__audio || []).map(x => ({ src: x.src, vol: x.volume, paused: x.paused })));
  if (a.length !== 1 || a[0].paused || Math.abs(a[0].vol - 0.35) > 0.001) throw new Error('按了仍沒正確播放：' + JSON.stringify(a));
});

await check('loved-flex：圖卡文案與人數', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  const texts = await page.evaluate(() => {
    const letter = letterFlex({ to: '林志豪', paper: 'love', actTitle: '冬天的第一個問候', id: 'L9', loved: 3 });
    const none = letterFlex({ to: '林志豪', paper: 'love', actTitle: 'x', id: 'L9', loved: 0 });
    const act = actFlex({ title: '冬天的第一個問候', paper: 'winter', id: 'A1', loved: 2, desc: '', deadline: '' });
    const walk = (node, acc = []) => {
      if (!node) return acc;
      if (Array.isArray(node)) { node.forEach(n => walk(n, acc)); return acc; }
      if (typeof node === 'object') {
        if (typeof node.text === 'string') acc.push(node.text);
        Object.values(node).forEach(v => walk(v, acc));
      }
      return acc;
    };
    return { letter: walk(letter), none: walk(none), act: walk(act) };
  });
  if (!texts.letter.some(t => t === '已有 3 個人收到愛')) throw new Error('信件圖卡沒有正確人數：' + texts.letter.join('|'));
  if (texts.none.some(t => /收到愛/.test(t))) throw new Error('人數為 0 時不該顯示：' + texts.none.join('|'));
  if (!texts.act.some(t => t === '已有 2 個人收到愛')) throw new Error('活動圖卡沒有正確人數：' + texts.act.join('|'));
  if (texts.letter.some(t => /收到信/.test(t))) throw new Error('圖卡仍用舊文案');
});

await browser.close();
for (const [n, r] of results) console.log(`${r === 'ok' ? '✓' : '✗'} ${n}${r === 'ok' ? '' : '：' + r}`);
const failed = results.filter(r => r[1] !== 'ok').length;
console.log(`${results.length - failed}/${results.length} 通過`);
process.exit(failed ? 1 : 0);
