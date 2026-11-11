/**
 * LINE 流通神聖的愛圖卡建立平台 — Google Apps Script 後端
 * 貼到 Google 試算表的「擴充功能 → Apps Script」。第一次（或更新欄位後）執行一次 setup()，再部署成網頁應用程式
 * （執行身分：我；存取權：所有人）。共同管理者工作表若還沒有，第一次新增時會自動建立，不必為此再執行 setup()。
 */

const CONFIG = {
  CHANNEL_ID: '2012412693',          // LINE Login channel ID（與活動登記平台同一個）
  IMAGE_FOLDER: 'LINE 流通神聖的愛圖卡照片', // 信裡附的照片存在雲端硬碟這個資料夾
};

const SH = { ROSTER: '名單', ACTS: '流通神聖的愛活動', LETTERS: '信件', OPENS: '收信紀錄', PUBLISHERS: '發布者', VERSES: '經文', COADMINS: '共同管理者' };

const HEADERS = {
  '名單': ['姓名', '手機', 'LINE userId', 'LINE名稱'],
  '流通神聖的愛活動': ['活動代碼', '活動名稱', '說明', '開放寫信', '建立者', '建立時間', '截止時間', '預設信紙', '封面圖片', '按鈕文字'],
  '信件': ['信件代碼', '活動代碼', '寄件人姓名', '寄件人 userId', '收信人姓名', '悄悄話', '照片網址', '信紙', '寫信時間', '已送出', '經文出處', '經文內容'],
  '收信紀錄': ['時間', '信件代碼', '活動代碼', '收信人姓名', 'LINE名稱', 'LINE userId'],
  '發布者': ['LINE userId', '名稱', '備註'],
  '經文': ['出處', '經文（恢復本）', '分類'],
  '共同管理者': ['活動代碼', 'LINE userId', '名稱', '加入時間', '加入者 userId'],
};


// 欄位位置（從 0 開始）
const AC = { ID: 0, TITLE: 1, DESC: 2, OPEN: 3, CREATOR: 4, CREATED: 5, DEADLINE: 6, PAPER: 7, IMAGE: 8, BUTTON: 9 };
const LT = { ID: 0, ACT: 1, FROM: 2, FROM_UID: 3, TO: 4, TEXT: 5, IMAGE: 6, PAPER: 7, TIME: 8, SENT: 9, VREF: 10, VTEXT: 11 };
const OP = { TIME: 0, LETTER: 1, ACT: 2, NAME: 3, LINE_NAME: 4, UID: 5 };
const CA = { ACT: 0, UID: 1, NAME: 2, TIME: 3, ADDED_BY: 4 };
const PAPERS = ['rose', 'sky', 'kraft', 'mint', 'winter', 'midautumn', 'duanwu', 'chuxi', 'winterbreak', 'summer', 'xmas', 'newyear', 'thanks', 'grad', 'birthday', 'gospel', 'love', 'shepherd', 'build'];

function setup() {
  const ss = SpreadsheetApp.getActive();
  const old = ss.getSheetByName('傳' + '情活動');  // 舊名稱的工作表改成新名稱，資料保留
  if (old && !ss.getSheetByName(SH.ACTS)) old.setName(SH.ACTS);
  Object.keys(HEADERS).forEach(name => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const h = HEADERS[name];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  ss.getSheetByName(SH.ROSTER).getRange('B:B').setNumberFormat('@');  // 手機保留開頭的 0
  ss.getSheetByName(SH.ACTS).getRange('G:G').setNumberFormat('@');    // 截止時間存成文字
  const def = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  imageFolder();
  verseSheet();
}

function doGet() { return json({ ok: true, msg: '流通神聖的愛圖卡系統運作中' }); }

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'act') {                       // 公開：活動標題與說明（寫信頁、入口卡）
      const a = getAct(req.actId);
      out = { ok: true, act: a ? publicAct(a) : null };
    } else if (req.action === 'verses') {             // 公開：寫信頁的備選經文
      out = { ok: true, verses: listVerses() };
    } else if (req.action === 'letterCard') {         // 公開：信封資訊（不含內容）
      out = { ok: true, card: letterCard(req.letterId) };
    } else {
      const user = req.session && req.action !== 'session' ? userFromSession(req.session) : verifyIdToken(req.idToken);
      out = ONCE_ACTIONS.includes(req.action) ? once(user, req, () => run(user, req)) : run(user, req);
    }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return json(out);
}

/** 需要登入的動作 */
function run(user, req) {
  let out;
  const own = () => requireOwner(user, req.actId);
  switch (req.action) {
    case 'session':      out = { ok: true, ...createSession(user) }; break;
    case 'logout':       deleteSession(req.session); out = { ok: true }; break;
    case 'home':         out = { ok: true, me: meOf(user), acts: listActs(user) }; break;
    case 'writeBoot': {   // 寫信頁一次拿齊：活動、我是誰、備選經文、我寫過的信
      const a = getAct(req.actId);
      out = { ok: true, act: a ? publicAct(a) : null, me: meOf(user), verses: listVerses(), letters: a ? myLetters(user, a.id) : [] };
      break;
    }
    case 'me':           out = { ok: true, ...meOf(user) }; break;
    case 'bind':         out = { ok: true, ...bind(user, req.name, req.phone) }; break;
    case 'uploadImage':  out = { ok: true, url: uploadImage(user, req.data, req.mime) }; break;
    case 'writeLetter':  out = { ok: true, letter: writeLetter(user, req.actId, req.letter || {}) }; break;
    case 'markSent':     out = { ok: true, ...markSent(user, req.letterId) }; break;
    case 'updateLetter': out = { ok: true, letter: updateLetter(user, req.letterId, req.letter || {}) }; break;
    case 'deleteLetter': out = { ok: true, ...deleteLetter(user, req.letterId) }; break;
    case 'myLetters':    out = { ok: true, letters: myLetters(user, req.actId) }; break;
    case 'openLetter':   out = { ok: true, ...openLetter(user, req.letterId) }; break;
    case 'createAct':    out = { ok: true, act: createAct(user, req.act || {}) }; break;
    case 'listActs':     out = { ok: true, acts: listActs(user) }; break;
    case 'updateAct':    own(); out = { ok: true, act: updateAct(req.actId, req.act || {}) }; break;
    case 'actDetail':    own(); out = { ok: true, ...actDetail(req.actId, user) }; break;
    case 'setOpen':      own(); out = { ok: true, act: setOpen(req.actId, !!req.open) }; break;
    case 'deleteAct':    requireCreator(user, req.actId); out = { ok: true, ...deleteAct(req.actId) }; break;
    case 'addCoAdmin':    out = { ok: true, ...addCoAdmin(user, req.actId, req.key) }; break;
    case 'removeCoAdmin': out = { ok: true, ...removeCoAdmin(user, req.actId, req.key) }; break;
    case 'myData':       out = { ok: true, ...myData(user) }; break;
    case 'deleteMyData': out = { ok: true, ...deleteMyData(user) }; break;
    case 'overview':     out = { ok: true, ...listOverview(user) }; break;
    default: throw new Error('未知的動作');
  }
  return out;
}

