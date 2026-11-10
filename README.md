# LINE流通神聖的愛圖卡建立平台

主辦人建立流通神聖的愛活動 → 寫信入口發到 LINE 群組 → 成員（第一次填姓名＋手機）在信紙上寫給收信人的悄悄話、可附照片 → 選朋友或群組送出信封圖卡 → 收信人按「收信」登入，登記姓名與收信人相符才拆得開 → 主辦人後台看誰寫給誰、是否配對成功、信件內容。

- 前端：`index.html`（GitHub Pages，在 LINE 以 LIFF 開啟）；改最上面的 `LIFF_ID`、`GAS_URL`
- 後端：`Code.gs`（Google Apps Script 網頁應用程式，執行身分「我」、存取權「所有人」），貼上後執行一次 `setup()`
- 試算表工作表：名單、流通神聖的愛活動、信件、收信紀錄、發布者（管理員 userId）、隱藏的 登入
- LIFF：Full、scopes openid＋profile、開啟 shareTargetPicker

預覽：`?demo`（主辦人平台）、`?demo=write`、`?demo=bind`、`?demo=letter`、`?demo=wrong`、`?demo=newbie`、`?demo=mydata`
