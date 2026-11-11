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
  await expectText(page, '.guide .guide-credit', '背景音樂：英文詩歌（Hymns）曲調純音樂');
  await expectText(page, '.guide .guide-credit', '旋律皆為公有領域');
  const cred = await page.evaluate(() => {
    const el = document.querySelector('.guide .guide-credit');
    const a = el && el.querySelector('a');
    const guide = el && el.closest('.guide');
    const last = guide && [...guide.children].at(-1);
    const cs = el && getComputedStyle(el);
    return {
      href: a && a.getAttribute('href'),
      isLast: last === el,
      fontSize: cs && parseFloat(cs.fontSize),
      count: document.querySelectorAll('.guide-credit').length,
    };
  });
  if (cred.href !== 'https://creativecommons.org/publicdomain/zero/1.0/') throw new Error('署名連結不對：' + cred.href);
  if (!cred.isLast) throw new Error('署名應在使用說明最下方');
  if (!(cred.fontSize > 0 && cred.fontSize <= 13)) throw new Error('署名字級應為小字：' + cred.fontSize);
  if (cred.count !== 1) throw new Error('署名應只有一行：' + cred.count);
  await shot(page, 'home');
});

await check('home-noguide：活動卡與截止時間不被拆行', '?demo&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  if (await page.locator('.guide').count()) throw new Error('noguide 仍出現使用說明');
  const n = await page.locator('.card.act').count();
  if (n !== 11) throw new Error(`活動卡數量 ${n}`);
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
  await expectText(page, '.card.act .act-counts', '已有 2 人收到關心');
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
  if (await page.locator('.guide-credit').count()) throw new Error('未開使用說明時，頁面不該出現音樂署名');
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
  await expectText(page, '.act-counts', '已有 2 人收到關心');
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
  await expectText(page, '#m-mine', '查看我寫過的信');
  await expectText(page, '#m-write', '我要寫信');
  const pos = await page.evaluate(() => {
    const a = document.getElementById('m-mine').getBoundingClientRect();
    const b = document.getElementById('m-write').getBoundingClientRect();
    return { below: b.top >= a.bottom - 2, gold: document.getElementById('m-write').classList.contains('gold') };
  });
  if (!pos.below) throw new Error('「我要寫信」應在「查看我寫過的信」下面');
  if (!pos.gold) throw new Error('「我要寫信」應是金色主按鈕');
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
  for (const name of ['愛情', '牧養', '建造', '福音', '中秋', '端午', '除夕', '寒假', '暑假']) {
    if (await page.locator(`[data-paper]`, { hasText: name }).count() === 0) throw new Error('缺少信紙：' + name);
  }
  if (await page.locator(`[data-paper]`, { hasText: '聖誕' }).count()) throw new Error('聖誕場合應已從選單拿掉');
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
  await expectText(page, '.act-counts', '已有 2 人收到關心');
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
  await expectText(page, 'h2 + .act-counts', '已有 2 人收到關心');
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
  const tTitle = li.indexOf('✉️ 冬天的第一個問候'), tWrite = li.indexOf('已有 2 人寫信'), tLove = li.indexOf('已有 3 人收到關心'), tTo = li.indexOf('To.');
  if (tTitle < 0 || tWrite < 0 || tLove < 0) throw new Error('信件圖卡缺少標題或人數：' + li.join('|'));
  if (!(tTitle < tWrite && tWrite < tLove && tLove < tTo)) throw new Error('信件圖卡人數應在標題後、信封前：' + li.join('|'));
  if (texts.none.some(t => /收到關心|人寫信/.test(t))) throw new Error('人數為 0 時不該顯示：' + texts.none.join('|'));
  const aTitle = ai.indexOf('冬天的第一個問候'), aWrite = ai.indexOf('已有 4 人寫信'), aLove = ai.indexOf('已有 5 人收到關心'), aDesc = ai.indexOf('說明文字');
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
  if (logic.n !== logic.loved || logic.n !== 2) throw new Error('人數應與「已有 N 人收到關心」相同：' + JSON.stringify(logic));
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

await check('coadmin-creator：可新增共同管理者，畫面不出現 userId', '?demo&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  await page.locator('.card.act').first().click();
  await expectText(page, 'h2', '冬天的第一個問候');
  await expectText(page, '#d-coadmins', '共同管理者');
  await expectText(page, '#d-coadmins .nm', '王小明');
  await expectText(page, '#d-coadmins', '只有活動建立者可以新增或移除共同管理者，以及刪除活動');
  await expectText(page, '.co-cands', '簡晨光');
  await expectText(page, '#d-coadmins', '還沒打開信的收信人還不能新增');
  if (!(await page.locator('#d-del').count())) throw new Error('建立者應能刪除活動');
  const leak = await page.evaluate(() => {
    const box = document.getElementById('d-coadmins');
    const html = box ? box.innerHTML : '';
    const keys = [...box.querySelectorAll('[data-coadd], [data-corem]')].map(el => el.getAttribute('data-coadd') || el.getAttribute('data-corem') || '');
    return { html, keys, hasUid: /Udemo|U[0-9]|userId/i.test(html) };
  });
  if (leak.hasUid) throw new Error('共同管理者區塊不該出現 userId：' + leak.html.slice(0, 200));
  if (leak.keys.some(k => !k || /^U/i.test(k) || k.length < 8)) throw new Error('短鑰異常：' + JSON.stringify(leak.keys));
  await page.locator('#d-coadmins').scrollIntoViewIfNeeded();
  await shot(page, 'coadmin-creator');
  const key = await page.locator('[data-coadd]').filter({ hasText: '簡晨光' }).first().getAttribute('data-coadd');
  await page.locator('[data-coadd]').filter({ hasText: '簡晨光' }).first().click();
  await page.locator('[data-coadd].armed').first().click();
  await expectText(page, '.toast', '已新增共同管理者');
  await expectText(page, '#d-coadmins .nm', '簡晨光');
  if (await page.locator('[data-coadd]').filter({ hasText: '簡晨光' }).count()) throw new Error('新增後不該還在候選人');
  const again = await page.evaluate(async key => {
    const r1 = await demoApi('addCoAdmin', { actId: 'A1', key });
    const r2 = await demoApi('addCoAdmin', { actId: 'A1', key });
    return { added1: r1.added, added2: r2.added, n: r1.coAdmins.filter(c => c.name === '簡晨光').length, n2: r2.coAdmins.filter(c => c.name === '簡晨光').length };
  }, key);
  if (again.added1 !== false || again.added2 !== false || again.n !== 1 || again.n2 !== 1) throw new Error('重複新增應只保留一位：' + JSON.stringify(again));
});

