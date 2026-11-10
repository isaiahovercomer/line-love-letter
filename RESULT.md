# RESULT — line-love-letter

## 現況（2026-11-10，第二輪）
- 分支：`feat/t120u-first-polish`，PR #1：https://github.com/isaiahovercomer/line-love-letter/pull/1
- 第二輪兩個 commit：A「修復第 5 項：連點只送出一次、封蠟不再蓋住 To.」、B「補上 21 條備選經文的中文恢復本內容」。
- **未 merge、未 push main、未部署（含 clasp／Apps Script）。**
- **Code.gs 有改動。合併後請 Isaiah：**
  1. 把 `Code.gs` 整份貼回 Apps Script，**部署 → 管理部署作業 → 編輯 → 新版本**；
  2. 在 Apps Script 編輯器**手動執行一次 `resetVerseRefs`**：把恢復本經文補進試算表「經文」工作表
     （只補經文欄空白的列，已經貼過或改過的內容不覆蓋；缺的出處補在最後；會清掉經文快取）。
  - 沒做第 2 步之前，前端也會用內建的恢復本補上空白的經文，選單照樣可用。

## A. t121u 修復第 5 項（連點只送出一次；封蠟不蓋「To.」）

### A1 防連點
前端 `index.html`
- `busy(btn, fn)`：一開頭先同步檢查 `btn.disabled`／處理中旗標，才設 disabled，所以同一輪事件裡的多次 click（含 touch＋click）只會跑一次。失敗時 toast 並恢復可按。
- 會開朋友／群組選單的 `pick()` 加全域 `PICKING` 旗標，選單開著時再按直接忽略；`sendLetter()` 一開頭也檢查。
- 原本沒走 `busy` 的入口都改走 `busy`：送出後「再傳給其他人／選擇朋友或群組送出」（`#s-again`）、轉傳信封與轉傳寫信入口（`#f-go`）、我的信「送出」（`[data-resend]`）、後台「發寫信入口到群組」（`#d-share`）。照片上傳加 `UPLOADING` 旗標。`armThen()`（兩段式刪除）處理中也不再反應。
- 請求編號 `rid`：寫信、更新信、綁定、刪信、刪活動、刪個人資料、上傳照片、建立／更新活動、開關寫信、markSent 都帶 `rid`。同一次按鈕動作（連點、失敗重試）沿用同一個；成功後換新，所以故意再寫一封不同的信會是新的 `rid`。
- 成功後若按鈕仍在畫面上（例如後台「發寫信入口」要再發給另一個群組）會恢復可按；寫信、建立活動等成功後畫面會換掉。
- 預覽模式的 `liff` 替身補上 `shareTargetPicker`（不會真的開選單，回傳「已選好」並顯示原本的預覽提示），測試可以攔截並計次。

後端 `Code.gs`
- 新增 `once(user, req, fn)`：鍵 = `rid:` + LINE userId + 動作 + `rid`。用 LockService 佔位、CacheService 存結果；10 分鐘內同一個鍵再來，直接回傳同一個成功結果；同一個請求還在處理時最多等 20 秒拿結果。失敗不記，重試會真的再做一次。沒有 `rid`（舊版前端）照舊執行。
- `doPost` 的需登入動作搬到 `run(user, req)`，結構不變。
- 在 node 用假的 CacheService／LockService 驗證：同 rid 只跑 1 次、不同 rid 或不同使用者各自執行、失敗後重試會再執行、沒 rid 每次都執行。

### A2 封蠟
- 蓋板高度 58% → 44%、封蠟跟著上移並縮成 46px；「To. 名字」移到下方 9%，名字單行（太長顯示 …）。390px 與 320px 都量過封蠟底與「To.」頂端不重疊（改前重疊 18.2px／28.6px）。
- 截圖：`/workspace/line-love-letter/_shots/after5-env-390.png`、`after5-env-320.png`（寫信送出後的信封）；另有 `after5-letter-env-390.png`、`after5-letter-env-320.png`（收信頁還沒拆的信封）。

### A 測試：`tests/no-double-submit.mjs`（15/15 通過）
只開 `?demo` 頁、擋掉所有外部網路；在頁面裡包住 `demoApi` 與 `liff.shareTargetPicker` 計數。每個按鈕先直接呼叫 `onclick` 5 次（略過 disabled，測旗標本身），再真的滑鼠點 5 次。
```
✓ 儲存並送出：連按 5 次 → writeLetter、選單、markSent 各 1 次
✓ 再傳給其他人（#s-again）：連按 5 次 → 選單、markSent 各 1 次
✓ 取消選單後「選擇朋友或群組送出」、我的信「送出」：連按各只開 1 次
✓ 失敗後可以再按：第一次 writeLetter 失敗 → 按鈕恢復，再按成功，兩次用同一個 rid
✓ 故意連寫兩封不同的信：各自一個 rid，都寫得進去
✓ 建立活動並發到群組：連按 5 次 → createAct、選單各 1 次
✓ 活動後台：發寫信入口、停止寫信、刪除活動 連按都只 1 次
✓ 轉傳信封（?fwd）：連按 5 次只開 1 次選單
✓ 轉傳寫信入口（?share）：連按 5 次只開 1 次選單
✓ 綁定、收信：連按 5 次 bind、openLetter 各 1 次
✓ 刪除我的資料：連按 5 次 deleteMyData 1 次
✓ 信封 390px：寫信送出後封蠟不蓋 To.
✓ 信封 390px：收信頁封蠟不蓋 To.
✓ 信封 320px：寫信送出後封蠟不蓋 To.
✓ 信封 320px：收信頁封蠟不蓋 To.
15/15 通過
```
對照：同一份測試跑改前的 index.html 是 0/15（例如 writeLetter 被呼叫 5 次、封蠟重疊 18.2px）。