/* ---------- 防重複送出：同一個人、同一個動作、同一個請求編號（rid），10 分鐘內只做一次 ---------- */
// 前端每次按下按鈕產生一個 rid，連點或失敗重試都帶同一個；故意再寫一封新的信會是新的 rid，不受影響
const ONCE_ACTIONS = ['bind', 'uploadImage', 'writeLetter', 'markSent', 'updateLetter', 'deleteLetter', 'createAct', 'updateAct', 'setOpen', 'deleteAct', 'deleteMyData', 'addCoAdmin', 'removeCoAdmin'];
const ONCE_PENDING = '__pending__';
function once(user, req, fn) {
  const rid = String(req.rid || '');
  if (!/^[\w-]{8,64}$/.test(rid)) return fn();          // 舊版前端沒有 rid：照舊執行
  const cache = CacheService.getScriptCache(), key = 'rid:' + user.userId + ':' + req.action + ':' + rid;
  let hit = withLock(() => { const v = cache.get(key); if (!v) cache.put(key, ONCE_PENDING, 120); return v; });
  for (let i = 0; hit === ONCE_PENDING && i < 40; i++) { Utilities.sleep(500); hit = cache.get(key); }   // 同一個請求正在處理：等它的結果
  if (hit === ONCE_PENDING) throw new Error('上一次的送出還在處理中，請稍候再試');
  if (hit) return JSON.parse(hit);
  try {
    const out = fn();
    try { cache.put(key, JSON.stringify(out), 600); } catch (e) { cache.remove(key); }
    return out;
  } catch (err) {
    cache.remove(key);                                    // 失敗不記：重試時會真的再做一次
    throw err;
  }
}

function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- 平台通行證：登入一次，60 天內不用再登入 ---------- */
const SESSION_SHEET = '登入';
const SESSION_DAYS = 60;

function sessionSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SESSION_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SESSION_SHEET);
    sh.appendRow(['通行證', 'LINE userId', 'LINE名稱', '到期', '建立']);
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}

function createSession(user) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const now = new Date(), exp = new Date(now.getTime() + SESSION_DAYS * 864e5);
  withLock(() => {
    const sh = sessionSheet(), data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) if (data[i][3] instanceof Date && data[i][3] < now) sh.deleteRow(i + 1);
    sh.appendRow(safeRow([token, user.userId, user.displayName, exp, now]));
  });
  return { token, expires: exp.getTime() };
}

function userFromSession(token) {
  const data = sessionSheet().getDataRange().getValues(), now = new Date();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token && data[i][3] instanceof Date && data[i][3] > now) return { userId: String(data[i][1]), displayName: String(data[i][2]) };
  }
  throw new Error('SESSION_EXPIRED');
}

function deleteSession(token) {
  if (!token) return;
  withLock(() => {
    const sh = sessionSheet(), data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) if (data[i][0] === token) sh.deleteRow(i + 1);
  });
}

function verifyIdToken(idToken) {
  if (!idToken) throw new Error('缺少登入資訊，請在 LINE 中重新開啟');
  const res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post', payload: { id_token: idToken, client_id: CONFIG.CHANNEL_ID }, muteHttpExceptions: true,
  });
  const d = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) {
    const m = d.error_description || '驗證失敗';
    throw new Error(/expired/i.test(m) ? 'TOKEN_EXPIRED' : 'LINE 身分驗證失敗：' + m);
  }
  return { userId: d.sub, displayName: d.name || '' };
}

