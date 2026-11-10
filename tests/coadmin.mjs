// 共同管理者：檢查後端原始碼的權限與工作表（不連真實試算表）
import { readFileSync } from 'node:fs';
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

check('工作表與欄位在 SH / HEADERS / CA',
  /COADMINS: '共同管理者'/.test(gs)
  && /'共同管理者': \['活動代碼', 'LINE userId', '名稱', '加入時間', '加入者 userId'\]/.test(gs)
  && /const CA = \{ ACT: 0, UID: 1, NAME: 2, TIME: 3, ADDED_BY: 4 \}/.test(gs));
check('ensureCoAdminSheet 會懶建立工作表', /function ensureCoAdminSheet/.test(gs) && /insertSheet\(SH\.COADMINS\)/.test(gs));
check('coRows 在工作表不存在時回傳空陣列（不必先跑 setup）',
  /function coRows\(/.test(gs) && /if \(!sh\) return \[\]/.test(gs));
check('ONCE_ACTIONS 含 addCoAdmin / removeCoAdmin',
  /'addCoAdmin', 'removeCoAdmin'/.test(gs) || /'addCoAdmin'/.test(gs) && /'removeCoAdmin'/.test(gs));
check('requireOwner 承認共同管理者',
  /if \(isCoAdmin\(user\.userId, actId\)\) return;/.test(gs)
  && /只有活動建立者或共同管理者可以看這個活動的後台/.test(gs));
check('新增／移除／刪活動走 requireCreator',
  /function requireCreator/.test(gs)
  && /case 'deleteAct':\s*requireCreator\(user, req\.actId\)/.test(gs)
  && /addCoAdmin\(user, req\.actId, req\.key\)/.test(gs)
  && /removeCoAdmin\(user, req\.actId, req\.key\)/.test(gs));
check('actDetail 只有總管理者拿到信件內容',
  /const full = isSuperAdmin\(user\.userId\)/.test(gs)
  && /canManageAdmins/.test(gs)
  && /listCoAdminCandidates/.test(gs));
check('listActs 含共同管理的活動',
  /coadmin: !mine && !!co\[String\(r\[AC\.ID\]\)\]/.test(gs));
check('前端畫面不輸出 userId 欄位',
  /function coAdminHtml/.test(html)
  && /data-coadd/.test(html)
  && ! /data-uid/.test(html)
  && /還沒打開信的收信人還不能新增/.test(html));
check('預覽模式 ?demo=coadmin',
  /DEMO_MODE === 'coadmin'/.test(html) && /function demoRequireCreator/.test(html));
check('sw 快取有版本號', /loveletter-v\d+/.test(sw));

console.log(`${8 + 3 - fail} 項檢查，失敗 ${fail}`);
process.exit(fail ? 1 : 0);
