# RESULT — line-love-letter 第一輪優化（2026-11-10）

## 現況
- 分支：`feat/t120u-first-polish`（從 main @ 70a8001 開出），已 push。
- PR：https://github.com/isaiahovercomer/line-love-letter/pull/1 （**未 merge、未 push main、未部署**）
- **Code.gs 有改動：合併後需由 Isaiah 把 Code.gs 貼回 Apps Script 並重新部署（新版本）**，否則後端修正不會生效。

## 改進清單
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

## 待 Isaiah 決定（刻意沒改）
1. 收信只比對姓名：任何人可用收信人姓名＋任意手機自行登記並拆信；信被收過後同名者仍可再開。建議：名單預先建立才能綁定，或收過後只限第一位收信人。
2. 刪信／刪個人資料不會刪雲端硬碟照片（照片為「知道連結者可看」）。建議刪信時一併丟垃圾桶。
3. 主辦人後台可看信件內容，寫信頁目前未告知（先前刻意拿掉提示）。
4. 任何登入者可建立活動、上傳照片，無頻率／容量限制。
5. `index.html` 的 `LIFF_ID`、`GAS_URL` 為公開前端必要常數，未動；是否旋轉由 Isaiah 決定。
6. 小細節：封蠟會蓋到信封上的「To.」；「送出」按鈕連點可能開兩次選單。

## 截圖
改後：`/workspace/line-love-letter/_shots/after-home.png`、`after-home-noguide.png`、`after-write.png`、`after-write-noguide.png`、`after-bind.png`、`after-letter.png`、`after-letter-opened.png`、`after-wrong-opened.png`、`after-newbie-opened.png`、`after-mydata.png`；另有 `check-flap-mid.png`（拆信動畫中途，確認標題沒被蓋）。
改前：同資料夾 `before-*.png`。`_shots/` 已列入 `.gitignore`，未提交。

## gitleaks（--redact）
- `gitleaks git --no-banner --redact -v .`：15 commits scanned，**no leaks found**。
- `gitleaks dir --no-banner --redact`：index.html、Code.gs、sw.js、README.md、.gitignore、tests/ 皆 **no leaks found**。

## 測試結果
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