/* ---------- 工具 ---------- */
function sheet(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function rows(name) { const v = sheet(name).getDataRange().getValues(); v.shift(); return v; }
function tz() { return Session.getScriptTimeZone(); }
function fmt(d, p) { return d instanceof Date ? Utilities.formatDate(d, tz(), p || 'yyyy/M/d HH:mm') : String(d || ''); }
function normPhone(v) { return String(v || '').replace(/\D/g, '').slice(-9); }
/** 比對姓名：去掉所有空白、英文不分大小寫 */
function normName(v) { return String(v || '').replace(/[\s　]+/g, '').toLowerCase(); }
// 收信人姓名「大致相符」即可拆信：去掉稱謂（弟兄、姊妹、師母、阿姨…）與小、阿等暱稱字頭後，
// 一方包含另一方、或至少有一個相同的字（中文）／相同的英文單字，就算相關；只有完全不相干才擋下。
const NAME_TITLES = ['弟兄','姊妹','姐妹','妹妹','弟弟','哥哥','姊姊','姐姐','師母','師丈','老師','牧者','長老','執事','同工','阿姨','叔叔','伯伯','伯母','嬸嬸','奶奶','爺爺','阿嬤','阿公','外婆','外公','媽媽','爸爸','小姐','先生','太太','女士','同學','學長','學姊','學姐','學弟','學妹','寶貝','親愛的','兄','姊','姐','哥','弟','妹','嫂','媽','爸','伯','叔','姨'];
function nameCore(v) {
  let s = normName(v).replace(/[()（）【】\[\]「」『』.,，。、~～!！?？:：;；'"’‘“”·•\-_]+/g, '');
  for (const t of NAME_TITLES) s = s.split(t).join('');
  return s.replace(/^(小|阿|老)(?=.)/, '');
}
function namesRelated(a, b) {
  const x = nameCore(a), y = nameCore(b);
  if (!x || !y) return normName(a) !== '' && normName(a) === normName(b);
  if (x.includes(y) || y.includes(x)) return true;
  const cjk = s => s.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || [];
  const set = new Set(cjk(x));
  if (cjk(y).some(c => set.has(c))) return true;
  const words = s => s.match(/[a-z0-9]{2,}/g) || [];
  const ws = new Set(words(x));
  return words(y).some(w => ws.has(w) || [...ws].some(v => v.startsWith(w) || w.startsWith(v)));
}
function isTrue(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function newId(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function clip(v, n) { return String(v || '').trim().slice(0, n); }
/** 寫進試算表的文字：開頭是 = + - @（或 Tab、換行）會被當成公式，前面加 ' 讓它保持純文字（讀回來時試算表會自動去掉這個 '） */
function safe(v) { return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
function safeRow(r) { return r.map(safe); }
function parseTime(s) { return s ? Utilities.parseDate(String(s), tz(), 'yyyy-MM-dd HH:mm') : null; }
function cleanTime(v) { const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(v || '')); return m ? m[1] + ' ' + m[2] : ''; }
function deleteRows(name, test) {
  const sh = sheet(name), data = sh.getDataRange().getValues();
  let n = 0;
  for (let i = data.length - 1; i >= 1; i--) if (test(data[i])) { sh.deleteRow(i + 1); n++; }
  return n;
}

/* ---------- 名單：姓名＋手機第一次登記後綁定 LINE ---------- */
function rosterRow(user) { return rows(SH.ROSTER).find(r => String(r[2]).trim() === user.userId); }
function meOf(user) { const sup = isSuperAdmin(user.userId); return { userId: user.userId, displayName: user.displayName, name: rosterName(user), isAdmin: sup || isPublisher(user.userId), isSuper: sup }; }
function rosterName(user) { const r = rosterRow(user); return r ? String(r[0]) : ''; }

function bind(user, name, phone) {
  name = clip(name, 30);
  const p = normPhone(phone);
  if (!name || p.length < 9) throw new Error('請填寫姓名和完整手機號碼');
  return withLock(() => {
    const rs = sheet(SH.ROSTER), data = rs.getDataRange().getValues();
    const mine = data.findIndex((r, i) => i > 0 && String(r[2]).trim() === user.userId);
    if (mine > 0) return { name: String(data[mine][0]) };
    const idx = data.findIndex((r, i) => i > 0 && normName(r[0]) === normName(name) && normPhone(r[1]) === p);
    if (idx > 0) {
      const bound = String(data[idx][2]).trim();
      if (bound && bound !== user.userId) throw new Error('這組姓名和手機已經綁定另一個 LINE 帳號，請聯絡主辦人');
      rs.getRange(idx + 1, 3, 1, 2).setValues([safeRow([user.userId, user.displayName])]);
      return { name: String(data[idx][0]) };
    }
    const at = rs.getLastRow() + 1;
    rs.getRange(at, 2).setNumberFormat('@');
    rs.getRange(at, 1, 1, 4).setValues([safeRow([name, String(phone).replace(/\D/g, ''), user.userId, user.displayName])]);
    return { name };
  });
}

/* ---------- 權限 ---------- */
// 發布者（「發布者」工作表）＝管理員：看得到所有活動的後台（配對、名單），但和活動建立者一樣看不到信件內容。
// 網站總管理者：Apps Script「專案設定 → 指令碼屬性」的 SUPER_ADMIN（LINE userId，多位用逗號分隔），
// 只有他們在後台看得到各活動信件的內容。userId 不寫在程式裡。
function isPublisher(uid) { return rows(SH.PUBLISHERS).some(r => String(r[0]).trim() === uid); }
function superAdmins() { return String(PropertiesService.getScriptProperties().getProperty('SUPER_ADMIN') || '').split(/[\s,，;；]+/).filter(Boolean); }
function isSuperAdmin(uid) { return !!uid && superAdmins().includes(String(uid)); }
function creatorOf(row) { const m = /\((U[0-9a-f]+)\)\s*$/.exec(String(row[AC.CREATOR] || '')); return m ? m[1] : ''; }
function requireOwner(user, actId) {
  if (isSuperAdmin(user.userId) || isPublisher(user.userId)) return;
  if (creatorOf(findActRow(actId).row) === user.userId) return;
  if (isCoAdmin(user.userId, actId)) return;
  throw new Error('只有活動建立者或共同管理者可以看這個活動的後台');
}
/** 只有活動建立者與網站總管理者可以新增／移除共同管理者，以及刪除活動 */
function requireCreator(user, actId) {
  if (isSuperAdmin(user.userId)) return;
  if (creatorOf(findActRow(actId).row) === user.userId) return;
  throw new Error('只有活動建立者可以做這個動作');
}

/* ---------- 共同管理者：工作表若還沒有會在第一次新增時自動建立，不必另外執行 setup() ---------- */
function ensureCoAdminSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SH.COADMINS);
  if (sh) return sh;
  const h = HEADERS[SH.COADMINS];
  sh = ss.insertSheet(SH.COADMINS);
  sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}
function coRows() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.COADMINS);
  if (!sh) return [];
  const v = sh.getDataRange().getValues();
  v.shift();
  return v;
}
/** 給前端用的短鑰，不是 LINE userId，避免出現在畫面上 */
function coKey(actId, uid) {
  const s = 'co:' + String(actId) + ':' + String(uid);
  let h = 2166136261, h2 = 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
    h2 = (Math.imul(h2, 31) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16) + (h2 >>> 0).toString(16);
}
function isCoAdmin(uid, actId) {
  const u = String(uid || ''), a = String(actId || '');
  return !!u && coRows().some(r => String(r[CA.ACT]) === a && String(r[CA.UID]).trim() === u);
}
function listCoAdmins(actId) {
  return coRows().filter(r => String(r[CA.ACT]) === String(actId)).map(r => {
    const uid = String(r[CA.UID]).trim();
    return { name: String(r[CA.NAME] || ''), key: coKey(actId, uid) };
  });
}
/** 這個活動裡已寫信（寄件人 userId）或已收信（收信紀錄 userId）的人，排除建立者與既有共同管理者 */
function collectActPeople(actId) {
  const people = {};
  rows(SH.LETTERS).forEach(function (l) {
    if (String(l[LT.ACT]) !== String(actId)) return;
    const uid = String(l[LT.FROM_UID] || '').trim();
    if (!uid) return;
    if (!people[uid]) people[uid] = { uid: uid, name: String(l[LT.FROM] || ''), wrote: false, received: false };
    people[uid].wrote = true;
    if (l[LT.FROM]) people[uid].name = String(l[LT.FROM]);
  });
  rows(SH.OPENS).forEach(function (o) {
    if (String(o[OP.ACT]) !== String(actId)) return;
    const uid = String(o[OP.UID] || '').trim();
    if (!uid) return;
    if (!people[uid]) people[uid] = { uid: uid, name: String(o[OP.NAME] || o[OP.LINE_NAME] || ''), wrote: false, received: false };
    people[uid].received = true;
    if (!people[uid].name) people[uid].name = String(o[OP.NAME] || o[OP.LINE_NAME] || '');
  });
  return people;
}
function listCoAdminCandidates(actId, creatorUid) {
  const taken = {};
  taken[String(creatorUid || '')] = true;
  coRows().forEach(function (r) {
    if (String(r[CA.ACT]) === String(actId)) taken[String(r[CA.UID]).trim()] = true;
  });
  const out = [];
  const people = collectActPeople(actId);
  Object.keys(people).forEach(function (uid) {
    if (taken[uid]) return;
    const p = people[uid];
    out.push({ name: p.name, key: coKey(actId, uid), via: p.wrote && p.received ? 'both' : p.wrote ? 'wrote' : 'received' });
  });
  return out.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hant'); });
}
function findActPersonByKey(actId, key, creatorUid) {
  key = String(key || '');
  const people = collectActPeople(actId);
  for (const uid in people) {
    if (takenHas(uid, actId, creatorUid)) continue;
    if (coKey(actId, uid) === key) return people[uid];
  }
  return null;
}
function takenHas(uid, actId, creatorUid) {
  if (String(uid) === String(creatorUid || '')) return true;
  return coRows().some(r => String(r[CA.ACT]) === String(actId) && String(r[CA.UID]).trim() === String(uid));
}
function addCoAdmin(user, actId, key) {
  requireCreator(user, actId);
  const a = getAct(actId);
  if (!a) throw new Error('找不到這個流通神聖的愛活動');
  const creatorUid = creatorOf(findActRow(actId).row);
  return withLock(() => {
    const already = coRows().find(r => String(r[CA.ACT]) === String(actId) && coKey(actId, String(r[CA.UID]).trim()) === String(key || ''));
    if (already) return { added: false, name: String(already[CA.NAME] || ''), coAdmins: listCoAdmins(actId), candidates: listCoAdminCandidates(actId, creatorUid) };
    const person = findActPersonByKey(actId, key, creatorUid);
    if (!person) throw new Error('只能新增這個活動裡已經寫信或已經收信的人');
    ensureCoAdminSheet().appendRow(safeRow([String(actId), person.uid, person.name, new Date(), user.userId]));
    return { added: true, name: person.name, coAdmins: listCoAdmins(actId), candidates: listCoAdminCandidates(actId, creatorUid) };
  });
}
function removeCoAdmin(user, actId, key) {
  requireCreator(user, actId);
  const creatorUid = creatorOf(findActRow(actId).row);
  return withLock(() => {
    const sh = SpreadsheetApp.getActive().getSheetByName(SH.COADMINS);
    if (!sh) return { removed: false, coAdmins: listCoAdmins(actId), candidates: listCoAdminCandidates(actId, creatorUid) };
    const data = sh.getDataRange().getValues();
    let name = '', removed = false;
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][CA.ACT]) !== String(actId)) continue;
      if (coKey(actId, String(data[i][CA.UID]).trim()) !== String(key || '')) continue;
      name = String(data[i][CA.NAME] || '');
      sh.deleteRow(i + 1);
      removed = true;
      break;
    }
    return { removed: removed, name: name, coAdmins: listCoAdmins(actId), candidates: listCoAdminCandidates(actId, creatorUid) };
  });
}