await check('coadmin：共同管理者可看後台、看不到內容、不能新增他人', '?demo=coadmin&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  const home = await page.evaluate(() => ({
    n: document.querySelectorAll('.card.act').length,
    text: [...document.querySelectorAll('.card.act')].map(el => el.innerText).join('\n'),
  }));
  if (home.n !== 1) throw new Error('共同管理者只該看到自己管理的活動：' + home.n);
  if (!home.text.includes('共同管理') || !home.text.includes('陳怡君 建立')) throw new Error('首頁應標示共同管理：' + home.text);
  if (home.text.includes('畢業祝福信')) throw new Error('不該看到沒有權限的活動');
  await page.locator('.card.act').first().click();
  await expectText(page, 'h2', '冬天的第一個問候');
  await expectText(page, '#d-privacy', '信件內容使用者可見');
  await expectText(page, '#d-coadmins', '共同管理者');
  await expectText(page, '#d-coadmins .nm', '王小明');
  await expectText(page, '#d-coadmins', '只有活動建立者可以新增或移除共同管理者');
  if (await page.locator('[data-coadd], [data-corem]').count()) throw new Error('共同管理者不該有新增或移除按鈕');
  if (await page.locator('#d-del').count()) throw new Error('共同管理者不該能刪除活動');
  if (!(await page.locator('#d-edit').count()) || !(await page.locator('#d-open').count())) throw new Error('共同管理者應能編輯與停止寫信');
  if (!(await page.locator('#d-roster').count())) throw new Error('共同管理者應看得到收信人名單');
  await page.locator('[data-row]').filter({ hasText: '簡晨光' }).first().click();
  if (await page.locator('.paper.mini .text').count()) throw new Error('共同管理者不該看到信件內容');
  const api = await page.evaluate(async () => {
    const out = { errs: {} };
    try { await demoApi('addCoAdmin', { actId: 'A1', key: 'x' }); } catch (e) { out.errs.add = e.message; }
    try { await demoApi('removeCoAdmin', { actId: 'A1', key: 'x' }); } catch (e) { out.errs.rem = e.message; }
    try { await demoApi('deleteAct', { actId: 'A1' }); } catch (e) { out.errs.del = e.message; }
    const d = await demoApi('actDetail', { actId: 'A1' });
    out.detail = { full: d.full, canManage: d.canManageAdmins, canDelete: d.canDeleteAct, role: d.role, hasText: d.list.some(l => 'text' in l) };
    const old = { ...demo.me };
    demo.me = { userId: 'U99', displayName: '路人', name: '路人', isAdmin: false, isSuper: false };
    try { await demoApi('actDetail', { actId: 'A1' }); out.errs.stranger = ''; } catch (e) { out.errs.stranger = e.message; }
    try { await demoApi('addCoAdmin', { actId: 'A1', key: 'x' }); out.errs.strangerAdd = ''; } catch (e) { out.errs.strangerAdd = e.message; }
    demo.me = old;
    return out;
  });
  if (!api.errs.add || !api.errs.add.includes('只有活動建立者')) throw new Error('共同管理者應被拒新增：' + api.errs.add);
  if (!api.errs.rem || !api.errs.rem.includes('只有活動建立者')) throw new Error('共同管理者應被拒移除：' + api.errs.rem);
  if (!api.errs.del || !api.errs.del.includes('只有活動建立者')) throw new Error('共同管理者應被拒刪活動：' + api.errs.del);
  if (api.detail.full || api.detail.hasText || api.detail.canManage || api.detail.canDelete || api.detail.role !== 'coadmin') throw new Error('權限旗標不對：' + JSON.stringify(api.detail));
  if (!api.errs.stranger || !api.errs.stranger.includes('共同管理者')) throw new Error('路人應被拒絕看後台：' + api.errs.stranger);
  if (!api.errs.strangerAdd) throw new Error('路人應被拒絕新增共同管理者');
  await page.locator('#d-coadmins').scrollIntoViewIfNeeded();
  await shot(page, 'coadmin-member');
});

