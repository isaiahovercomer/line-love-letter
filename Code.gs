/**
 * LINE 流通神聖的愛圖卡建立平台 — Google Apps Script 後端
 * 貼到 Google 試算表的「擴充功能 → Apps Script」。第一次（或更新欄位後）執行一次 setup()，再部署成網頁應用程式
 * （執行身分：我；存取權：所有人）。
 */

const CONFIG = {
  CHANNEL_ID: '2012412693',          // LINE Login channel ID（與活動登記平台同一個）
  IMAGE_FOLDER: 'LINE 流通神聖的愛圖卡照片', // 信裡附的照片存在雲端硬碟這個資料夾
};

const SH = { ROSTER: '名單', ACTS: '流通神聖的愛活動', LETTERS: '信件', OPENS: '收信紀錄', PUBLISHERS: '發布者', VERSES: '經文' };

const HEADERS = {
  '名單': ['姓名', '手機', 'LINE userId', 'LINE名稱'],
  '流通神聖的愛活動': ['活動代碼', '活動名稱', '說明', '開放寫信', '建立者', '建立時間', '截止時間', '預設信紙'],
  '信件': ['信件代碼', '活動代碼', '寄件人姓名', '寄件人 userId', '收信人姓名', '悄悄話', '照片網址', '信紙', '寫信時間', '已送出', '經文出處', '經文內容'],
  '收信紀錄': ['時間', '信件代碼', '活動代碼', '收信人姓名', 'LINE名稱', 'LINE userId'],
  '發布者': ['LINE userId', '名稱', '備註'],
  '經文': ['出處', '經文（請貼上恢復本經文）', '分類'],
};

// 欄位位置（從 0 開始）
const AC = { ID: 0, TITLE: 1, DESC: 2, OPEN: 3, CREATOR: 4, CREATED: 5, DEADLINE: 6, PAPER: 7 };
const LT = { ID: 0, ACT: 1, FROM: 2, FROM_UID: 3, TO: 4, TEXT: 5, IMAGE: 6, PAPER: 7, TIME: 8, SENT: 9, VREF: 10, VTEXT: 11 };
const OP = { TIME: 0, LETTER: 1, ACT: 2, NAME: 3, LINE_NAME: 4, UID: 5 };
const PAPERS = ['rose', 'sky', 'kraft', 'mint', 'winter', 'xmas', 'newyear', 'thanks', 'grad', 'birthday', 'gospel'];

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
        case 'actDetail':    own(); out = { ok: true, ...actDetail(req.actId) }; break;
        case 'setOpen':      own(); out = { ok: true, act: setOpen(req.actId, !!req.open) }; break;
        case 'deleteAct':    own(); out = { ok: true, ...deleteAct(req.actId) }; break;
        case 'myData':       out = { ok: true, ...myData(user) }; break;
        case 'deleteMyData': out = { ok: true, ...deleteMyData(user) }; break;
        default: throw new Error('未知的動作');
      }
    }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return json(out);
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
    sh.appendRow([token, user.userId, user.displayName, exp, now]);
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
function isTrue(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function newId(prefix) { return prefix + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function clip(v, n) { return String(v || '').trim().slice(0, n); }
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
function meOf(user) { return { userId: user.userId, displayName: user.displayName, name: rosterName(user), isAdmin: isPublisher(user.userId) }; }
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
      rs.getRange(idx + 1, 3, 1, 2).setValues([[user.userId, user.displayName]]);
      return { name: String(data[idx][0]) };
    }
    const at = rs.getLastRow() + 1;
    rs.getRange(at, 2).setNumberFormat('@');
    rs.getRange(at, 1, 1, 4).setValues([[name, String(phone).replace(/\D/g, ''), user.userId, user.displayName]]);
    return { name };
  });
}

/* ---------- 權限 ---------- */
function isPublisher(uid) { return rows(SH.PUBLISHERS).some(r => String(r[0]).trim() === uid); }
function creatorOf(row) { const m = /\((U[0-9a-f]+)\)\s*$/.exec(String(row[AC.CREATOR] || '')); return m ? m[1] : ''; }
function requireOwner(user, actId) {
  if (isPublisher(user.userId)) return;
  if (creatorOf(findActRow(actId).row) !== user.userId) throw new Error('只有活動建立者可以看這個活動的後台');
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
    creator: String(r[AC.CREATOR] || '').replace(/\s*\(U[0-9a-f]+\)\s*$/, ''), created: fmt(r[AC.CREATED]), deadline: cleanTime(r[AC.DEADLINE]), paper: PAPERS.includes(String(r[AC.PAPER])) ? String(r[AC.PAPER]) : 'rose' };
}
function stateOf(a) {
  if (!a.open) return 'closed';
  const d = parseTime(a.deadline);
  return d && d < new Date() ? 'ended' : 'open';
}
function openedCount(actId) { return new Set(rows(SH.OPENS).filter(o => String(o[OP.ACT]) === String(actId)).map(o => String(o[OP.LETTER]))).size; }
function publicAct(a) { return { id: a.id, title: a.title, desc: a.desc, deadline: a.deadline, paper: a.paper, state: stateOf(a), opened: openedCount(a.id) }; }
function findActRow(id) {
  const data = sheet(SH.ACTS).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) if (String(data[i][AC.ID]) === String(id)) return { index: i + 1, row: data[i] };
  throw new Error('找不到這個流通神聖的愛活動，可能已經被刪除');
}
function getAct(id) { try { return rowToAct(findActRow(id).row); } catch (e) { return null; } }