/* ---------- 照片 ---------- */
function imageFolder() {
  const it = DriveApp.getFoldersByName(CONFIG.IMAGE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.IMAGE_FOLDER);
}

function uploadImage(user, data, mime) {
  mime = /^image\/(jpeg|png)$/.test(mime) ? mime : 'image/jpeg';
  const b64 = String(data || '').replace(/^data:[^,]+,/, '');
  if (!b64) throw new Error('沒有收到照片');
  if (b64.length > 7000000) throw new Error('照片太大，請換一張小一點的');
  const name = 'letter-' + fmt(new Date(), 'yyyyMMdd-HHmmss') + (mime === 'image/png' ? '.png' : '.jpg');
  const file = imageFolder().createFile(Utilities.newBlob(Utilities.base64Decode(b64), mime, name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  file.setDescription('上傳者：' + user.displayName + ' (' + user.userId + ')');
  return 'https://lh3.googleusercontent.com/d/' + file.getId();
}

/* ---------- 流通神聖的愛活動 ---------- */
function rowToAct(r) {
  return { id: String(r[AC.ID]), title: String(r[AC.TITLE]), desc: String(r[AC.DESC] || ''), open: isTrue(r[AC.OPEN]),
    creator: String(r[AC.CREATOR] || '').replace(/\s*\(U[0-9a-f]+\)\s*$/, ''), created: fmt(r[AC.CREATED]), deadline: cleanTime(r[AC.DEADLINE]), paper: PAPERS.includes(String(r[AC.PAPER])) ? String(r[AC.PAPER]) : 'rose', image: cleanImageUrl(r[AC.IMAGE]), button: clip(r[AC.BUTTON], 20) };
}
function stateOf(a) {
  if (!a.open) return 'closed';
  const d = parseTime(a.deadline);
  return d && d < new Date() ? 'ended' : 'open';
}
function openedCount(actId) { return new Set(rows(SH.OPENS).filter(o => String(o[OP.ACT]) === String(actId)).map(o => String(o[OP.LETTER]))).size; }
/** 已有 XX 個人收到愛、已有 XX 人寫信：該活動中已送出信件的不重複收信人（normName）與不重複寄件人（userId）。
 *  extraTo／extraFrom 會把正要送出的這一封也算進去（圖卡送出當下的快照）。回傳 {loved, writers}。公開總數，短暫快取。 */
function lovedCount(actId, extraTo, extraFrom) {
  const cache = CacheService.getScriptCache(), key = 'loved:' + String(actId);
  const useCache = (extraTo == null || extraTo === '') && (extraFrom == null || extraFrom === '');
  if (useCache) {
    const hit = cache.get(key);
    if (hit != null) {
      try {
        const o = JSON.parse(hit);
        if (o && typeof o === 'object' && o.loved != null && o.writers != null) return { loved: +o.loved, writers: +o.writers };
      } catch (e) {}
    }
  }
  const names = {}, writers = {};
  rows(SH.LETTERS).forEach(function (l) {
    if (String(l[LT.ACT]) !== String(actId) || !isTrue(l[LT.SENT])) return;
    const n = normName(l[LT.TO]);
    if (n) names[n] = true;
    const w = String(l[LT.FROM_UID] || '').trim();
    if (w) writers[w] = true;
  });
  if (extraTo) { const n = normName(extraTo); if (n) names[n] = true; }
  if (extraFrom) { const w = String(extraFrom).trim(); if (w) writers[w] = true; }
  const out = { loved: Object.keys(names).length, writers: Object.keys(writers).length };
  if (useCache) { try { cache.put(key, JSON.stringify(out), 60); } catch (e) {} }
  return out;
}
function clearLoved(actId) { try { CacheService.getScriptCache().remove('loved:' + String(actId)); } catch (e) {} }
function publicAct(a) {
  const s = lovedCount(a.id);
  return { id: a.id, title: a.title, desc: a.desc, deadline: a.deadline, paper: a.paper, image: a.image, button: a.button, state: stateOf(a), opened: openedCount(a.id), loved: s.loved, writers: s.writers };
}
function findActRow(id) {
  const data = sheet(SH.ACTS).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][AC.ID]) === String(id)) return { index: i + 1, row: data[i] };
  throw new Error('找不到這個流通神聖的愛活動，可能已經被刪除');
}
function getAct(id) { try { return rowToAct(findActRow(id).row); } catch (e) { return null; } }

