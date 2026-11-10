// 「已有 XX 個人收到愛」：已送出信件的不重複收信人（含正要送出的這一封）
function normName(v) { return String(v || '').replace(/[\s　]+/g, '').toLowerCase(); }
function actCounts(letters, actId, extraTo, extraFrom) {
  const names = new Set(), writers = new Set();
  for (const l of letters) {
    if (String(l.act) !== String(actId) || !l.sent) continue;
    const n = normName(l.to); if (n) names.add(n);
    if (l.from) writers.add(l.from);
  }
  if (extraTo != null && extraTo !== '') { const n = normName(extraTo); if (n) names.add(n); }
  if (extraFrom) writers.add(extraFrom);
  return { loved: names.size, writers: writers.size };
}
function lovedCount(letters, actId, extraTo) { return actCounts(letters, actId, extraTo).loved; }

const letters = [
  { act: 'A1', to: '陳怡君', sent: true, from: 'U1' },
  { act: 'A1', to: '陳 怡君', sent: true, from: 'U1' },   // 同一人、同一寄件人
  { act: 'A1', to: '林志豪', sent: false, from: 'U4' },  // 未送出不算
  { act: 'A2', to: '王小明', sent: true, from: 'U9' },   // 別的活動
  { act: 'A1', to: '王小明', sent: true, from: 'U2' },
];

const cases = [
  ['兩位已送出（陳怡君去空白後重複）', lovedCount(letters, 'A1'), 2],
  ['加上正要送出的新收信人', lovedCount(letters, 'A1', '周美玲'), 3],
  ['正要送出的人已算過', lovedCount(letters, 'A1', '陳怡君'), 2],
  ['沒有已送出且沒有 extra', lovedCount(letters, 'A9'), 0],
  ['沒有已送出但有 extra', lovedCount(letters, 'A9', '新人'), 1],
  ['別的活動', lovedCount(letters, 'A2'), 1],
  ['寫信人數：兩位已送出寄件人', actCounts(letters, 'A1').writers, 2],
  ['寫信人數：加上正要送出的新寄件人', actCounts(letters, 'A1', '', 'U5').writers, 3],
  ['寫信人數：正要送出的人已算過', actCounts(letters, 'A1', '', 'U1').writers, 2],
  ['寫信人數：未送出的寄件人不算（仍是 2，不是 3）', actCounts(letters, 'A1').writers, 2],
  ['寫信人數：沒有已送出但有 extraFrom', actCounts(letters, 'A9', '', 'U8').writers, 1],
];

let fail = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  console.log(`${ok ? '✓' : '✗'} ${name}：得到 ${got}，應為 ${want}`);
  if (!ok) fail++;
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const gs = readFileSync(join(root, 'Code.gs'), 'utf8');
for (const [label, src, re] of [
  ['前端 lovedLine 文案', html, /已有 \$\{?\+?loved\} 個人收到愛/],
  ['前端人寫信文案', html, /已有 \$\{?\+?writers\} 人寫信/],
  ['前端不再用「人收到信」', html, /已有 \$\{[^}]+\} 人收到信/],
  ['後端 lovedCount', gs, /function lovedCount/],
  ['後端 lovedCount 回傳 writers', gs, /writers: Object\.keys\(writers\)\.length/],
  ['後端 writeLetter 回傳 loved 與 writers', gs, /loved: s\.loved, writers: s\.writers/],
  ['後端 clearLoved 仍會清快取', gs, /function clearLoved/],
]) {
  const hit = re.test(src);
  const invert = label.includes('不再用');
  const ok = invert ? !hit : hit;
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) fail++;
}

// 隱私：非 full 不可附內容；actDetail 只在 isSuperAdmin 時 full
function hostLetterView(l, o, full) {
  const v = { id: String(l[0]), from: String(l[2]), to: String(l[4]), paper: String(l[7] || 'rose'),
    time: 't', sent: !!l[9], openedAt: o ? 't' : '', openedBy: o ? String(o) : '' };
  if (full) Object.assign(v, { text: String(l[5]), image: String(l[6] || ''), vref: String(l[10] || ''), vtext: String(l[11] || '') });
  return v;
}
const row = ['L1','A1','王小明','U1','陳怡君','悄悄話','https://x','rose','t', true, '約 3:16', '神愛世人'];
const hidden = hostLetterView(row, null, false);
const shown = hostLetterView(row, null, true);
const privOk = !('text' in hidden) && !('image' in hidden) && !('vref' in hidden) && !('vtext' in hidden)
  && shown.text === '悄悄話' && shown.vref === '約 3:16';
console.log(`${privOk ? '✓' : '✗'} hostLetterView 只有 full 才附內容`);
if (!privOk) fail++;
const srcOk = /actDetail\(req\.actId, isSuperAdmin\(user\.userId\)\)/.test(gs)
  && /if \(full\) Object\.assign\(v, \{ text:/.test(gs);
console.log(`${srcOk ? '✓' : '✗'} actDetail 僅總管理者拿得到內容`);
if (!srcOk) fail++;

console.log(`${cases.length + 7 + 2 - fail} 項檢查，失敗 ${fail}`);
process.exit(fail ? 1 : 0);