function cleanActInput(a) {
  const title = clip(a.title, 40);
  if (!title) throw new Error('請填寫活動名稱');
  return { title, desc: clip(a.desc, 500), deadline: cleanTime(a.deadline), paper: PAPERS.includes(a.paper) ? a.paper : 'rose' };
}

function createAct(user, input) {
  const a = cleanActInput(input);
  const id = newId('A');
  withLock(() => {
    const sh = sheet(SH.ACTS), at = sh.getLastRow() + 1;
    sh.getRange(at, AC.DEADLINE + 1).setNumberFormat('@');
    sh.getRange(at, 1, 1, 8).setValues([[id, a.title, a.desc, true, user.displayName + ' (' + user.userId + ')', new Date(), a.deadline, a.paper]]);
  });
  return withStats(getAct(id));
}

function updateAct(id, input) {
  const a = cleanActInput(input);
  return withLock(() => {
    const f = findActRow(id), sh = sheet(SH.ACTS);
    sh.getRange(f.index, AC.TITLE + 1, 1, 2).setValues([[a.title, a.desc]]);
    sh.getRange(f.index, AC.DEADLINE + 1).setNumberFormat('@').setValue(a.deadline);
    sh.getRange(f.index, AC.PAPER + 1).setValue(a.paper);
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
  return { ...a, state: stateOf(a), letters: letters.length, opened: letters.filter(l => opened.has(String(l[LT.ID]))).length };
}

function listActs(user) {
  const admin = isPublisher(user.userId);
  const letters = rows(SH.LETTERS), opens = rows(SH.OPENS);
  return rows(SH.ACTS).filter(r => admin || creatorOf(r) === user.userId)
    .map(r => ({ ...withStats(rowToAct(r), letters, opens), mine: creatorOf(r) === user.userId }))
    .reverse();
}

/** 後台：每封信的寄件人、收信人、內容與收信狀態 */
function actDetail(id) {
  const a = getAct(id);
  if (!a) throw new Error('找不到這個流通神聖的愛活動');
  const opens = rows(SH.OPENS).filter(o => String(o[OP.ACT]) === a.id);
  const letters = rows(SH.LETTERS).filter(l => String(l[LT.ACT]) === a.id).map(l => {
    const o = opens.find(o => String(o[OP.LETTER]) === String(l[LT.ID]));
    return { id: String(l[LT.ID]), from: String(l[LT.FROM]), to: String(l[LT.TO]), text: String(l[LT.TEXT]), image: String(l[LT.IMAGE] || ''),
      paper: String(l[LT.PAPER] || 'rose'), time: fmt(l[LT.TIME]), sent: isTrue(l[LT.SENT]),
      vref: String(l[LT.VREF] || ''), vtext: String(l[LT.VTEXT] || ''),
      openedAt: o ? fmt(o[OP.TIME]) : '', openedBy: o ? String(o[OP.NAME]) : '' };
  }).reverse();
  return { act: withStats(a), list: letters };
}

function deleteAct(id) {
  return withLock(() => {
    const f = findActRow(id);
    sheet(SH.ACTS).deleteRow(f.index);
    const letters = deleteRows(SH.LETTERS, r => String(r[LT.ACT]) === String(id));
    const opens = deleteRows(SH.OPENS, r => String(r[OP.ACT]) === String(id));
    return { letters, opens };
  });
}

/* ---------- 備選經文：出處先填好，經文內容由主辦人貼上恢復本 ---------- */
const VERSE_SEED = [
  ['約翰福音 3:16', '福音'], ['使徒行傳 16:31', '福音'], ['羅馬書 10:13', '福音'], ['創世記 1:26', '福音'],
  ['約翰福音 1:29', '福音'], ['馬可福音 2:17', '福音'], ['羅馬書 5:8', '福音'], ['約翰福音 10:10', '福音'],
  ['馬太福音 11:28', '福音'], ['腓立比書 4:6-7', '祝福'], ['詩篇 65:11', '祝福'], ['詩篇 90:12', '祝福'],
  ['馬太福音 6:26', '祝福'], ['腓立比書 4:13', '祝福'], ['馬太福音 7:7', '祝福'], ['民數記 6:24-26', '祝福'],
  ['哥林多後書 13:14', '祝福'], ['約翰一書 4:19', '愛'], ['哥林多前書 13:4-7', '愛'], ['耶利米書 31:3', '愛'],
  ['約翰福音 15:5', '愛'],
];
function verseSheet() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SH.VERSES);
  if (!sh) {
    sh = ss.insertSheet(SH.VERSES);
    sh.getRange(1, 1, 1, 3).setValues([HEADERS[SH.VERSES]]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, VERSE_SEED.length, 3).setValues(VERSE_SEED.map(v => [v[0], '', v[1]]));
    sh.setColumnWidth(2, 480);
  }
  return sh;
}
/** 在 Apps Script 編輯器手動執行一次：把還沒貼經文的備選出處換成最新清單（已貼經文的列保留） */
function resetVerseRefs() {
  const sh = verseSheet();
  const keep = rows(SH.VERSES).filter(r => String(r[0]).trim() && String(r[1]).trim()).map(r => [r[0], r[1], r[2]]);
  const have = new Set(keep.map(r => String(r[0]).trim()));
  const all = keep.concat(VERSE_SEED.filter(v => !have.has(v[0])).map(v => [v[0], '', v[1]]));
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  sh.getRange(2, 1, all.length, 3).setValues(all);
  CacheService.getScriptCache().remove('verses');
  return all.length;
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
  withLock(() => sheet(SH.LETTERS).appendRow([id, a.id, from, user.userId, to, text, image, paper, new Date(), false, vref, vtext]));
  return { id, actId: a.id, actTitle: a.title, from, to, paper, opened: openedCount(a.id) };
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
    sh.getRange(f.index, LT.TO + 1, 1, 4).setValues([[l.to, l.text, l.image, l.paper]]);
    sh.getRange(f.index, LT.VREF + 1, 1, 2).setValues([[l.vref, l.vtext]]);
    const changedTo = normName(f.row[LT.TO]) !== normName(l.to);
    if (changedTo) sh.getRange(f.index, LT.SENT + 1).setValue(false); // 換了收信人，要重新送出
    return { id: String(letterId), actId: a.id, actTitle: a.title, from: String(f.row[LT.FROM]), to: l.to, paper: l.paper, changedTo, opened: openedCount(a.id) };
  });
}

