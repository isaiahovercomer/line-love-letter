// 主題背景音樂：檔案規格、循環與署名位置（不連後端）
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const audioReadme = readFileSync(join(root, 'audio/README.md'), 'utf8');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const themes = ['rose', 'sky', 'kraft', 'mint', 'winter', 'midautumn', 'duanwu', 'chuxi', 'winterbreak', 'summer', 'xmas', 'newyear', 'thanks', 'grad', 'birthday', 'gospel', 'love', 'shepherd', 'build', 'farewell', 'distance', 'reunion', 'missing'];
let fail = 0;
function check(label, ok) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) fail++;
}

const files = readdirSync(join(root, 'audio')).filter(f => f.endsWith('.mp3'));
check('23 首主題音檔齊全（含舊版聖誕）', themes.every(t => files.includes(t + '.mp3')) && files.length === 23);
let total = 0, sizeOk = true;
for (const t of themes) {
  const n = statSync(join(root, 'audio', t + '.mp3')).size;
  total += n;
  if (n < 250000 || n > 500000) { sizeOk = false; console.log('  size', t, n); }
}
check('每首 250–500 KB（一節長度不同）', sizeOk);
console.log('  音檔合計', total, 'bytes');

check('播放為循環且音量 0.35、點選才載入',
  /a\.loop = true/.test(html) && /a\.volume = 0\.35/.test(html)
  && /延遲載入：點了才建立/.test(html)
  && /a\.src = 'audio\/' \+ encodeURIComponent\(k\) \+ '\.mp3'/.test(html));
check('音檔不進 service worker 預先快取', !/audio\//.test(sw.split('ASSETS')[1]?.split(']')[0] || 'audio/'));
check('sw 快取有版本號', /loveletter-v\d+/.test(sw));
check('使用說明最下方有一行小字署名（詩歌曲調、CC0 連結）',
  /class="guide-credit"/.test(html)
  && /背景音樂：英文詩歌（Hymns）曲調純音樂與生日歌/.test(html)
  && /https:\/\/creativecommons.org\/publicdomain\/zero\/1.0\//.test(html)
  && !/Kevin MacLeod/.test(html));
check('README 與 audio 說明不再寫「原創合成 CC0」',
  !/原創合成/.test(readme + audioReadme)
  && !/14 首短循環皆為本專案原創/.test(audioReadme)
  && /It Is Well with My Soul/.test(readme)
  && /英文詩歌第 313 首/.test(readme)
  && /Happy Birthday to You/.test(readme)
  && /CC0/.test(readme)
  && !/Kevin MacLeod/.test(readme + audioReadme));
check('完整曲目只寫在 README',
  !/All the Way My Savior/.test(html) && /All the Way My Savior/.test(readme));

console.log(`${7 - fail} 項檢查，失敗 ${fail}；合計 ${total} bytes`);
process.exit(fail ? 1 : 0);
