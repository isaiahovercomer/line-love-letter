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
  const layout = await page.evaluate(() => {
    const mine = document.getElementById('h-mine');
    const acts = [...document.querySelectorAll('.card.act')];
    const foot = document.querySelector('.foot');
    const after = Node.DOCUMENT_POSITION_FOLLOWING;
    const bg = getComputedStyle(mine).backgroundColor;
    const rgb = (bg.match(/\d+/g) || []).map(Number);
    return {
      afterActs: acts.length && acts.every(a => (a.compareDocumentPosition(mine) & after)),
      beforeFoot: !!(foot && (mine.compareDocumentPosition(foot) & after)),
      footMine: [...document.querySelectorAll('.foot .link')].some(el => el.textContent.includes('我寫過的信')),
      bg, r: rgb[0], g: rgb[1], b: rgb[2],
    };
  });
  if (!layout.afterActs) throw new Error('我寫過的信應在活動卡下面');
  if (!layout.beforeFoot) throw new Error('我寫過的信應在頁尾上面');
  if (layout.footMine) throw new Error('首頁已有卡片，頁尾不該再有「我寫過的信」連結');
  // 淡玫瑰底，需明顯不是白卡（255,255,255），且偏紅
  if (!(layout.r > 230 && layout.b < layout.r - 8 && layout.g < layout.r)) throw new Error('底色不是淡玫瑰：' + layout.bg);
  const first = page.locator('.card.act').first();
  await expectText(page, '.card.act .act-counts', '已有 2 人寫信');
  await expectText(page, '.card.act .act-counts', '已有 2 個人收到愛');
  const titleY = await first.locator('h3').evaluate(el => el.getBoundingClientRect().bottom);
  const badgeY = await first.locator('.act-counts').evaluate(el => el.getBoundingClientRect().top);
  if (badgeY < titleY - 2) throw new Error('人數標籤應在活動標題下方／旁邊');
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
  await expectText(page, '.act-counts', '已有 2 人寫信');
  await expectText(page, '.act-counts', '已有 2 個人收到愛');
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
  await expectText(page, 'h2', '冬天的第一個問候');
  await expectText(page, '.act-counts', '已有 2 人寫信');
  await expectText(page, '.act-counts', '已有 2 個人收到愛');
  await expectText(page, '#d-privacy', '信件內容使用者可見');
  await page.locator('[data-row]').first().click();
  if (await page.locator('.paper.mini .text').count()) throw new Error('建立人不該看到信件內容');
  await shot(page, 'privacy-host');
});

