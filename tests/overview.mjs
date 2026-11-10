// 總管理者登記總覽：後端權限、不洩漏 userId／通行證；預覽頁畫面（不連真實後端）
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gs = readFileSync(join(root, 'Code.gs'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
let fail = 0;
function check(label, ok) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) fail++;
}

check('Code.gs 有 listOverview，且需 isSuperAdmin',
  /function listOverview\(user\)/.test(gs)
  && /function requireSuper\(user\)/.test(gs)
  && /只有網站總管理者可以看登記總覽/.test(gs)
  && /case 'overview':/.test(gs));
check('總覽不讀取登入工作表、不回傳 userId 或 token',
  /function listOverview\(user\)([\s\S]*?)\n\}/.exec(gs)
  && !/SESSION_SHEET|sessionSheet|createSession|userFromSession/.test(/function listOverview\(user\)([\s\S]*?)\n\}/.exec(gs)[1])
  && !/rec\.userId|people\.userId|uid:/.test(/function listOverview\(user\)([\s\S]*?)\n\}/.exec(gs)[1]));
check('回傳欄位只有姓名手機 LINE 名稱次數與可選時間',
  /name: String\(r\[0\]/.test(gs) && /phone: String\(r\[1\]/.test(gs)
  && /lineName: String\(r\[3\]/.test(gs) && /written:/.test(gs) && /received:/.test(gs));
check('前端總覽入口只給 isSuper，失敗時顯示後端尚未更新',
  /ME && ME\.isSuper/.test(html)
  && /id="h-overview"/.test(html)
  && /後端尚未更新/.test(html)
  && /function overviewFlow/.test(html));
check('預覽 API 非總管理者會被拒，且回傳資料去掉 uid',
  /if \(!demo\.me\.isSuper\) throw new Error\('只有網站總管理者可以看登記總覽'\)/.test(html)
  && /function demoOverview/.test(html)
  && /const \{ uid, \.\.\.pub \} = p/.test(html));
check('sw 快取有版本號', /loveletter-v\d+/.test(sw));

if (fail) {
  console.log(`${6 - fail} 項靜態檢查，失敗 ${fail}`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:18765/';
const CHROME = process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'zh-TW' });
await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());

async function open(path) {
  const page = await ctx.newPage();
  await page.goto(new URL(path, BASE).href, { waitUntil: 'load' });
  return page;
}

{
  const page = await open('?demo&noguide');
  await page.locator('h2', { hasText: '我的流通神聖的愛活動' }).waitFor();
  check('一般主辦人首頁沒有登記總覽按鈕', await page.locator('#h-overview').count() === 0);
  const err = await page.evaluate(async () => {
    try { await demoApi('overview', {}); return ''; }
    catch (e) { return e.message; }
  });
  check('一般主辦人呼叫 overview 被拒', err.includes('只有網站總管理者'));
  await page.close();
}

{
  const page = await open('?demo=coadmin&noguide');
  await page.locator('h2').first().waitFor();
  check('共同管理者首頁沒有登記總覽按鈕', await page.locator('#h-overview').count() === 0);
  await page.close();
}

{
  const page = await open('?demo=admin&noguide');
  await page.locator('#h-overview', { hasText: '登記總覽' }).waitFor();
  await page.locator('#h-overview').click();
  await page.locator('h2, .overview-sum', { hasText: '登記總覽' }).waitFor();
  const info = await page.evaluate(() => {
    const body = document.body.innerText;
    const html = document.getElementById('ov-list')?.innerHTML || '';
    const rows = [...document.querySelectorAll('#ov-list .row')].map(el => ({
      name: el.querySelector('.nm')?.textContent.trim(),
      meta: el.querySelector('.meta')?.textContent.trim(),
      st: el.querySelector('.st')?.textContent.trim(),
    }));
    return { total: document.getElementById('ov-total')?.textContent.trim(), body, html, rows, hasCopy: !!document.getElementById('ov-copy'), hasShot: !!document.getElementById('ov-shot') };
  });
  check('總覽顯示共 5 人', info.total === '共 5 人已登記' && info.rows.length === 5);
  check('總覽列出姓名、手機、LINE 名稱與封數',
    info.rows.some(r => r.name === '陳怡君' && r.meta.includes('0912345678') && r.meta.includes('預覽使用者') && r.st.includes('寫過 3 封') && r.st.includes('收過 1 封'))
    && info.rows.some(r => r.name === '李美玲' && r.st.includes('寫過 0 封') && r.st.includes('收過 1 封'))
    && info.rows.some(r => r.name === '王小明')
    && info.rows.some(r => r.name === '林志豪')
    && info.rows.some(r => r.name === '簡晨光'));
  check('總覽畫面不含 userId 或 token',
    !/Udemo|U[0-9]/.test(info.html) && !/token|session/i.test(info.html)
    && !info.rows.some(r => /U[0-9a-z]{2,}/i.test((r.name || '') + (r.meta || ''))));
  check('總覽有複製與截圖', info.hasCopy && info.hasShot);
  const api = await page.evaluate(async () => {
    const r = await demoApi('overview', {});
    const leak = JSON.stringify(r).includes('uid') || JSON.stringify(r).includes('userId') || JSON.stringify(r).includes('token');
    return { total: r.total, n: (r.people || []).length, leak, keys: r.people && r.people[0] ? Object.keys(r.people[0]).sort().join(',') : '' };
  });
  check('overview API 只回傳公開欄位、共 5 人', api.total === 5 && api.n === 5 && !api.leak
    && api.keys.split(',').every(k => ['lineName', 'name', 'phone', 'received', 'time', 'written'].includes(k)));
  await page.close();
}

await browser.close();
console.log(`${12 - fail} 項檢查，失敗 ${fail}`);
process.exit(fail ? 1 : 0);
