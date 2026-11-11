# LINE流通神聖的愛圖卡建立平台

主辦人建立流通神聖的愛活動 → 寫信入口發到 LINE 群組 → 成員（第一次填姓名＋手機）在信紙上寫給收信人的悄悄話、可附照片與恢復本經文 → 選朋友或群組送出信封圖卡 → 收信人按「收信」登入就拆得開（信是私訊給對方的，不比對姓名）。

- 網址（GitHub Pages）：https://isaiahovercomer.github.io/line-love-letter/
- 前端：`index.html`（GitHub Pages，在 LINE 以 LIFF 開啟）；改最上面的 `LIFF_ID`、`GAS_URL`
- 後端：`Code.gs`（Google Apps Script 網頁應用程式，執行身分「我」、存取權「所有人」），貼上後執行一次 `setup()`
- 試算表工作表：名單、流通神聖的愛活動、信件、收信紀錄、發布者（管理員 userId）、經文、共同管理者、隱藏的 登入。共同管理者工作表若還沒有，第一次新增共同管理者時會自動建立，不必為此再執行 setup()。
- 網站總管理者：在 Apps Script「專案設定 → 指令碼屬性」設定 `SUPER_ADMIN`（LINE userId，多位用逗號分隔）。只有總管理者在後台看得到信件內容；活動建立人、共同管理者與發布者只能看誰寫給誰、是否已送出與收信。總管理者可在首頁打開「登記總覽」，查看所有已登記的人（姓名、手機、LINE 名稱、寫信與收信次數，以及若有登記時間），並計算總人數；可複製或截圖。名單不會包含 LINE userId 或登入通行證。活動建立者（與總管理者）可以把已經寫信或已經收信的人加為共同管理者；共同管理者有同樣的後台檢視與管理權限，但不能新增／移除共同管理者，也不能刪除活動。
- LIFF：Full、scopes openid＋profile、開啟 shareTargetPicker

寫信時的信紙分成五類：日常（素雅、晴空、牛皮、薄荷）、節日（新春、除夕、端午、中秋、感恩）、季節（冬季、寒假、暑假）、人生場景（生日、畢業、離別、遠距、重逢、思念、愛情）、召會生活（福音、牧養、建造）。活動首頁卡片、打開活動的寫信頁／收信頁，以及活動後台標題區，會依活動主題帶上淡淡的色調、花邊與背景浮水印（優先用活動的預設信紙；若沒有，再依標題裡的「中秋／端午／除夕／寒假／暑假／感恩／生日／畢業／新春／愛情／牧養／建造／福音／離別（送別）／遠距（遠方）／重逢／思念（想念）」判斷，否則為素雅）。點選主題會配上英文詩歌曲調的純音樂（循環播放、預設音量 0.35，點選後才載入），可停止；收信的人要自己按「打開聲音聆聽」。背景音樂授權與逐首曲目見下方「背景音樂」。LINE 圖卡與活動標題旁邊會顯示「已有 XX 人寫信」「已有 XX 人收到關心」（送出當下的人數，圖卡發出後不會再變）。每個使用者可在首頁或「我的個人資料」查看「我寫過的信」（跨活動、寫給誰、是否已送出或對方已收信）。活動後台有收信人名單（已送出、不重複收信人，可複製或截圖，不含信件內容），以及共同管理者名單（點選已寫信或已收信的人即可新增；還沒打開信的收信人還不能新增）。頁面上不使用十字架圖示或表情符號。

## 信紙存成圖片

