# LINE流通神聖的愛圖卡建立平台

主辦人建立流通神聖的愛活動 → 寫信入口發到 LINE 群組 → 成員（第一次填姓名＋手機）在信紙上寫給收信人的悄悄話、可附照片 → 選朋友或群組送出信封圖卡 → 收信人按「收信」登入，登記姓名與收信人相符才拆得開 → 主辦人後台看誰寫給誰、是否配對成功、信件內容。

- 網址（GitHub Pages）：https://isaiahovercomer.github.io/line-love-letter/
- 前端：`index.html`（GitHub Pages，在 LINE 以 LIFF 開啟）；改最上面的 `LIFF_ID`、`GAS_URL`
- 後端：`Code.gs`（Google Apps Script 網頁應用程式，執行身分「我」、存取權「所有人」），貼上後執行一次 `setup()`
- 試算表工作表：名單、流通神聖的愛活動、信件、收信紀錄、發布者（管理員 userId）、經文、隱藏的 登入
- LIFF：Full、scopes openid＋profile、開啟 shareTargetPicker

## 更新步驟

- 前端：推到 `main` 後 GitHub Pages 會自動更新。改了 `sw.js` 的快取清單時，記得把 `CACHE` 版本號加一。
- 後端：**改了 `Code.gs` 不會自動生效**。要把內容貼回試算表的「擴充功能 → Apps Script」，再「部署 → 管理部署作業 → 編輯 → 版本：新版本 → 部署」（沿用同一個部署，網址不變）。

## 預覽與測試

預覽：`?demo`（主辦人平台）、`?demo=write`、`?demo=bind`、`?demo=letter`、`?demo=wrong`、`?demo=newbie`、`?demo=mydata`；加 `&noguide` 不跳使用說明。
`letter`、`wrong`、`newbie` 先顯示信封，按「收信」才進入對應狀態。

煙霧測試（只開預覽頁、不連後端）：在 repo 根目錄開一個靜態伺服器，例如 `python3 -m http.server 18765`，然後

```sh
NODE_PATH=<有安裝 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/demo-smoke.mjs
```

加 `SHOTS_DIR=_shots` 會順便存 `after-*.png` 截圖（`_shots/` 已在 `.gitignore`，不會被提交）。
