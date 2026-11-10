// 活動主題：推論規則、SVG 大小、場合白名單（含新增場合與舊版聖誕）
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const gs = readFileSync(join(root, 'Code.gs'), 'utf8');
const themes = ['rose','sky','kraft','mint','winter','midautumn','duanwu','chuxi','winterbreak','summer','xmas','newyear','thanks','grad','birthday','gospel','love','shepherd','build'];
let fail = 0;
function check(label, ok) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) fail++;
}

check('有 themeOf 與標題關鍵字推論（無聖誕關鍵字）',
  /function themeOf\(act\)/.test(html)
  && /\['中秋','midautumn'\]/.test(html) && /端午/.test(html) && /除夕/.test(html)
  && /寒假/.test(html) && /暑假/.test(html) && /感恩/.test(html) && /畢業/.test(html)
  && !/\['聖誕','xmas'\]/.test(html)
  && /function applyActTheme/.test(html));
check('紙張欄位優先於標題',
  /if \(act && THEME_DECO\[act\.paper\]\) return act\.paper;/.test(html));

let total = 0, missing = [];
for (const t of themes) {
  const fp = join(root, 'img/themes', t + '.svg');
  try { total += statSync(fp).size; }
  catch { missing.push(t); }
}
check('19 組主題 SVG 齊全（含舊版聖誕）', missing.length === 0);
check('新 SVG 合計不超過 60 KB', total <= 60 * 1024);
console.log('  SVG 合計', total, 'bytes');
check('sw 快取 v14 且含主題 SVG',
  /loveletter-v14/.test(sw) && themes.every(t => sw.includes(`./img/themes/${t}.svg`)));
check('Code.gs 白名單含新場合且保留舊版 xmas',
  /midautumn/.test(gs) && /duanwu/.test(gs) && /chuxi/.test(gs)
  && /winterbreak/.test(gs) && /summer/.test(gs) && /xmas/.test(gs)
  && !/THEME_DECO|themeOf|img\/themes/.test(gs));
check('活動卡與後台標題有花邊／浮水印 class',
  /theme-card/.test(html) && /theme-hero/.test(html) && /has-act-theme/.test(html));
check('示範資料含新場合活動，不再用聖誕示範',
  /中秋的問候/.test(html) && /端午的問候/.test(html) && /除夕團圓信/.test(html)
  && /寒假的問候/.test(html) && /暑假的祝福/.test(html)
  && /感恩節的見證/.test(html) && /牧養關懷信/.test(html)
  && !/聖誕的問候/.test(html));

console.log(`${8 - fail} 項檢查，失敗 ${fail}；SVG ${total} bytes`);
process.exit(fail ? 1 : 0);