function cleanActInput(a) {
  const title = clip(a.title, 40);
  if (!title) throw new Error('請填寫活動名稱');
  const raw = String(a.image || '').trim();
  const image = cleanImageUrl(raw);
  if (raw && !image) throw new Error('圖片網址要是 https:// 開頭的完整網址');
  return { title, desc: clip(a.desc, 500), deadline: cleanTime(a.deadline), paper: PAPERS.includes(a.paper) ? a.paper : 'rose', image, button: clip(a.button, 20) };
}

/** 活動封面圖片：只收 https 網址（LINE 圖卡只能顯示 https 圖片），長度上限 1000 */
function cleanImageUrl(v) {
  const s = String(v || '').trim();
  return /^https:\/\/[^\s"'<>]+$/.test(s) && s.length <= 1000 ? s : '';
}

function createAct(user, input) {
  const a = cleanActInput(input);
  const id = newId('A');
  withLock(() => {
    const sh = sheet(SH.ACTS), at = sh.getLastRow() + 1;
    sh.getRange(at, AC.DEADLINE + 1).setNumberFormat('@');
    sh.getRange(at, 1, 1, 10).setValues([safeRow([id, a.title, a.desc, true, user.displayName + ' (' + user.userId + ')', new Date(), a.deadline, a.paper, a.image, a.button])]);
  });
  return withStats(getAct(id));
}

function updateAct(id, input) {
  const a = cleanActInput(input);
  return withLock(() => {
    const f = findActRow(id), sh = sheet(SH.ACTS);
    sh.getRange(f.index, AC.TITLE + 1, 1, 2).setValues([safeRow([a.title, a.desc])]);
    sh.getRange(f.index, AC.DEADLINE + 1).setNumberFormat('@').setValue(a.deadline);
    sh.getRange(f.index, AC.PAPER + 1, 1, 3).setValues([safeRow([a.paper, a.image, a.button])]);
    return withStats(getAct(id));
  });
}

function setOpen(id, open) {
  return withLock(() => {
    const f = findActRow(id);
    sheet(SH.ACTS).getRange(f.index, AC.OPEN + 1).setValue(open);
    return withStats(getAct(id));
  });
}

function withStats(a, letters, opens) {
  letters = (letters || rows(SH.LETTERS)).filter(l => String(l[LT.ACT]) === a.id);
  opens = opens || rows(SH.OPENS);
  const opened = new Set(opens.filter(o => String(o[OP.ACT]) === a.id).map(o => String(o[OP.LETTER])));
  const names = {}, writers = {};
  letters.forEach(function (l) {
    if (!isTrue(l[LT.SENT])) return;
    const n = normName(l[LT.TO]); if (n) names[n] = true;
    const w = String(l[LT.FROM_UID] || '').trim(); if (w) writers[w] = true;
  });
  return { ...a, state: stateOf(a), letters: letters.length, opened: letters.filter(l => opened.has(String(l[LT.ID]))).length, loved: Object.keys(names).length, writers: Object.keys(writers).length };
}

function listActs(user) {
  const admin = isSuperAdmin(user.userId) || isPublisher(user.userId);
  const letters = rows(SH.LETTERS), opens = rows(SH.OPENS);
  const co = {};
  coRows().forEach(function (r) { if (String(r[CA.UID]).trim() === user.userId) co[String(r[CA.ACT])] = true; });
  return rows(SH.ACTS).filter(r => admin || creatorOf(r) === user.userId || co[String(r[AC.ID])])
    .map(r => {
      const mine = creatorOf(r) === user.userId;
      return { ...withStats(rowToAct(r), letters, opens), mine: mine, coadmin: !mine && !!co[String(r[AC.ID])] };
    })
    .reverse();
}

/**
 * 後台的一列信：寄件人、收信人、時間、是否送出／收信。
 * 信件內容（悄悄話、照片、經文）只有 full = true（網站總管理者）才放進去；活動建立者與發布者拿不到。
 */
function hostLetterView(l, o, full) {
  const v = { id: String(l[LT.ID]), from: String(l[LT.FROM]), to: String(l[LT.TO]), paper: String(l[LT.PAPER] || 'rose'),
    time: fmt(l[LT.TIME]), sent: isTrue(l[LT.SENT]), openedAt: o ? fmt(o[OP.TIME]) : '', openedBy: o ? String(o[OP.NAME]) : '' };
  if (full) Object.assign(v, { text: String(l[LT.TEXT]), image: String(l[LT.IMAGE] || ''), vref: String(l[LT.VREF] || ''), vtext: String(l[LT.VTEXT] || '') });
  return v;
}

/** 後台：每封信的寄件人、收信人與收信狀態；full（網站總管理者）才附信件內容。也附共同管理者與可新增人選（不含 userId）。 */
function actDetail(id, user) {
  const a = getAct(id);
  if (!a) throw new Error('找不到這個流通神聖的愛活動');
  const full = isSuperAdmin(user.userId);
  const creatorUid = creatorOf(findActRow(id).row);
  const canManageAdmins = full || creatorUid === user.userId;
  const opens = rows(SH.OPENS).filter(o => String(o[OP.ACT]) === a.id);
  const letters = rows(SH.LETTERS).filter(l => String(l[LT.ACT]) === a.id)
    .map(l => hostLetterView(l, opens.find(o => String(o[OP.LETTER]) === String(l[LT.ID])), !!full)).reverse();
  const role = full ? 'super' : creatorUid === user.userId ? 'creator' : isCoAdmin(user.userId, id) ? 'coadmin' : isPublisher(user.userId) ? 'publisher' : 'owner';
  return { act: withStats(a), list: letters, full: !!full, canManageAdmins: canManageAdmins, canDeleteAct: canManageAdmins, role: role,
    coAdmins: listCoAdmins(id), candidates: listCoAdminCandidates(id, creatorUid) };
}

function deleteAct(id) {
  return withLock(() => {
    const f = findActRow(id);
    sheet(SH.ACTS).deleteRow(f.index);
    const letters = deleteRows(SH.LETTERS, r => String(r[LT.ACT]) === String(id));
    const opens = deleteRows(SH.OPENS, r => String(r[OP.ACT]) === String(id));
    let coadmins = 0;
    const csh = SpreadsheetApp.getActive().getSheetByName(SH.COADMINS);
    if (csh) coadmins = deleteRows(SH.COADMINS, r => String(r[CA.ACT]) === String(id));
    clearLoved(id);
    return { letters, opens, coadmins };
  });
}

/* ---------- 備選經文：中文恢復本，列格式 [出處, 經文, 分類]；主辦人可在「經文」工作表增修 ---------- */
const VERSE_SEED = [
  ['約翰福音 3:16', '神愛世人，甚至將祂的獨生子賜給他們，叫一切信入祂的，不至滅亡，反得永遠的生命。', '福音'],
  ['使徒行傳 16:31', '他們說，當信靠主耶穌，你和你一家都必得救。', '福音'],
  ['羅馬書 10:13', '因為“凡呼求主名的，就必得救。”', '福音'],
  ['創世記 1:26', '神說，我們要按著我們的形像，照著我們的樣式造人，使他們管理海裏的魚、空中的鳥、地上的牲畜、和全地、並地上所爬的一切爬物。', '福音'],
  ['約翰福音 1:29', '次日，約翰看見耶穌向他走來，就說，看哪，神的羔羊，除去世人之罪的！', '福音'],
  ['馬可福音 2:17', '耶穌聽見，就對他們說，強健的人用不著醫生，有病的人纔用得著；我來本不是召義人，乃是召罪人。', '福音'],
  ['羅馬書 5:8', '惟有基督在我們還作罪人的時候，為我們死，神就在此將祂自己的愛向我們顯明了。', '福音'],
  ['約翰福音 10:10', '賊來了，無非是要偷竊、殺害、毀壞；我來了，是要叫羊得生命，並且得的更豐盛。', '福音'],
  ['馬太福音 11:28', '凡勞苦擔重擔的，可以到我這裏來，我必使你們得安息。', '福音'],
  ['腓立比書 4:6-7', '應當一無罣慮，只要凡事藉著禱告、祈求，帶著感謝，將你們所要的告訴神；神那超越人所能理解的平安，必在基督耶穌裏，保衛你們的心懷意念。', '祝福'],
  ['詩篇 65:11', '你以你的恩惠為年歲的冠冕，你的路徑都滴下脂油；', '祝福'],
  ['詩篇 90:12', '求你指教我們怎樣數算自己的日子，好叫我們得著智慧的心。', '祝福'],
  ['馬太福音 6:26', '你們看天空的飛鳥，牠們既不種，也不收，又不收積在倉裏，你們的天父尚且養活牠們。你們不比牠們貴重麼？', '祝福'],
  ['腓立比書 4:13', '我在那加我能力者的裏面，凡事都能作。', '祝福'],
  ['馬太福音 7:7', '求，就給你們；尋找，就尋見；叩門，就給你們開門。', '祝福'],
  ['民數記 6:24-26', '願耶和華賜福給你，保護你；願耶和華使祂的面光照你，賜恩給你；願耶和華向你仰臉，賜你平安。', '祝福'],
  ['哥林多後書 13:14', '願主耶穌基督的恩，神的愛，聖靈的交通，與你們眾人同在。', '祝福'],
  ['約翰一書 4:19', '我們愛，因為神先愛我們。', '愛'],
  ['哥林多前書 13:4-7', '愛是恆久忍耐，又有恩慈；愛是不嫉妒；愛是不自誇，不張狂，不作不合宜的事，不求自己的益處，不輕易發怒，不計算人的惡，不因不義而歡樂，卻與真理同歡樂；凡事包容，凡事相信，凡事盼望，凡事忍耐。', '愛'],
  ['耶利米書 31:3', '耶和華從遠方向我顯現，說，我以永遠的愛愛了你，因此我以慈愛吸引了你。', '愛'],
  ['約翰福音 15:5', '我是葡萄樹，你們是枝子；住在我裏面的，我也住在他裏面，這人就多結果子；因為離了我，你們就不能作甚麼。', '愛'],
];
function verseSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SH.VERSES);
  if (!sh) {
    sh = ss.insertSheet(SH.VERSES);
    sh.getRange(1, 1, 1, 3).setValues([HEADERS[SH.VERSES]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, VERSE_SEED.length, 3).setValues(VERSE_SEED.map(safeRow));
    sh.setColumnWidth(2, 480);
  }
  return sh;
}
/**
 * 在 Apps Script 編輯器手動執行一次：把恢復本經文補進「經文」工作表。
 * 只填經文欄是空白的列（主辦人已經貼過或改過的內容一律不動），清單裡沒有的出處補在最後，然後清掉快取。
 */