await check('privacy-admin：總管理者看得到信件內容', '?demo=admin&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  await page.locator('.card.act').first().click();
  if (await page.locator('#d-privacy').count()) throw new Error('總管理者不該看到鎖定說明');
  await page.locator('[data-row]').filter({ hasText: '簡晨光' }).first().click();
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
  await expectText(page, 'h2', '冬天的第一個問候');
  await expectText(page, 'h2 + .act-counts', '已有 2 人寫信');
  await expectText(page, 'h2 + .act-counts', '已有 2 個人收到愛');
  if (await page.locator('.foot .link', { hasText: '我寫過的信' }).count() === 0) throw new Error('寫信頁沒有卡片，頁尾應保留「我寫過的信」');
  const texts = await page.evaluate(() => {
    const letter = letterFlex({ to: '林志豪', paper: 'love', actTitle: '冬天的第一個問候', id: 'L9', loved: 3, writers: 2 });
    const none = letterFlex({ to: '林志豪', paper: 'love', actTitle: 'x', id: 'L9', loved: 0, writers: 0 });
    const act = actFlex({ title: '冬天的第一個問候', paper: 'winter', id: 'A1', loved: 5, writers: 4, desc: '說明文字', deadline: '' });
    const walk = (node, acc = []) => {
      if (!node) return acc;
      if (Array.isArray(node)) { node.forEach(n => walk(n, acc)); return acc; }
      if (typeof node === 'object') {
        if (typeof node.text === 'string') acc.push(node.text);
        Object.values(node).forEach(v => walk(v, acc));
      }
      return acc;
    };
    const checkFlex = (msg, label) => {
      if (!msg || msg.type !== 'flex' || !msg.contents || msg.contents.type !== 'bubble') throw new Error(label + ' 不是 bubble');
      if ((msg.altText || '').length > 400) throw new Error(label + ' altText 超過 400');
      let maxDepth = 0, boxes = 0;
      const deep = (node, d) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(n => deep(n, d)); return; }
        if (node.type === 'box') { boxes++; if (d > maxDepth) maxDepth = d; if (d > 12) throw new Error(label + ' 巢狀過深'); }
        if (node.type === 'text' && String(node.text).length > 2000) throw new Error(label + ' 文字過長');
        if (node.contents) deep(node.contents, d + (node.type === 'box' ? 1 : 0));
      };
      deep(msg.contents, 0);
      return { maxDepth, boxes };
    };
    return { letter: walk(letter), none: walk(none), act: walk(act), flex: { letter: checkFlex(letter, '信件圖卡'), act: checkFlex(act, '活動圖卡') } };
  });
  const li = texts.letter, ai = texts.act;
  const tTitle = li.indexOf('✉️ 冬天的第一個問候'), tWrite = li.indexOf('已有 2 人寫信'), tLove = li.indexOf('已有 3 個人收到愛'), tTo = li.indexOf('To.');
  if (tTitle < 0 || tWrite < 0 || tLove < 0) throw new Error('信件圖卡缺少標題或人數：' + li.join('|'));
  if (!(tTitle < tWrite && tWrite < tLove && tLove < tTo)) throw new Error('信件圖卡人數應在標題後、信封前：' + li.join('|'));
  if (texts.none.some(t => /收到愛|人寫信/.test(t))) throw new Error('人數為 0 時不該顯示：' + texts.none.join('|'));
  const aTitle = ai.indexOf('冬天的第一個問候'), aWrite = ai.indexOf('已有 4 人寫信'), aLove = ai.indexOf('已有 5 個人收到愛'), aDesc = ai.indexOf('說明文字');
  if (!(aTitle < aWrite && aWrite < aLove && aLove < aDesc)) throw new Error('活動圖卡人數應緊跟標題、在說明前：' + ai.join('|'));
  if (li.some(t => /收到信/.test(t))) throw new Error('圖卡仍用舊文案');
});

await check('my-letters：跨活動列出自己寫過的信', '?demo=mine&noguide', async page => {
  await expectText(page, 'h2', '我寫過的信');
  await expectText(page, '#ml-sum', '你已寫信給 3 位');
  const rows = page.locator('#ml-list [data-ml]');
  if (await rows.count() !== 3) throw new Error('應有 3 封自己的信，實際 ' + await rows.count());
  const body = await page.locator('#ml-list').innerText();
  if (!body.includes('林志豪') || !body.includes('王小明') || !body.includes('李美玲')) throw new Error('缺少收信人：' + body);
  if (!body.includes('冬天的第一個問候') || !body.includes('畢業祝福信')) throw new Error('缺少活動名稱：' + body);
  if (!body.includes('未送出') || !body.includes('已送出') || !body.includes('對方已收信')) throw new Error('三種狀態不齊：' + body);
  if (body.includes('謝謝你這一年') || body.includes('願主祝福你的新工作') || body.includes('畢業快樂！')) throw new Error('列表不該出現別人的信件內容');
  const ids = await rows.evaluateAll(els => els.map(e => e.getAttribute('data-ml')));
  if (ids.some(id => !['L2', 'L5', 'L6'].includes(id))) throw new Error('出現別人的信：' + ids.join(','));
  // 最新在前：L5 (11/11) 、L2 (11/10) 、L6 (6/1)
  if (ids[0] !== 'L5' || ids[1] !== 'L2' || ids[2] !== 'L6') throw new Error('未依寫信時間新到舊：' + ids.join(','));
  await shot(page, 'my-letters');
  await rows.filter({ hasText: '李美玲' }).click();
  await expectText(page, '#ml-status', '這是你寫的信');
  await expectText(page, '#ml-status', '對方已收信');
  await expectText(page, '.paper .text', '美玲，畢業快樂');
  await expectText(page, '.paper .actname', '畢業祝福信');
  if (await page.locator('.paper .text', { hasText: '謝謝你這一年' }).count()) throw new Error('不該看到別人的信');
  await page.waitForTimeout(800); // 等信紙淡入再截圖
  await shot(page, 'my-letter-opened');
});

