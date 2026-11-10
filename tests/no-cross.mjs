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

// 掃描 SVG：抓出直線段，若兩段在中點附近以約 90° 相交、長度又接近，就視為十字／加號（六角雪花是 60°，不會誤判）。
function segsFromSvg(text) {
  const segs = [];
  const lines = [...text.matchAll(/<line\b[^>]*>/g)];
  for (const m of lines) {
    const tag = m[0];
    const num = n => Number((tag.match(new RegExp(n + '="([^"]+)"')) || [])[1]);
    const x1 = num('x1'), y1 = num('y1'), x2 = num('x2'), y2 = num('y2');
    if ([x1, y1, x2, y2].every(Number.isFinite)) segs.push({ x1, y1, x2, y2 });
  }
  const toCmds = (d) => {
    const out = [];
    let cx = 0, cy = 0, sx = 0, sy = 0;
    const re = /([MmLlHhVvZz])([^MmLlHhVvZz]*)/g;
    let m;
    while ((m = re.exec(d))) {
      const cmd = m[1], raw = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
      const rel = cmd === cmd.toLowerCase();
      if (cmd === 'M' || cmd === 'm') {
        for (let i = 0; i + 1 < raw.length; i += 2) {
          const x = rel ? cx + raw[i] : raw[i], y = rel ? cy + raw[i + 1] : raw[i + 1];
          if (i === 0) { sx = x; sy = y; } else out.push({ x1: cx, y1: cy, x2: x, y2: y });
          cx = x; cy = y;
        }
      } else if (cmd === 'L' || cmd === 'l') {
        for (let i = 0; i + 1 < raw.length; i += 2) {
          const x = rel ? cx + raw[i] : raw[i], y = rel ? cy + raw[i + 1] : raw[i + 1];
          out.push({ x1: cx, y1: cy, x2: x, y2: y });
          cx = x; cy = y;
        }
      } else if (cmd === 'H' || cmd === 'h') {
        for (const v of raw) {
          const x = rel ? cx + v : v;
          out.push({ x1: cx, y1: cy, x2: x, y2: cy });
          cx = x;
        }
      } else if (cmd === 'V' || cmd === 'v') {
        for (const v of raw) {
          const y = rel ? cy + v : v;
          out.push({ x1: cx, y1: cy, x2: cx, y2: y });
          cy = y;
        }
      } else if (cmd === 'Z' || cmd === 'z') {
        if (cx !== sx || cy !== sy) out.push({ x1: cx, y1: cy, x2: sx, y2: sy });
        cx = sx; cy = sy;
      }
    }
    return out;
  };
  for (const m of text.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) segs.push(...toCmds(m[1]));
  return segs;
}
function mid(s) { return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 }; }
function len(s) { return Math.hypot(s.x2 - s.x1, s.y2 - s.y1); }
function ang(s) { return Math.atan2(s.y2 - s.y1, s.x2 - s.x1); }
function almost(a, b, e) { return Math.abs(a - b) <= e; }

const svgHits = [];
function walkSvg(dir) {
  for (const name of readdirSync(dir)) {
    const fp = join(dir, name);
    const st = statSync(fp);
    if (st.isDirectory()) {
      if (!SKIP_DIR.has(name)) walkSvg(fp);
    } else if (extname(name) === '.svg') {
      const text = readFileSync(fp, 'utf8');
      // IN CHRIST 金印除外；這裡只檢查新建的主題裝飾
      if (!fp.includes(`${join('img', 'themes')}`) && !fp.includes('img/themes')) continue;
      if (/chi-?rho|☧/i.test(text)) svgHits.push(fp.replace(ROOT, '') + ': 含 Chi-Rho');
      const segs = segsFromSvg(text).filter(s => len(s) >= 6);
      for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
          const a = segs[i], b = segs[j];
          const la = len(a), lb = len(b);
          if (Math.min(la, lb) / Math.max(la, lb) < 0.62) continue;
          const ma = mid(a), mb = mid(b);
          if (Math.hypot(ma.x - mb.x, ma.y - mb.y) > Math.min(la, lb) * 0.18) continue;
          let d = Math.abs(ang(a) - ang(b)) % Math.PI;
          if (d > Math.PI / 2) d = Math.PI - d;
          const deg = d * 180 / Math.PI;
          if (deg >= 80 && deg <= 100) {
            svgHits.push(`${fp.replace(ROOT, '')}: 兩段直線以 ${deg.toFixed(0)}° 在中點附近相交，像十字／加號`);
          }
        }
      }
    }
  }
}
walkSvg(ROOT);
if (svgHits.length) {
  console.error('✗ SVG 中有十字／加號形狀：');
  svgHits.forEach(h => console.error('  ' + h));
  process.exit(1);
}
console.log('✓ SVG 沒有十字／加號形的直線相交');