await check('activity-themes：首頁卡片有主題色與浮水印，我寫過的信保持原底', '?demo&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  const info = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.card.act')].map(el => ({
      theme: el.dataset.theme,
      title: el.querySelector('h3')?.textContent,
      tint: getComputedStyle(el).backgroundColor,
      mark: getComputedStyle(el).getPropertyValue('--theme-mark'),
      hasClass: el.classList.contains('theme-card'),
    }));
    const mine = document.getElementById('h-mine');
    const mineBg = mine && getComputedStyle(mine).backgroundColor;
    return { cards, mineBg, pageTheme: document.body.getAttribute('data-act-theme') };
  });
  const want = { 冬天的第一個問候: 'winter', 畢業祝福信: 'grad', 中秋的問候: 'midautumn', 感恩節的見證: 'thanks', 牧養關懷信: 'shepherd', 建造與配搭: 'build', 彼此相愛: 'love', 端午的問候: 'duanwu', 除夕團圓信: 'chuxi', 寒假的問候: 'winterbreak', 暑假的祝福: 'summer' };
  if (info.cards.length !== 11) throw new Error('應有 11 張活動卡：' + info.cards.length);
  if (info.pageTheme) throw new Error('首頁不該套整頁單一主題：' + info.pageTheme);
  for (const c of info.cards) {
    if (!c.hasClass || !c.theme) throw new Error('卡片缺主題：' + JSON.stringify(c));
    if (want[c.title] && c.theme !== want[c.title]) throw new Error(`${c.title} 應為 ${want[c.title]}，實際 ${c.theme}`);
    if (!c.mark.includes('img/themes/') || !c.mark.includes(c.theme + '.svg')) throw new Error('浮水印路徑不對：' + c.mark);
  }
  const tints = new Set(info.cards.map(c => c.tint));
  if (tints.size < 5) throw new Error('主題底色應有明顯差異：' + [...tints].join(' | '));
  const mineRgb = (info.mineBg.match(/\d+/g) || []).map(Number);
  if (!(mineRgb[0] > 230 && mineRgb[2] < mineRgb[0] - 8 && mineRgb[1] < mineRgb[0])) throw new Error('我寫過的信底色被改掉：' + info.mineBg);
  const firstTint = info.cards[0].tint;
  if (info.mineBg === firstTint) throw new Error('我寫過的信不該跟第一張活動卡同色');
  await shot(page, 'themes-home');
});

await check('activity-themes：寫信頁套上活動主題浮水印', '?demo=write&act=A3&noguide', async page => {
  await page.locator('h2', { hasText: '中秋的問候' }).waitFor();
  const theme = await page.evaluate(() => document.body.getAttribute('data-act-theme'));
  if (theme !== 'midautumn') throw new Error('寫信頁主題應為 midautumn：' + theme);
  const opacity = await page.evaluate(() => {
    const cs = getComputedStyle(document.body, '::before');
    return { op: cs.opacity, img: cs.backgroundImage };
  });
  const op = parseFloat(opacity.op);
  if (!(op >= 0.05 && op <= 0.12)) throw new Error('浮水印透明度應約 6–10%：' + opacity.op);
  if (!/midautumn\.svg/.test(opacity.img)) throw new Error('寫信頁浮水印不是中秋：' + opacity.img);
});

