# LINE流通神聖的愛圖卡建立平台

主辦人建立流通神聖的愛活動 → 寫信入口發到 LINE 群組 → 成員（第一次填姓名＋手機）在信紙上寫給收信人的悄悄話、可附照片與恢復本經文 → 選朋友或群組送出信封圖卡 → 收信人按「收信」登入，登記姓名與收信人大致相符（可加稱謂或用小名）就拆得開。

- 網址（GitHub Pages）：https://isaiahovercomer.github.io/line-love-letter/
- 前端：`index.html`（GitHub Pages，在 LINE 以 LIFF 開啟）；改最上面的 `LIFF_ID`、`GAS_URL`
- 後端：`Code.gs`（Google Apps Script 網頁應用程式，執行身分「我」、存取權「所有人」），貼上後執行一次 `setup()`
- 試算表工作表：名單、流通神聖的愛活動、信件、收信紀錄、發布者（管理員 userId）、經文、共同管理者、隱藏的 登入。共同管理者工作表若還沒有，第一次新增共同管理者時會自動建立，不必為此再執行 setup()。
- 網站總管理者：在 Apps Script「專案設定 → 指令碼屬性」設定 `SUPER_ADMIN`（LINE userId，多位用逗號分隔）。只有總管理者在後台看得到信件內容；活動建立人、共同管理者與發布者只能看誰寫給誰、是否已送出與收信。活動建立者（與總管理者）可以把已經寫信或已經收信的人加為共同管理者；共同管理者有同樣的後台檢視與管理權限，但不能新增／移除共同管理者，也不能刪除活動。
- LIFF：Full、scopes openid＋profile、開啟 shareTargetPicker

寫信時可選日常或節日／場合信紙（含愛情、牧養、建造、福音等）。活動首頁卡片、打開活動的寫信頁／收信頁，以及活動後台標題區，會依活動主題帶上淡淡的色調、花邊與背景浮水印（優先用活動的預設信紙；若沒有，再依標題裡的「中秋／端午／除夕／寒假／暑假／感恩／生日／畢業／新春／愛情／牧養／建造／福音」判斷，否則為素雅）。點選主題會配上輕柔背景音樂（循環播放、預設音量 0.35，點選後才載入），可停止；收信的人要自己按「打開聲音聆聽」。背景音樂授權與逐首曲目見下方「背景音樂」。LINE 圖卡與活動標題旁邊會顯示「已有 XX 人寫信」「已有 XX 個人收到愛」（送出當下的人數，圖卡發出後不會再變）。每個使用者可在首頁或「我的個人資料」查看「我寫過的信」（跨活動、寫給誰、是否已送出或對方已收信）。活動後台有收信人名單（已送出、不重複收信人，可複製或截圖，不含信件內容），以及共同管理者名單（點選已寫信或已收信的人即可新增；還沒打開信的收信人還不能新增）。頁面上不使用十字架圖示或表情符號。

## 背景音樂

各主題曲都是約 51 秒、單聲道、約 64 kbps 的循環 MP3（頭尾淡入淡出），放在 `audio/<主題>.mp3`。新增場合沿用既有曲目，不另外下載。舊版「聖誕」音檔仍保留，供既有活動播放。寫信頁點選主題後才載入，不預先快取；預設音量 0.35、循環播放。使用說明最下方有一行小字署名，其他畫面不另外標示。