/** 刪除一封信：寫信的人自己，或活動建立者／管理員 */
function deleteLetter(user, letterId) {
  return withLock(() => {
    const f = findLetter(letterId);
    if (!f) throw new Error('找不到這封信，可能已經被刪除');
    if (String(f.row[LT.FROM_UID]) !== user.userId) requireOwner(user, f.row[LT.ACT]);
    sheet(SH.LETTERS).deleteRow(f.index);
    const opens = deleteRows(SH.OPENS, r => String(r[OP.LETTER]) === String(letterId));
    return { id: String(letterId), opens };
  });
}

/** 寫信的人選好朋友或群組送出後，記下「已送出」 */
function markSent(user, letterId) {
  return withLock(() => {
    const f = findLetter(letterId);
    if (!f || String(f.row[LT.FROM_UID]) !== user.userId) throw new Error('找不到這封信');
    sheet(SH.LETTERS).getRange(f.index, LT.SENT + 1).setValue(true);
    return { id: letterId };
  });
}

function myLetters(user, actId) {
  const opens = rows(SH.OPENS);
  return rows(SH.LETTERS).filter(l => String(l[LT.FROM_UID]) === user.userId && (!actId || String(l[LT.ACT]) === String(actId))).map(l => {
    const o = opens.find(o => String(o[OP.LETTER]) === String(l[LT.ID]));
    return { id: String(l[LT.ID]), actId: String(l[LT.ACT]), to: String(l[LT.TO]), text: String(l[LT.TEXT]), image: String(l[LT.IMAGE] || ''),
      paper: String(l[LT.PAPER] || 'rose'), time: fmt(l[LT.TIME]), sent: isTrue(l[LT.SENT]), openedAt: o ? fmt(o[OP.TIME]) : '',
      vref: String(l[LT.VREF] || ''), vtext: String(l[LT.VTEXT] || '') };
  }).reverse();
}

/** 信封：收信人名字與活動名稱，不含內容（給還沒登入的人看） */
function letterCard(id) {
  const f = findLetter(id);
  if (!f) return null;
  const a = getAct(f.row[LT.ACT]);
  return { id: String(id), to: String(f.row[LT.TO]), paper: String(f.row[LT.PAPER] || 'rose'), actId: String(f.row[LT.ACT]), actTitle: a ? a.title : '', opened: openedCount(f.row[LT.ACT]) };
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
  if (normName(name) !== normName(r[LT.TO])) return { status: 'wrong_person', to: String(r[LT.TO]), name };
  return withLock(() => {
    let info = openInfo(letterId), first = false;
    if (!info.openedAt) {
      sheet(SH.OPENS).appendRow([new Date(), String(r[LT.ID]), String(r[LT.ACT]), name, user.displayName, user.userId]);
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
    sessionSheet(); deleteRows(SESSION_SHEET, r => String(r[1]) === user.userId);
    return { roster, letters, opens };
  });
}