function resetVerseRefs() {
  return withLock(() => {
    const sh = verseSheet(), data = rows(SH.VERSES);
    const seed = new Map(VERSE_SEED.map(v => [v[0], v]));
    let filled = 0;
    data.forEach((r, i) => {
      const v = seed.get(String(r[0]).trim());
      if (!v || String(r[1]).trim()) return;
      sh.getRange(i + 2, 2).setValue(safe(v[1]));
      if (!String(r[2]).trim()) sh.getRange(i + 2, 3).setValue(safe(v[2]));
      filled++;
    });
    const have = new Set(data.map(r => String(r[0]).trim()));
    const add = VERSE_SEED.filter(v => !have.has(v[0])).map(safeRow);
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 3).setValues(add);
    CacheService.getScriptCache().remove('verses');
    return { filled, added: add.length };
  });
}

/** 備選經文很少變動：快取 5 分鐘，省下每次讀試算表的時間（主辦人改了經文，最多 5 分鐘後生效） */
function listVerses() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('verses');
  if (hit) return JSON.parse(hit);
  verseSheet();
  const list = rows(SH.VERSES).filter(r => String(r[0]).trim())
    .map(r => ({ ref: clip(r[0], 40), text: clip(r[1], 500), cat: clip(r[2], 10) }));
  try { cache.put('verses', JSON.stringify(list), 300); } catch (e) {}
  return list;
}

