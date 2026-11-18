# 月存 MoonSave ☾

**每月幾分鐘，把日子慢慢存好。**

[登入私人雲端版](https://moonsave-cloud-eric02.b0965160656.chatgpt.site) · [本機展示版](https://eric02-ch.github.io/moonsave/) · [自動檢查](https://github.com/Eric02-ch/moonsave/actions) · v0.2.0

以「每月財務回報」為核心的手機優先 PWA。輸入收入、帳戶餘額與儲蓄數字，查看備用金進度、信用卡預留缺口與歷史變化，再由回顧助手整理下一步。

這個作品來自一個實際需求：希望保留與 AI 每月回顧財務的習慣，並把數字輸入、歷史紀錄與計算規則做成可持續使用的介面。

![月存桌面總覽，使用虛構示範資料](docs/overview-desktop.jpg)

<details>
<summary>查看手機畫面</summary>

<img src="docs/overview-mobile.jpg" alt="月存手機版總覽，使用虛構示範資料" width="340">

</details>

## 目前可以做什麼

- **月回報**：實領薪資、其他實際收入、主帳戶、備用金、必要支出專用款、信用卡預備金與未繳款、現金與電子錢包。
- **真實確認**：每次標記盤點日期、確認實際餘額，不自動把舊數字當成本月數字。
- **儲蓄追蹤**：基本儲蓄、額外儲蓄、提領使用，分開記錄。
- **目標與花園**：自訂每月儲蓄目標、備用金底線與下一階段目標；小花園隨備用金達成率成長。
- **歷史紀錄**：最近 12 筆淨儲蓄圖表、每月備註、修改與刪除、相鄰月份比較。
- **本機規則月報**：不用 API 金鑰，也能查看依固定規則產生的摘要及最多三項下月行動。
- **選用 AI 回顧**：後端設定完成後，可以針對最近一至三筆回報提問。需要逐次勾選資料傳送同意。
- **草稿與備份**：JSON 備份同時包含正式回報、目標及待確認草稿；未知金額保持留白。
- **私人雲端同步**：使用 ChatGPT 登入，跨瀏覽器同步回報、目標和草稿；按帳號隔離、保留本機快取，版本衝突時不自動覆蓋。
- **PWA**：響應式介面、Web App Manifest、Service Worker 快取。首次成功載入後，可使用已快取的本機功能。

目前以月回報與資金盤點為範圍。尚未提供逐筆收支記帳、銀行串接、投資報價或完整資產管理。

## 快速開始

本機版需要 **Node.js 24 或以上**，沒有第三方執行期依賴，不需要先安裝套件。雲端版的執行環境與部署方式見 [cloud/README.md](cloud/README.md)。

```bash
git clone https://github.com/Eric02-ch/moonsave.git
cd moonsave
npm run dev
```

開啟終端機顯示的 `http://127.0.0.1:4173`，點選「體驗示範資料」，或直接開始第一次回報。

```bash
npm test       # 計算、資料驗證與 HTTP/API 測試
npm run build # 產生 dist/，可放到靜態網站主機
```

Windows 若 PowerShell 阻擋 `npm.ps1`，可使用 `npm.cmd run dev`、`npm.cmd test`。

## 加入 AI 助手

1. 將 `.env.example` 複製為 `.env`。
2. 在 `.env` 設定自己的 OpenAI API 金鑰，以及帳號可用、支援 Responses API 的文字模型 ID。
3. 重新啟動 `npm run dev`，進入「回顧助手」。

```dotenv
OPENAI_API_KEY=你的金鑰
OPENAI_MODEL=你的模型ID
PORT=4173
```

金鑰只在後端使用，`.env` 已排除於 Git。不要把金鑰放進前端、截圖、issue 或 README。

按下分析前，介面會要求同意將最近一至三筆回報（包含備註）、目標與問題傳送至 OpenAI。財務數字由程式先計算，AI 使用這些結果解釋；本機規則月報不會呼叫 OpenAI。

目前每次分析為獨立請求，**不繼承 ChatGPT 帳號的對話記憶，也不儲存 App 聊天紀錄**。API 呼叫使用 `store: false`，這不代表供應商完全不保留任何服務紀錄；實際資料處理依服務條款與帳號設定。

未提供真實金鑰時，測試使用模擬的供應商回應；本版沒有執行付費模型的端到端驗證。

參考：[OpenAI Quickstart](https://developers.openai.com/api/docs/quickstart)、[對話狀態](https://developers.openai.com/api/docs/guides/conversation-state)、[金鑰安全](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)。API 使用與 ChatGPT 訂閱採[分開計費](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform)。

## 數字怎麼算

金額為新台幣整數。每月收入與儲蓄必須採一致的回報期間（例如上次發薪日至這次發薪日），餘額則記錄在實際盤點日期。

| 指標 | 規則 |
| --- | --- |
| 本期收入 | 已入帳薪資＋其他已入帳收入 |
| 回報淨儲蓄 | 本期基本儲蓄＋額外儲蓄－從儲蓄提領用於支出 |
| 回報儲蓄率 | 回報淨儲蓄 ÷ 本期收入；收入為 0 時不計算 |
| 信用卡預留缺口 | max(未繳金額－預備金, 0) |
| 日常可用資金估算 | 主帳戶＋現金與電子錢包－信用卡預留缺口 |
| 現金資產 | 主帳戶＋備用金＋必要支出專用款＋信用卡預備金＋現金與電子錢包 |
| 現金淨額 | 現金資產－信用卡未繳金額 |
| 備用金達成率 | 備用金實際餘額 ÷ 備用金目標 |

每筆資金只能屬於一個餘額分類。把主帳戶轉到備用金不增加總資產；繳信用卡同時減少現金與負債，不會再列一次支出。信用卡預備金雖然是資產，已指定用途，因此不算日常可用資金。

「回報淨儲蓄」依使用者提供的儲蓄流入與提領計算，尚未透過完整收支對帳驗證。**現金淨額不是完整淨資產**：本版未納入投資、其他資產及其他負債。投資漲跌不納入儲蓄成果。資料不足時不產生完整淨資產成長或 A～D 財務評級。

月份比較僅使用緊鄰的上個月；不同盤點日會提醒比較限制，即使同日仍可能有帳期差異。

## 資料與隱私

- 初次開啟沒有個人財務資料；示範數字與 README 截圖皆為虛構資料。
- 本機版已確認紀錄存在瀏覽器 `localStorage` 的 `moonsave.v1`，草稿在 `moonsave.draft.v1`。
- 私人雲端版使用 Sites 登入保護及 Cloudflare D1，資料按登入身分存取；本機快取與同步版本也依帳號區分。不是端對端加密產品，共用裝置上仍需妥善管理登入與瀏覽器資料。
- 更換瀏覽器、網域、通訊埠或清除網站資料，不會自動帶過原有回報。搬家前請匯出 JSON 備份。
- 匯出備份包含財務資訊，請私下保存，勿提交到公開儲存庫。
- App 沒有另加追蹤分析服務或外部字型載入。AI API 只在主動送出且同意後呼叫；雲端同步版目前未啟用付費 AI。
- **公開 GitHub 只包含程式碼、文件及虛構示範數字；個人財務資料、備份、D1 實例內容及登入憑證都不在儲存庫裡。**
- 遇到損壞的已存資料時，介面暫停寫入，避免默默覆蓋；可先透過瀏覽器開發工具保留原始內容。

## 架構與技術選擇

採用原生 JavaScript ES Modules、HTML、CSS 與 Node.js，避免第一個作品花大量時間在框架設定；同時保留容易理解與測試的邏輯分層。

```text
public/
  index.html            頁面入口與語意化導覽
  app.js                畫面、表單、草稿、備份及 AI 互動
  core.js               純函式：驗證、計算、比較、規則月報
  styles.css            桌面與手機介面、CSS 花園
  sw.js                 快取本機 App；不快取 API 回覆
  manifest.webmanifest  PWA 設定
server.mjs              本機靜態伺服器與選用的 AI 後端
test/                   Node 內建測試
scripts/build.mjs       產生靜態部署目錄
docs/                   截圖、產品決策與驗證紀錄
.github/workflows/      GitHub 自動檢查與靜態網站部署
```

後端只監聽 `127.0.0.1`，並驗證 Host、Origin、請求大小、欄位與每分鐘次數。這是**本機開發用的 AI 代理**，尚未具備公開服務需要的使用者登入、伺服器端配額、分散式限流與監控，請勿直接公開金鑰端點。

## 部署與手機使用

`npm run build` 產生的 `dist/` 可部署到 GitHub Pages 等 HTTPS 靜態主機。所有資源使用相對路徑，支援 `/moonsave/` 子目錄。

儲存庫附有 GitHub Pages 工作流程：在儲存庫 **Settings → Pages → Source** 選擇 **GitHub Actions**，接著推送 `main` 或手動執行 **Deploy PWA**。靜態部署提供完整本機回報與規則月報，**不包含 Node AI 端點**。

手機開啟 HTTPS 網站後，可使用瀏覽器的「加入主畫面」或相應安裝功能。不同平台對 PWA 安裝、SVG 圖示與離線行為的支援不同；目前沒有發布至 App Store／Google Play，也尚未在實體 iOS／Android 裝置驗證。

## 開發與學習 GitHub

建議每項功能開一個 issue，建立 `codex/功能名稱` 或自己的功能分支，修改後執行測試，再開 pull request。

```bash
git switch -c codex/monthly-expenses
# 修改檔案
npm test
npm run build
git add .
git commit -m "feat: add monthly expense categories"
git push -u origin codex/monthly-expenses
```

提交時確認沒有 `.env` 或真實財務備份。自動檢查會在 push 與 pull request 執行測試和建置。

## 後續方向

- [ ] 月支出分類與收支對帳，保留不逐筆記帳的使用方式。
- [ ] 分開記錄各電子錢包與自訂帳戶。
- [ ] 明確的發薪週期與信用卡結帳／扣款時間線。
- [ ] 三個月趨勢摘要與年度回顧。
- [x] 私人帳號登入與跨瀏覽器同步。
- [ ] 使用者管理的加密備份。
- [ ] 有成本控制的正式 AI 服務與可攜式助手背景設定。
- [ ] 投資資產與負債管理，獨立於薪資儲蓄成果。

詳見 [產品決策](docs/product-decisions.md) 與 [驗證紀錄](docs/verification.md)。
