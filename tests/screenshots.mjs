import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:18680/';
const SHOTS = process.env.SHOTS_DIR || '/workspace/line-love-letter/_shots';
const CHROME = process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });

async function shotPage({ name, path, width = 390, height = 844, fullPage = true, after }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: 'zh-TW' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, r => r.abort());
  const page = await ctx.newPage();
  await page.goto(new URL(path, BASE).href, { waitUntil: 'load' });
  if (after) await after(page);
  await page.screenshot({ path: join(SHOTS, name), fullPage });
  await ctx.close();
  console.log('saved', name);
}

await shotPage({ name: 'after-palette-home.png', path: '?demo&noguide' });

await shotPage({ name: 'after-guide-host.png', path: '?demo', fullPage: false });
await shotPage({ name: 'after-guide-writer.png', path: '?demo=write', fullPage: false });

await shotPage({ name: 'after-theme-groups-390.png', path: '?demo=write&noguide', after: async page => {
  await page.locator('.papers').waitFor();
}});
await shotPage({ name: 'after-theme-groups-320.png', path: '?demo=write&noguide', width: 320, height: 694, after: async page => {
  await page.locator('.papers').waitFor();
  const [daily, fest] = await page.locator('.papers .pg-row .pg').evaluateAll(els => els.map(el => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent.trim(), x: Math.round(r.left), y: Math.round(r.top) };
  }));
  if (fest.y <= daily.y + 8) throw new Error('320：節日／場合沒換行');
  if (Math.abs(fest.x - daily.x) > 2) throw new Error(`320：未對齊 ${fest.x} vs ${daily.x}`);
}});

await shotPage({ name: 'after-verse-picks-390.png', path: '?demo=write&noguide', after: async page => {
  await page.locator('#v-picks').waitFor();
  await page.locator('#v-picks').scrollIntoViewIfNeeded();
}});
await shotPage({ name: 'after-verse-picks-320.png', path: '?demo=write&noguide', width: 320, height: 694, after: async page => {
  await page.locator('#v-picks').waitFor();
  const info = await page.evaluate(() => {
    const box = document.getElementById('v-picks');
    const br = box.getBoundingClientRect();
    const buttons = [...box.querySelectorAll('[data-v]')].map(b => b.getBoundingClientRect());
    const clipped = buttons.filter(r => r.right > br.right + 2 || r.left < br.left - 2 || r.bottom > br.bottom + 2);
    return { n: buttons.length, clipped: clipped.length };
  });
  if (info.n !== 21 || info.clipped) throw new Error('320 經文裁切或數量不對：' + JSON.stringify(info));
  await page.locator('#v-picks').scrollIntoViewIfNeeded();
}});

await shotPage({ name: 'after-love-theme.png', path: '?demo=write&noguide', after: async page => {
  await page.locator('[data-paper=love]').click();
  await page.locator('#paper').waitFor();
}});
await shotPage({ name: 'after-theme-music.png', path: '?demo=write&noguide', after: async page => {
  await page.locator('.music-hint').waitFor();
  await page.locator('[data-paper=shepherd]').click();
}});
await shotPage({ name: 'after-no-cross-header.png', path: '?demo&noguide', fullPage: false });
await shotPage({ name: 'after-no-cross-gospel.png', path: '?demo=write&noguide', after: async page => {
  await page.locator('[data-paper=gospel]').click();
  await page.locator('#w-stamp').waitFor();
}});
await shotPage({ name: 'after-privacy-host.png', path: '?demo&noguide', after: async page => {
  await page.locator('.card.act').first().click();
  await page.locator('#d-privacy').waitFor();
}});

await shotPage({ name: 'after-received-count.png', path: '?demo=write&noguide', after: async page => {
  await page.locator('#w-to').waitFor();
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.id = 'loved-preview';
    box.style.cssText = 'margin:16px 0;padding:18px;border-radius:14px;background:#FDF6F6;border:1px solid #F0D8DC;font-family:sans-serif;';
    box.innerHTML = `<div style="font-size:12px;color:#8E3E4C;font-weight:700">✉️ 冬天的第一個問候</div>
      <div style="margin-top:10px;background:#F3D7DC;border-radius:10px;padding:16px 16px 18px;text-align:center">
        <div style="width:44px;height:44px;border-radius:22px;background:#8E3E4C;color:#fff;line-height:44px;margin:0 auto;font-size:20px">❀</div>
        <div style="margin-top:12px;font-size:12px">To.</div>
        <div style="font-size:24px;font-weight:700">林志豪</div>
        <div style="font-size:11px;margin-top:4px">只有本人拆得開</div>
      </div>
      <div style="margin-top:12px;background:#F0D8DC;border-radius:999px;padding:8px;text-align:center;color:#8E3E4C;font-weight:700;font-size:13px">已有 3 人收到關心</div>`;
    document.querySelector('.papers').before(box);
    box.scrollIntoView({ block: 'start' });
  });
}});

await browser.close();
console.log('screenshots done');