/* ---------- 寫信、收信 ---------- */
function findLetter(id) {
  const data = sheet(SH.LETTERS).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][LT.ID]) === String(id)) return { index: i + 1, row: data[i] };
  return null;
}

function writeLetter(user, actId, input) {
  const a = getAct(actId);
  if (!a) throw new Error('找不到這個流通神聖的愛活動，可能已經被刪除');
  const st = stateOf(a);
  if (st !== 'open') throw new Error(st === 'ended' ? '這個流通神聖的愛活動已經截止寫信' : '主辦人已經停止這個活動的寫信');
  const from = rosterName(user);
  if (!from) throw new Error('NEED_BIND');
  const { to, text, image, paper, vref, vtext } = cleanLetterInput(input);
  const id = newId('L');
  withLock(() => sheet(SH.LETTERS).appendRow(safeRow([id, a.id, from, user.userId, to, text, image, paper, new Date(), false, vref, vtext])));
  const s = lovedCount(a.id, to, user.userId);
  return { id, actId: a.id, actTitle: a.title, from, to, paper, opened: openedCount(a.id), loved: s.loved, writers: s.writers };
}

function cleanLetterInput(input) {
  const to = clip(input.to, 30), text = clip(input.text, 1000);
  if (!to) throw new Error('請填寫收信人的名字');
  if (!text) throw new Error('請寫下要給對方的悄悄話');
  const image = /^https:\/\/lh3\.googleusercontent\.com\/d\/[\w-]+$/.test(input.image || '') ? input.image : '';
  const paper = PAPERS.includes(input.paper) ? input.paper : 'rose';
  return { to, text, image, paper, vref: clip(input.vref, 40), vtext: clip(input.vtext, 500) };
}

/** 寫信的人修改自己的信：對方還沒收信、活動還開放寫信時才能改 */
function updateLetter(user, letterId, input) {
  const l = cleanLetterInput(input);
  return withLock(() => {
    const f = findLetter(letterId);
    if (!f || String(f.row[LT.FROM_UID]) !== user.userId) throw new Error('只能修改自己寫的信');
    if (openInfo(letterId).openedAt) throw new Error('對方已經收信了，不能再修改');
    const a = getAct(f.row[LT.ACT]);
    if (!a || stateOf(a) !== 'open') throw new Error('這個活動已經停止寫信，不能再修改');
    const sh = sheet(SH.LETTERS);
    sh.getRange(f.index, LT.TO + 1, 1, 4).setValues([safeRow([l.to, l.text, l.image, l.paper])]);
    sh.getRange(f.index, LT.VREF + 1, 1, 2).setValues([safeRow([l.vref, l.vtext])]);
    const changedTo = normName(f.row[LT.TO]) !== normName(l.to);
    if (changedTo) sh.getRange(f.index, LT.SENT + 1).setValue(false); // 換了收信人，要重新送出
    clearLoved(a.id);
    const s = lovedCount(a.id, l.to, user.userId);
    return { id: String(letterId), actId: a.id, actTitle: a.title, from: String(f.row[LT.FROM]), to: l.to, paper: l.paper, changedTo, opened: openedCount(a.id), loved: s.loved, writers: s.writers };
  });
}

/** 刪除一封信：寫信的人自己，或活動建立者／共同管理者／管理員 */
function deleteLetter(user, letterId) {
  return withLock(() => {
    const f = findLetter(letterId);
    if (!f) throw new Error('找不到這封信，可能已經被刪除');
    if (String(f.row[LT.FROM_UID]) !== user.userId) requireOwner(user, f.row[LT.ACT]);
    const actId = String(f.row[LT.ACT]);
    sheet(SH.LETTERS).deleteRow(f.index);
    const opens = deleteRows(SH.OPENS, r => String(r[OP.LETTER]) === String(letterId));
    clearLoved(actId);
    return { id: String(letterId), opens };
  });
}

/** 寫信的人選好朋友或群組送出後，記下「已送出」 */
function markSent(user, letterId) {
  return withLock(() => {
    const f = findLetter(letterId);
    if (!f || String(f.row[LT.FROM_UID]) !== user.userId) throw new Error('找不到這封信');
    sheet(SH.LETTERS).getRange(f.index, LT.SENT + 1).setValue(true);
    const actId = String(f.row[LT.ACT]);
    clearLoved(actId);
    const s = lovedCount(actId);
    return { id: letterId, loved: s.loved, writers: s.writers };
  });
}

