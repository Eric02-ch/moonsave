# 月存私人雲端執行環境

此目錄是使用官方 Sites Vinext 樣板建置的完整可部署原始碼，不包含私人財務資料或執行中的資料庫。

登入由 Sites 的 Sign in with ChatGPT 提供；Cloudflare D1 只以伺服器取得的登入 user ID 讀寫每個帳號自己的快照。API 拒絕跨站寫入、帳號切換與落後的版本。資料結構與遷移在 db/ 及 drizzle/；所有測試使用虛構資料。

## 本機開發

需要 Node.js 24。

```bash
cd cloud
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_violet_beyonder.sql
npm run dev
```

本機預覽使用官方樣板的開發登入，並非真實 ChatGPT 帳號。開發登入不會進入正式部署。

```bash
node --test test/sync.test.mjs
```

public/app/ 是根目錄 public/ 的部署快照；修改共用前端後，需更新兩個目錄。本機版與雲端版共用同一份驗證與計算規則。

## 正式部署

遵循 Sites 技能工作流程。此專案的 .openai/hosting.json 綁定原始 Site；fork 後若要建立自己的 Site，必須先移除原 project_id，重新取得自己的 Site 身分。不得對他人的 Site ID 部署。

Sites 會套用 drizzle/ 中的資料結構遷移並連接 D1。不得在請求處理時建立資料表，也不要把本機 .wrangler/ 或財務 JSON 備份提交到 GitHub。

回報、草稿與目標都在私人 D1；GitHub 只放原始碼。AI 後端是根目錄的選用本機功能，目前私人雲端版未啟用付費 AI。