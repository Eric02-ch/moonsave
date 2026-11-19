# 在私人電腦接續月存

## 取得程式與進度

安裝 Git、Node.js 24+，以及 ChatGPT 桌面 App。在私人電腦登入自己的帳號，開啟終端機：

```sh
git clone https://github.com/Eric02-ch/moonsave.git
cd moonsave
git switch codex/ai-feedback
npm test
npm run dev
```

把這個 moonsave 資料夾加入桌面 App 的本機專案。若原本對話沒有出現，開新對話並貼上：

> 請先閱讀 docs/continue-on-personal-computer.md，接續月存 AI 回饋功能。專案在 codex/ai-feedback 分支。先核對現況與測試；金鑰只能依 OpenAI Developers 的安全流程設定，不要把金鑰或私人財務資料提交到 GitHub。

## 現況

- main：已上線的月回報、帳戶圖表、歷史／草稿資料報告、目標及私人同步。
- codex/ai-feedback：AI 分析的未發布開發分支。已寫好資料預覽、逐次同意、備註選填、伺服器分析端點、同資料快取、每日 5 次與 30 秒間隔限制。
- 已新增資料庫 migration 0001；尚未部署／套用到正式資料庫。
- 40 項自動化測試通過，包含模擬供應商、資料同意、資料指紋、同資料快取與錯誤／限流；尚未執行真實模型驗證。不要把分支視為已可用的線上 AI。
- 尚未建立新的 API 金鑰，沒有任何新金鑰存入公司電腦或儲存庫。使用者已同意建立月存專用金鑰；建立前仍需完成專案選擇及儲存目的地確認。

## AI 接續工作

1. 安裝／確認 OpenAI Developers 外掛，依其 openai-platform-api-key skill 完成安全金鑰流程。
2. 使用目前官方模型文件選定適合短篇財務回顧的模型；OPENAI_MODEL 必須由伺服器設定，不能讓前端指定任意模型。
3. 在私人 Sites 的正式環境設定 OPENAI_API_KEY 為 secret，以及 OPENAI_MODEL；不要將值寫進 source、README、聊天或前端。
4. 完成瀏覽器流程與錯誤狀態驗證；用虛構資料進行必要的真實 API 測試，涉及費用或傳送資料時依既有授權及外掛流程確認。
5. 更新 README 與驗證紀錄，部署私人版、確認 migration 和登入／同步正常，再合併程式。

## 私人網站與資料

- 網址：https://moonsave-cloud-eric02.b0965160656.chatgpt.site/app/
- Sites project_id：appgprj_6afd41bbabd881918a3a77c90b581df1
- audience：保留既有 owner-private 權限。
- 財務資料保存在私人雲端 D1，以登入身分隔離；不隨 Git clone 下載。
- 公司機上的 private-backups 是 repo 外的私人備份，不在 GitHub，不會自動搬到新電腦。需要備份時從私人網站匯出並私下保管。

## 私人版來源與部署

public/ 為共用前端來源；修改後先執行 npm run sync:frontend 更新 cloud/public/app。cloud/ 為私人版伺服器來源。

在新電腦上應透過 Sites 技能讀取相同 project_id，重新取得 source credential 並用 source helper 開啟既有原始碼，不要建立另一個網站。依技能處理依賴、schema migration、建置、原始碼推送與私人部署。

原公司機的 moonsave-cloud 是 Sites 來源 checkout，其 Git 中繼資料不在公開 repo；不需要搬它或任何暫時性部署憑證。新電腦可從既有 Site 重新開啟來源，再將本分支的 cloud/ 變更同步進去。當前主機的 Windows 打包曾失敗，採已推送來源的遠端建置 fallback；新主機仍應先按技能嘗試正常打包。

## 尚待修整

- 部分舊 README／spec 仍寫 AI 未啟用，正式啟用時應一起更新。
- API 端點與介面尚未完成真正模型的端到端驗證；不得宣稱已啟用。
- 維持備註預設不傳、逐次資料同意、金額由程式計算、草稿／未知數字不可當成實際收支。
- 跨裝置 AI 快取雖已由後端支援，前端目前只有本次會話結果快取；如需自動讀取既有 AI 結果，新增只讀端點，不得自動生成或計費。