## B. t122u 補恢復本備選經文

- 來源：只用本機 `/workspace/interlinear/search-perf/live-site/data/rcv-zh/{OSIS}/{章}.json` 與 `books.json`，沒有連任何網站。
- 取節方式：先找 `o`（原始章:節）含該節的；沒有才用 `n` 且沒有 `o` 的。**林後 13:14 取自 `n=13, o=["13:14"]`。**範圍出處依序接起來。
- 補字中括號：去掉括號、保留字（8 條出處共 11 段）。沒有註腳號或串珠記號（檢查英數字與符號 0 個）。
- **命中 21/21**；範圍節數：腓 4:6-7 2/2、民 6:24-26 3/3、林前 13:4-7 4/4。**找不到的出處：無。**
- 最長一條 93 字，`listVerses` 的 500 字上限夠用，沒有改。
- 一致性：`Code.gs` 的 `VERSE_SEED`、`index.html` 的 `VERSE_REFS` 與來源逐條比對 21/21 相同。

改動
- `Code.gs`：`VERSE_SEED` 改為 `[出處, 經文, 分類]`；`verseSheet()` 新建工作表時直接寫入經文；表頭 B 欄改為「經文（恢復本）」。
  `resetVerseRefs()` 改為**只補空白的經文**（已貼過的內容不覆蓋、自訂的列保留、缺的出處補在最後），清快取，回傳 `{filled, added}`。用假試算表驗證過：已貼內容不變、自訂列不變、空白列補上、缺的 18 條補在最後。
- `index.html`：`VERSE_REFS` 帶經文；後端回來的經文欄若還是空白，用內建的恢復本補上；點備選經文同時填「出處」與「內容」，**不再跳「請把這節經文貼在下面」**；預覽不再用「（預覽：這裡會顯示…）」蓋掉前三條。
- 測試：`tests/demo-smoke.mjs` 新增「點每一條備選經文，出處與內容都有值、沒有中括號、沒有那句提示」，全部 10/10 通過（原 9 項＋經文）。
- 截圖（390px）：`/workspace/line-love-letter/_shots/after-verses-picked.png`、`after-verses-menu.png`。

## 待 Isaiah 決定（本輪刻意沒動）
1. 收信只比對姓名。
2. 刪信／刪個人資料不會刪雲端硬碟照片。
3. 主辦人後台可看信件內容，寫信頁未告知。
4. 任何登入者可建立活動、上傳照片，無頻率／容量限制。
5. `LIFF_ID`、`GAS_URL` 為公開前端必要常數，未動。

## gitleaks（--redact，第二輪）
- `gitleaks git --no-banner --redact -v .`：19 commits scanned，**no leaks found**。
- `gitleaks dir --no-banner --redact`：`index.html`、`Code.gs`、`tests/no-double-submit.mjs`、`tests/demo-smoke.mjs` 皆 **no leaks found**。

## 測試環境
系統 Chrome（`/usr/bin/google-chrome`）、`NODE_PATH=/workspace/morning-revival-today/node_modules`、單一 browser 依序執行、自己開在 127.0.0.1:18766 的靜態伺服器（測完已關）。未測：真實 LIFF 與真實 GAS 後端（依限制不打）；`once()` 與 `resetVerseRefs()` 以 node 假服務驗證，實際 Apps Script 行為需部署後實測。

---

## 第一輪（已完成，保留紀錄）

### 改進清單
| 檔案 | 改動 | 驗證 |
|---|---|---|
| Code.gs | 寫入試算表的使用者文字以 `= + - @`（或 Tab、換行）開頭時加 `'`（`safe()`／`safeRow()`，共 10 處寫入） | `node --check` 通過；`safe()` 單元檢查通過；實際試算表行為需部署後實測 |
| index.html | 拆信時蓋板翻開後淡出，不再蓋住標題 | 改前截圖可見標題被蓋；改後動畫中途截圖蓋板 opacity 0、標題清楚 |
| index.html | 首頁活動卡「截止 12/24 23:59」不再拆成兩行 | 煙霧測試檢查 `getClientRects().length === 1` |
| index.html | 斷線／後端回應異常改為中文提示 | 程式檢視（demo 模式不走網路） |
| index.html | 照片只顯示 https 或 `data:image/`（後台清單、寫信預覽、收信頁統一用 `imgOk`） | 煙霧測試無頁面錯誤 |
| sw.js | 預存補 favicon-32／apple-touch-icon／maskable-512；CACHE → `loveletter-v2`；只存成功回應；頁面快取去掉網址參數 | 程式檢視 |
| repo | 從 git 刪除誤提交的 `'$SP'/shots/`；新增 `.gitignore` | `git status` 確認 `_shots/` 未被追蹤 |
| README.md | 補 Pages 網址、Code.gs 需手動部署、煙霧測試用法（未寫入 LIFF_ID／GAS_URL 實際值） | — |
| tests/demo-smoke.mjs | 輕量 Playwright 煙霧測試，只開 `?demo*`、擋外部網路 | 9/9 通過 |