await check('my-letters：可從首頁與我的資料進入', '?demo&noguide', async page => {
  await expectText(page, '#h-mine', '我寫過的信');
  await page.locator('#h-mine-sum').filter({ hasText: '你已寫信給 3 位' }).waitFor({ timeout: 5000 });
  await page.locator('#h-mine').click();
  await expectText(page, 'h2', '我寫過的信');
});

await check('roster：活動後台收信人名單可複製與截圖', '?demo&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  await page.locator('.card.act').first().click();
  await expectText(page, '#d-roster h3', '收信人名單（2 人）');
  const text = await page.locator('#d-roster').innerText();
  if (!text.includes('陳怡君') || !text.includes('林志豪')) throw new Error('名單缺人：' + text);
  if (text.includes('王小明')) throw new Error('未送出的不該列入：' + text);
  if (!text.includes('已收信') || !text.includes('已送出未收')) throw new Error('狀態不齊：' + text);
  if (text.includes('謝謝你這一年') || text.includes('悄悄話') || text.includes('志豪弟兄')) throw new Error('名單不該有信件內容：' + text);
  const logic = await page.evaluate(() => {
    const roster = rosterOf(DETAIL.list);
    const loved = demoLoved('A1');
    return { n: roster.length, loved, names: roster.map(g => g.name), opened: roster.filter(g => g.opened > 0).length, text: rosterText(DETAIL.act, roster) };
  });
  if (logic.n !== logic.loved || logic.n !== 2) throw new Error('人數應與「已有 N 個人收到愛」相同：' + JSON.stringify(logic));
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
  await page.locator('#d-copy').click();
  await expectText(page, '.toast', '已複製收信人名單');
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (clip) {
    if (!clip.includes('冬天的第一個問候') || !clip.includes('陳怡君') || !clip.includes('林志豪')) throw new Error('複製內容不完整：' + clip);
    if (clip.includes('謝謝你這一年') || clip.includes('志豪弟兄')) throw new Error('複製內容含信件正文：' + clip);
  }
  await page.locator('#d-roster').scrollIntoViewIfNeeded();
  await shot(page, 'roster');
  const download = page.waitForEvent('download', { timeout: 8000 });
  await page.locator('#d-shot').click();
  const dl = await download;
  if (!/\.png$/i.test(dl.suggestedFilename() || '')) throw new Error('截圖檔名不是 PNG：' + dl.suggestedFilename());
  const path = SHOTS ? join(SHOTS, 'after-roster-shot.png') : undefined;
  if (path) await dl.saveAs(path);
});

await check('mydata：有入口到我寫過的信', '?demo=mydata&noguide', async page => {
  await expectText(page, 'h2', '我的個人資料');
  await expectText(page, '#m-mine', '查看我寫過的信');
  await expectText(page, '.card', '寫過 3 封信');
});

await browser.close();
for (const [n, r] of results) console.log(`${r === 'ok' ? '✓' : '✗'} ${n}${r === 'ok' ? '' : '：' + r}`);
const failed = results.filter(r => r[1] !== 'ok').length;
console.log(`${results.length - failed}/${results.length} 通過`);
process.exit(failed ? 1 : 0);