function myLetters(user, actId) {
  const opens = rows(SH.OPENS);
  const titles = {};
  rows(SH.ACTS).forEach(function (r) { titles[String(r[AC.ID])] = String(r[AC.TITLE] || ''); });
  return rows(SH.LETTERS).filter(l => String(l[LT.FROM_UID]) === user.userId && (!actId || String(l[LT.ACT]) === String(actId))).map(l => {
    const o = opens.find(o => String(o[OP.LETTER]) === String(l[LT.ID]));
    const aid = String(l[LT.ACT]);
    return { id: String(l[LT.ID]), actId: aid, actTitle: titles[aid] || '', from: String(l[LT.FROM]), to: String(l[LT.TO]), text: String(l[LT.TEXT]), image: String(l[LT.IMAGE] || ''),
      paper: String(l[LT.PAPER] || 'rose'), time: fmt(l[LT.TIME]), sent: isTrue(l[LT.SENT]), openedAt: o ? fmt(o[OP.TIME]) : '',
      vref: String(l[LT.VREF] || ''), vtext: String(l[LT.VTEXT] || '') };
  }).reverse();
}

/** 信封：收信人名字與活動名稱，不含內容（給還沒登入的人看） */
function letterCard(id) {
  const f = findLetter(id);
  if (!f) return null;
  const a = getAct(f.row[LT.ACT]);
  const s = lovedCount(f.row[LT.ACT], f.row[LT.TO], f.row[LT.FROM_UID]);
  return { id: String(id), to: String(f.row[LT.TO]), paper: String(f.row[LT.PAPER] || 'rose'), actId: String(f.row[LT.ACT]), actTitle: a ? a.title : '', opened: openedCount(f.row[LT.ACT]), loved: s.loved, writers: s.writers };
}

function letterContent(r, a) {
  return { id: String(r[LT.ID]), actId: String(r[LT.ACT]), actTitle: a ? a.title : '', from: String(r[LT.FROM]), to: String(r[LT.TO]),
    text: String(r[LT.TEXT]), image: String(r[LT.IMAGE] || ''), paper: String(r[LT.PAPER] || 'rose'), time: fmt(r[LT.TIME]),
    vref: String(r[LT.VREF] || ''), vtext: String(r[LT.VTEXT] || '') };
}

/** 按「收信」：登記姓名與收信人相符才拆信，第一次拆信記入收信紀錄（＝配對成功） */
function openLetter(user, letterId) {
  const f = findLetter(letterId);
  if (!f) throw new Error('找不到這封信，可能已經被刪除');
  const r = f.row, a = getAct(r[LT.ACT]);
  if (String(r[LT.FROM_UID]) === user.userId) return { status: 'mine', letter: letterContent(r, a), ...openInfo(letterId) };
  const name = rosterName(user);
  if (!name) return { status: 'need_bind', to: String(r[LT.TO]) };
  if (!namesRelated(name, r[LT.TO]) && !namesRelated(user.displayName, r[LT.TO])) return { status: 'wrong_person', to: String(r[LT.TO]), name };
  return withLock(() => {
    let info = openInfo(letterId), first = false;
    if (!info.openedAt) {
      sheet(SH.OPENS).appendRow(safeRow([new Date(), String(r[LT.ID]), String(r[LT.ACT]), name, user.displayName, user.userId]));
      info = openInfo(letterId); first = true;
    }
    return { status: 'opened', first, letter: letterContent(r, a), ...info };
  });
}

function openInfo(letterId) {
  const o = rows(SH.OPENS).find(o => String(o[OP.LETTER]) === String(letterId));
  return { openedAt: o ? fmt(o[OP.TIME]) : '' };
}

/* ---------- 當事人查看與刪除自己的資料 ---------- */
function myData(user) {
  const r = rosterRow(user);
  return {
    found: !!r, name: r ? String(r[0]) : '', phone: r ? String(r[1]) : '', lineName: r ? String(r[3] || '') : user.displayName,
    sent: rows(SH.LETTERS).filter(l => String(l[LT.FROM_UID]) === user.userId).length,
    received: rows(SH.OPENS).filter(o => String(o[OP.UID]) === user.userId).length,
  };
}

/** 刪除名單資料、自己寫的信、自己的收信紀錄、登入通行證 */
function deleteMyData(user) {
  return withLock(() => {
    const mine = new Set(rows(SH.LETTERS).filter(l => String(l[LT.FROM_UID]) === user.userId).map(l => String(l[LT.ID])));
    const roster = deleteRows(SH.ROSTER, r => String(r[2]).trim() === user.userId);
    const letters = deleteRows(SH.LETTERS, r => String(r[LT.FROM_UID]) === user.userId);
    const opens = deleteRows(SH.OPENS, r => String(r[OP.UID]) === user.userId || mine.has(String(r[OP.LETTER])));
    let coadmins = 0;
    if (SpreadsheetApp.getActive().getSheetByName(SH.COADMINS)) coadmins = deleteRows(SH.COADMINS, r => String(r[CA.UID]).trim() === user.userId);
    sessionSheet(); deleteRows(SESSION_SHEET, r => String(r[1]) === user.userId);
    return { roster, letters, opens, coadmins };
  });
}

/** 網站總管理者專用：列出已登記的人（不含 LINE userId、不含登入通行證） */
function requireSuper(user) {
  if (!isSuperAdmin(user.userId)) throw new Error('只有網站總管理者可以看登記總覽');
}
function listOverview(user) {
  requireSuper(user);
  const letters = rows(SH.LETTERS);
  const opens = rows(SH.OPENS);
  const people = rows(SH.ROSTER).map(function (r) {
    const uid = String(r[2] || '').trim();
    const rec = {
      name: String(r[0] || ''),
      phone: String(r[1] || ''),
      lineName: String(r[3] || ''),
      written: letters.filter(function (l) { return String(l[LT.FROM_UID] || '').trim() === uid; }).length,
      received: opens.filter(function (o) { return String(o[OP.UID] || '').trim() === uid; }).length
    };
    if (r.length > 4 && r[4]) rec.time = fmt(r[4]);
    return rec;
  });
  people.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hant'); });
  return { total: people.length, people: people };
}