除「生日」外，錄音皆為 [Kevin MacLeod / incompetech.com](https://incompetech.com/music/royalty-free/faq.html)，官方授權為 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，必須署名，可商用、可剪輯。建議署名格式（官方 FAQ）：

```
"曲名" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0
https://creativecommons.org/licenses/by/4.0/
```

各曲官方頁：`https://incompetech.com/music/royalty-free/index.html?isrc=……`。即使旋律是公有領域（例如薩替、聖誕歌曲、聖詩、巴哈），這些錄音本身仍須依 CC BY 4.0 署名，不可當成 CC0。

生日主選：旋律為公有領域；MIDI 設定為 CC0 1.0（Wikimedia Commons，Rabanus Flavus / Peter Gerloff），不必署名。

| 主題 | 檔名 | 曲名 | 作者／來源 | 授權 | 官方頁／來源 |
|---|---|---|---|---|---|
| 素雅 | `rose.mp3` | Gymnopedie No. 1 | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100787 |
| 晴空 | `sky.mp3` | Fresh Air | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500084 |
| 牛皮 | `kraft.mp3` | Windswept | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100757 |
| 薄荷 | `mint.mp3` | Enchanted Journey | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100799 |
| 冬季 | `winter.mp3` | Winter Chimes | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100009 |
| 中秋 | `midautumn.mp3` | Enchanted Journey（與薄荷相同錄音） | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100799 |
| 端午 | `duanwu.mp3` | Water Lily（與感恩相同錄音） | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400035 |
| 除夕 | `chuxi.mp3` | Morning（與新春相同錄音） | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN2300003 |
| 寒假 | `winterbreak.mp3` | Winter Chimes（與冬季相同錄音） | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100009 |
| 暑假 | `summer.mp3` | Fresh Air（與晴空相同錄音） | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500084 |
| 聖誕（舊版，選單已撤） | `xmas.mp3` | Silent Night | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100075 |
| 新春 | `newyear.mp3` | Morning | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN2300003 |
| 感恩 | `thanks.mp3` | Water Lily | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400035 |
| 畢業 | `grad.mp3` | Dreams Become Real | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500027 |
| 生日 | `birthday.mp3` | Happy Birthday to You（柔和音樂盒演奏） | 傳統旋律；MIDI 設定：Rabanus Flavus (Peter Gerloff) | 旋律為公有領域；MIDI 為 CC0 1.0，不必署名 | https://commons.wikimedia.org/wiki/File:Happy_birthday_to_you_(Zum_Geburtstag_viel_Gl%C3%BCck).mid |
| 福音 | `gospel.mp3` | Amazing Grace 2011 | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100820 |
| 愛情 | `love.mp3` | There is Romance | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100044 |
| 牧養 | `shepherd.mp3` | The Forest and the Trees | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100766 |
| 建造 | `build.mp3` | Prelude in C (BWV 846) | Kevin MacLeod (incompetech.com) | CC BY 4.0 | https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100689 |

## 更新步驟

- 前端：推到 `main` 後 GitHub Pages 會自動更新。改了 `sw.js` 的快取清單時，記得把 `CACHE` 版本號加一。
- 後端：**改了 `Code.gs` 不會自動生效**。要把內容貼回試算表的「擴充功能 → Apps Script」，再「部署 → 管理部署作業 → 編輯 → 版本：新版本 → 部署」（沿用同一個部署，網址不變）。若經文欄還是空的，在編輯器執行一次 `resetVerseRefs`（只填空白，不覆蓋已貼的經文）。若尚未設定總管理者，請加上指令碼屬性 `SUPER_ADMIN`。

## 預覽與測試

預覽：`?demo`（主辦人平台）、`?demo=admin`（網站總管理者，看得到信件內容）、`?demo=coadmin`（共同管理者，看得到後台但沒有信件內容，也不能新增其他人）、`?demo=write`、`?demo=bind`、`?demo=letter`、`?demo=wrong`、`?demo=newbie`、`?demo=mydata`、`?demo=mine`（我寫過的信）；加 `&noguide` 不跳使用說明。
`letter`、`wrong`、`newbie` 先顯示信封，按「收信」才進入對應狀態。

煙霧測試（只開預覽頁、不連後端）：在 repo 根目錄開一個靜態伺服器，例如 `python3 -m http.server 18765`，然後

```sh
NODE_PATH=<有安裝 playwright 的 node_modules> BASE_URL=http://127.0.0.1:18765/ node tests/demo-smoke.mjs
node tests/no-cross.mjs
node tests/loved-count.mjs
node tests/coadmin.mjs
node tests/bgm.mjs
node tests/themes.mjs
```

加 `SHOTS_DIR=_shots` 會順便存 `after-*.png` 截圖（`_shots/` 已在 `.gitignore`，不會被提交）。
