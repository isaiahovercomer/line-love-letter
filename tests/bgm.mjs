// 主題背景音樂：檔案規格、循環與署名位置（不連後端）
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const audioReadme = readFileSync(join(root, 'audio/README.md'), 'utf8');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const themes = ['rose', 'sky', 'kraft', 'mint', 'winter', 'xmas', 'newyear', 'thanks', 'grad', 'birthday', 'gospel', 'love', 'shepherd', 'build'];
let fail = 0;
function check(label, ok) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) fail++;
}

const files = readdirSync(join(root, 'audio')).filter(f => f.endsWith('.mp3'));
check('14 首主題音檔齊全', themes.every(t => files.includes(t + '.mp3')) && files.length === 14);
let total = 0, sizeOk = true;
for (const t of themes) {
  const n = statSync(join(root, 'audio', t + '.mp3')).size;
  total += n;
  if (n < 350000 || n > 450000) { sizeOk = false; console.log('  size', t, n); }
}
check('每首約 399 KB（350–450 KB）', sizeOk);
console.log('  音檔合計', total, 'bytes');

check('播放為循環且音量 0.35、點選才載入',
  /a\.loop = true/.test(html) && /a\.volume = 0\.35/.test(html)
  && /延遲載入：點了才建立/.test(html)
  && /a\.src = 'audio\/' \+ encodeURIComponent\(k\) \+ '\.mp3'/.test(html));
check('音檔不進 service worker 預先快取', !/audio\//.test(sw.split('ASSETS')[1]?.split(']')[0] || 'audio/'));
check('sw 快取有版本號', /loveletter-v\d+/.test(sw));
check('使用說明最下方有一行小字署名與 CC BY 4.0 連結',
  /class="guide-credit"/.test(html)
  && /背景音樂：Kevin MacLeod \(incompetech.com\)/.test(html)
  && /https:\/\/creativecommons.org\/licenses\/by\/4.0\//.test(html)
  && /生日曲為公有領域/.test(html));
check('README 與 audio 說明不再寫「原創合成 CC0」',
  !/原創合成/.test(readme + audioReadme)
  && !/14 首短循環皆為本專案原創/.test(audioReadme)
  && /Gymnopedie No\. 1/.test(readme)
  && /Fresh Air/.test(readme)
  && /Happy Birthday to You/.test(readme)
  && /CC BY 4.0/.test(readme));
check('完整曲目只寫在 README',
  !/Gymnopedie No\. 1/.test(html) && /Gymnopedie No\. 1/.test(readme));

console.log(`${7 - fail} 項檢查，失敗 ${fail}；合計 ${total} bytes`);
process.exit(fail ? 1 : 0);