await check('mydata：有入口到我寫過的信', '?demo=mydata&noguide', async page => {
  await expectText(page, 'h2', '我的個人資料');
  await expectText(page, '#m-mine', '查看我寫過的信');
  await expectText(page, '.card', '寫過 3 封信');
});

await check('lock-note：寫信頁說明已改為大致相符', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  const note = await page.locator('.lock-note').innerText();
  if (!note.includes('大致相符') || !note.includes('收信') || note.includes('一樣，才拆得開'))
    throw new Error('寫信頁說明未更新：' + note);
});

await check('guide：使用說明有新規則與按鈕對比', '?demo=write&noguide', async page => {
  await page.locator('#w-to').waitFor();
  await page.evaluate(() => { try { localStorage.removeItem('loveletter.guide.writer'); } catch (e) {} });
  await page.locator('.foot .link', { hasText: '使用說明' }).click();
  await expectText(page, '.guide h3', '寫一封信');
  if (await page.locator('.guide-samples .btn.gold', { hasText: '儲存並送出' }).count() === 0)
    throw new Error('寫信說明應示範金色主按鈕');
  await page.locator('.guide [data-g=next]').click();
  await page.locator('.guide [data-g=next]').click();
  await expectText(page, '.guide h3', '名字大致相符就可以');
  const body = await page.locator('.guide p').first().innerText();
  if (!body.includes('大致相符') || !body.includes('稱謂') || !body.includes('小名'))
    throw new Error('使用說明姓名規則未更新：' + body);
  if (await page.locator('.guide-samples .btn.gold', { hasText: '收信' }).count() === 0)
    throw new Error('姓名頁應示範收信按鈕');
});

await check('guide：主辦說明有按鈕明暗對比', '?demo&noguide', async page => {
  await expectText(page, 'h2', '我的流通神聖的愛活動');
  await page.evaluate(() => { try { localStorage.removeItem('loveletter.guide.host'); } catch (e) {} });
  await page.locator('.foot .link', { hasText: '使用說明' }).click();
  await expectText(page, '.guide h3', '建立流通神聖的愛活動');
  if (await page.locator('.guide-samples .btn.gold', { hasText: '建立並發到群組' }).count() === 0)
    throw new Error('主辦說明應示範金色主按鈕');
  // skip to last page for danger / ghost chips
  for (let n = 0; n < 4; n++) await page.locator('.guide [data-g=next]').click();
  await expectText(page, '.guide h3', '管理活動');
  if (await page.locator('.guide-samples .btn.ghost', { hasText: '複製' }).count() === 0)
    throw new Error('管理頁應示範淺色次要按鈕');
  if (await page.locator('.guide-samples .btn.danger', { hasText: '刪除活動' }).count() === 0)
    throw new Error('管理頁應示範危險按鈕');
  const cred = await page.locator('.guide .guide-credit').count();
  if (cred !== 1) throw new Error('署名應仍在使用說明最下方');
});

await check('mydata：我要寫信會回到進行中的活動', '?demo=write&act=A8&noguide', async page => {
  await page.locator('h2', { hasText: '端午的問候' }).waitFor();
  await page.goto(new URL('?demo=mydata&noguide', BASE).href, { waitUntil: 'load' });
  await page.locator('#m-write').click();
  await page.locator('h2', { hasText: '端午的問候' }).waitFor({ timeout: 8000 });
});

await check('mydata：沒有進行中活動時我要寫信回到首頁', '?demo=mydata&noguide', async page => {
  await page.evaluate(() => { try { sessionStorage.removeItem('loveletter.lastAct'); } catch (e) {} });
  await page.reload({ waitUntil: 'load' });
  await expectText(page, 'h2', '我的個人資料');
  await page.locator('#m-write').click();
  await expectText(page, 'h2', '我的流通神聖的愛活動');
});

await browser.close();
for (const [n, r] of results) console.log(`${r === 'ok' ? '✓' : '✗'} ${n}${r === 'ok' ? '' : '：' + r}`);
const failed = results.filter(r => r[1] !== 'ok').length;
console.log(`${results.length - failed}/${results.length} 通過`);
process.exit(failed ? 1 : 0);
