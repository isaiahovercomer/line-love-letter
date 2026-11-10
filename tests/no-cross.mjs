// 禁止十字架表情、符號出現在前端可見文字、SVG、說明與圖示中。
// 不檢查 crossorigin、CSS 類名 photo-x、關閉按鈕的「×」。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const BANNED = new RegExp('[' + [
  '\u271D', '\u271E', '\u271F', '\u2020', '\u2626', '\u2671',
  '\u26EA', '\u2629', '\u2719', '\u{1F547}', '\u2628', '\u26E8',
  '\u271B', '\u271C', '\u2720', '\u271A'
].join('') + ']', 'u');
const SKIP_DIR = new Set(['.git', 'node_modules', '_shots', 'audio']);
const EXT = new Set(['.html', '.js', '.mjs', '.css', '.svg', '.webmanifest', '.md', '.gs', '.json']);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (EXT.has(extname(name)) || name === 'README') acc.push(p);
  }
  return acc;
}

const hits = [];
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\n/);
  lines.forEach((line, i) => {
    if (BANNED.test(line)) hits.push(`${file.replace(ROOT, '')}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
}
if (hits.length) {
  console.error('✗ 找到十字架符號：');
  hits.forEach(h => console.error('  ' + h));
  process.exit(1);
}
console.log('✓ 沒有十字架符號（已掃 ' + walk(ROOT).length + ' 個檔案）');