查證後**丟棄**的假設：`cleanLetterInput` 預設 `'rose'` 就是前端「素雅」，與活動預設信紙、前端 `paperOf` 預設一致，不是 bug，未改。

### 當時的待決定清單（第 6 項已在第二輪修好）
1. 收信只比對姓名：任何人可用收信人姓名＋任意手機自行登記並拆信；信被收過後同名者仍可再開。建議：名單預先建立才能綁定，或收過後只限第一位收信人。
2. 刪信／刪個人資料不會刪雲端硬碟照片（照片為「知道連結者可看」）。建議刪信時一併丟垃圾桶。
3. 主辦人後台可看信件內容，寫信頁目前未告知（先前刻意拿掉提示）。
4. 任何登入者可建立活動、上傳照片，無頻率／容量限制。
5. `index.html` 的 `LIFF_ID`、`GAS_URL` 為公開前端必要常數，未動；是否旋轉由 Isaiah 決定。
6. 小細節：封蠟會蓋到信封上的「To.」；「送出」按鈕連點可能開兩次選單。

### 截圖
改後：`/workspace/line-love-letter/_shots/after-home.png`、`after-home-noguide.png`、`after-write.png`、`after-write-noguide.png`、`after-bind.png`、`after-letter.png`、`after-letter-opened.png`、`after-wrong-opened.png`、`after-newbie-opened.png`、`after-mydata.png`；另有 `check-flap-mid.png`（拆信動畫中途，確認標題沒被蓋）。
改前：同資料夾 `before-*.png`。`_shots/` 已列入 `.gitignore`，未提交。

### gitleaks（--redact）
- `gitleaks git --no-banner --redact -v .`：15 commits scanned，**no leaks found**。
- `gitleaks dir --no-banner --redact`：index.html、Code.gs、sw.js、README.md、.gitignore、tests/ 皆 **no leaks found**。

### 測試結果
`NODE_PATH=/workspace/morning-revival-today/node_modules BASE_URL=http://127.0.0.1:18765/ SHOTS_DIR=_shots node tests/demo-smoke.mjs`（系統 Chrome、390×844、DSF 2、單一 browser 依序執行、重用既有 18765 伺服器）：
```
✓ home（使用說明）
✓ home-noguide：活動卡與截止時間不被拆行
✓ write（使用說明）
✓ write-noguide：寫信並送出
✓ bind：第一次寫信先填姓名手機
✓ letter：收信後看到內容
✓ wrong：不是給你的信
✓ newbie：先登記才能收信
✓ mydata：我的個人資料
9/9 通過
```
未測：正式 LIFF 登入、真實後端（依限制不打真實後端）、Service Worker（本機為 http，不會註冊）。

SUCCESS

## C–K（t123u–t136u，Grok 接手，t132u 核准）

- 配色「米白暖杏」：`--sky #FAF6F0`、`--sky-2 #F3EADC`、`--card #FFFFFF`、`--gold #A9824E`、`--gold-text #7E5B2C`、`--on-gold #1F1709`、`--rule #EADFCE`（金色按鈕對比 ≥ AA）
- 隱私：活動建立人／發布者看不到信件內容；只有指令碼屬性 `SUPER_ADMIN` 的總管理者看得到。預覽 `?demo=admin`
- 節日／場合獨自一行，與日常左對齊（390／320）
- 21 條恢復本經文出處全部在頁面內換行，依 福音／祝福／愛 分組
- 新增信紙：愛情、牧養、建造；福音符號改為書本，畫面與原始檔皆無十字架
- `img/in-christ.svg` 中央改為鴿子與橄欖枝，保留金色圓印與外圈 IN CHRIST
- LINE 圖卡顯示「已有 XX 個人收到愛」（該活動已送出信件的不重複收信人數，含正要送出的這一封；0 不顯示；發出後不會自動更新）
- 每款主題輕柔原創 CC0 背景音樂（約 28 秒循環、loudnorm −24 LUFS、音量 0.35、點選後才載入）。寫信頁說明「點選主題，會配上相應的背景音樂」；收信頁「🔈 打開聲音聆聽」
- 使用說明與 README 已更新
- 測試：`demo-smoke` 17/17、`no-double-submit` 15/15、`no-cross`、`loved-count`；gitleaks
- 後端需手動把 `Code.gs` 貼回 Apps Script，部署新版本，執行一次 `resetVerseRefs`，並設定 `SUPER_ADMIN`