拆開的信、「我寫過的信」、寫信頁，以及總管理者在活動後台展開的信，信紙下方都有「📷 存成圖片」：只截信紙的範圍，存成 2 倍解析度的 PNG；手機支援分享時會打開分享選單（可存到相簿或傳給朋友），否則直接下載。寫信頁存的是收信人會看到的樣子（不含輸入框和備選經文按鈕）。截圖用 [modern-screenshot](https://github.com/qq15725/modern-screenshot)（MIT），放在 `lib/`，按下按鈕才載入。

## 背景音樂

除「生日」外，各主題都是**主恢復中英文詩歌（Hymns）裏的詩歌曲調**，純音樂、沒有歌詞。各曲都是約 33–58 秒、單聲道、64 kbps 的循環 MP3，剛好收在第一節唱完的地方（頭尾淡入淡出），放在 `audio/<主題>.mp3`。寫信頁點選主題後才載入，不預先快取；預設音量 0.35、循環播放。使用說明最下方有一行小字署名，其他畫面不另外標示。

授權：

- 曲調本身都是 19 世紀以前的作品，屬公有領域。
- 四部和聲 MIDI 設定都是 Wikimedia Commons 上 Rabanus Flavus（Peter Gerloff）的作品，授權為 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，不必署名，可自由改編。
- 本專案用 [FluidSynth](https://www.fluidsynth.org/) 與 FluidR3_GM 音色庫（MIT 授權）把 MIDI 合成成鋼琴或弦樂兩種音色，再剪成一節。合成出來的錄音同樣以 CC0 釋出。
- 沒有使用台灣福音書房或 Living Stream Ministry 的錄音、歌詞或新曲調（那些有版權）。
- 想換曲時，請只選 Commons 上標示 CC0 或公有領域的 MIDI／錄音；CC BY-SA 的錄音要署名並同樣以 CC BY-SA 釋出，加入前先確認。

「恢復本詩歌」欄是英文詩歌本（hymnal.net）的首數，方便對照。

| 主題 | 檔名 | 詩歌曲調 | 恢復本詩歌 | 曲調作者 | 音色 | 來源 MIDI（CC0） |
|---|---|---|---|---|---|---|
| 素雅 | `rose.mp3` | It Is Well with My Soul（我心靈得安寧） | 英文詩歌第 341 首 | Philip P. Bliss, 1876 | 鋼琴 | https://commons.wikimedia.org/wiki/File:It_Is_Well_with_My_Soul.mid |
| 晴空 | `sky.mp3` | All the Way My Savior Leads Me（救主一路引領我） | 英文詩歌第 701 首 | Robert Lowry | 鋼琴 | https://commons.wikimedia.org/wiki/File:All_the_Way_my_Saviour_Leads_Me.mid |
| 牛皮 | `kraft.mp3` | Abide with Me（求主同住）—— EVENTIDE | 英文詩歌第 370 首 | William H. Monk, 1861 | 鋼琴 | https://commons.wikimedia.org/wiki/File:Bleibe_bei_uns.mid |
| 薄荷 | `mint.mp3` | Amazing Grace（奇異恩典） | 英文詩歌第 313 首 | 美國傳統曲調 | 鋼琴 | https://commons.wikimedia.org/wiki/File:Amazing_grace_(org).mid |
| 冬季 | `winter.mp3` | Hark! the Herald Angels Sing（聽啊，天使高聲唱） | 英文詩歌第 84 首 | Felix Mendelssohn | 鋼琴 | https://commons.wikimedia.org/wiki/File:Hark!_The_Herald_Angels_Sing_.mid |
| 中秋 | `midautumn.mp3` | Abide with Me（求主同住）—— EVENTIDE | 英文詩歌第 370 首 | William H. Monk, 1861 | 弦樂 | https://commons.wikimedia.org/wiki/File:Bleibe_bei_uns.mid |
| 端午 | `duanwu.mp3` | It Is Well with My Soul（我心靈得安寧） | 英文詩歌第 341 首 | Philip P. Bliss, 1876 | 弦樂 | https://commons.wikimedia.org/wiki/File:It_Is_Well_with_My_Soul.mid |
| 除夕 | `chuxi.mp3` | Holy, Holy, Holy（聖哉，聖哉，聖哉）—— NICAEA | 英文詩歌第 6 首 | John B. Dykes, 1861 | 鋼琴 | https://commons.wikimedia.org/wiki/File:Nicaea_(hymn_tune).mid |
| 寒假 | `winterbreak.mp3` | Hark! the Herald Angels Sing（聽啊，天使高聲唱） | 英文詩歌第 84 首 | Felix Mendelssohn | 弦樂 | https://commons.wikimedia.org/wiki/File:Hark!_The_Herald_Angels_Sing_.mid |
| 暑假 | `summer.mp3` | All the Way My Savior Leads Me（救主一路引領我） | 英文詩歌第 701 首 | Robert Lowry | 弦樂 | https://commons.wikimedia.org/wiki/File:All_the_Way_my_Saviour_Leads_Me.mid |
| 聖誕（舊版，選單已撤） | `xmas.mp3` | Hark! the Herald Angels Sing（聽啊，天使高聲唱） | 英文詩歌第 84 首 | Felix Mendelssohn | 弦樂 | https://commons.wikimedia.org/wiki/File:Hark!_The_Herald_Angels_Sing_.mid |
| 新春 | `newyear.mp3` | Holy, Holy, Holy（聖哉，聖哉，聖哉）—— NICAEA | 英文詩歌第 6 首 | John B. Dykes, 1861 | 弦樂 | https://commons.wikimedia.org/wiki/File:Nicaea_(hymn_tune).mid |
| 感恩 | `thanks.mp3` | Amazing Grace（奇異恩典） | 英文詩歌第 313 首 | 美國傳統曲調 | 弦樂 | https://commons.wikimedia.org/wiki/File:Amazing_grace_(org).mid |
| 畢業 | `grad.mp3` | All the Way My Savior Leads Me（救主一路引領我） | 英文詩歌第 701 首 | Robert Lowry | 鋼琴 | https://commons.wikimedia.org/wiki/File:All_the_Way_my_Saviour_Leads_Me.mid |
| 福音 | `gospel.mp3` | Amazing Grace（奇異恩典） | 英文詩歌第 313 首 | 美國傳統曲調 | 鋼琴 | https://commons.wikimedia.org/wiki/File:Amazing_grace_(org).mid |
| 愛情 | `love.mp3` | It Is Well with My Soul（我心靈得安寧） | 英文詩歌第 341 首 | Philip P. Bliss, 1876 | 鋼琴 | https://commons.wikimedia.org/wiki/File:It_Is_Well_with_My_Soul.mid |
| 牧養 | `shepherd.mp3` | All the Way My Savior Leads Me（救主一路引領我） | 英文詩歌第 701 首 | Robert Lowry | 弦樂 | https://commons.wikimedia.org/wiki/File:All_the_Way_my_Saviour_Leads_Me.mid |
| 離別 | `farewell.mp3` | Abide with Me（求主同住）—— EVENTIDE | 英文詩歌第 370 首 | William H. Monk, 1861 | 弦樂 | https://commons.wikimedia.org/wiki/File:Bleibe_bei_uns.mid |
| 遠距 | `distance.mp3` | It Is Well with My Soul（我心靈得安寧） | 英文詩歌第 341 首 | Philip P. Bliss, 1876 | 弦樂 | https://commons.wikimedia.org/wiki/File:It_Is_Well_with_My_Soul.mid |
| 重逢 | `reunion.mp3` | All the Way My Savior Leads Me（救主一路引領我） | 英文詩歌第 701 首 | Robert Lowry | 鋼琴 | https://commons.wikimedia.org/wiki/File:All_the_Way_my_Saviour_Leads_Me.mid |
| 思念 | `missing.mp3` | Abide with Me（求主同住）—— EVENTIDE | 英文詩歌第 370 首 | William H. Monk, 1861 | 鋼琴 | https://commons.wikimedia.org/wiki/File:Bleibe_bei_uns.mid |
| 建造 | `build.mp3` | Holy, Holy, Holy（聖哉，聖哉，聖哉）—— NICAEA | 英文詩歌第 6 首 | John B. Dykes, 1861 | 弦樂 | https://commons.wikimedia.org/wiki/File:Nicaea_(hymn_tune).mid |
| 生日 | `birthday.mp3` | Happy Birthday to You（柔和音樂盒演奏，非詩歌） | — | 傳統旋律 | 音樂盒 | https://commons.wikimedia.org/wiki/File:Happy_birthday_to_you_(Zum_Geburtstag_viel_Gl%C3%BCck).mid |

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
