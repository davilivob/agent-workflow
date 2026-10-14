Status: done
Merge: ask
Plan: no
Execute: inline

# deploy-check

## Problem Statement

`deploy-ec2-template` 讓 agent 在發起會碰到 Deploy paths 的 push 之前先問 Owner，但 push 一出去，agent 就不再過問。部署到底有沒有成功，Owner 得自己去 GitHub Actions 看；線上網站有沒有真的換成新版、打不打得開，也得自己去開瀏覽器確認。

範本 CI 的最後一步只在主機上對 `localhost:<port>` 做 liveness curl。CI 綠燈只代表容器有起來，不代表外面連得到：DNS、reverse proxy、TLS 任何一段壞掉，CI 照樣是綠的。

## Solution

- agent 發起、碰到 Deploy paths 的 push 一旦推送成功，agent 預設接著做 **Deploy check**：盯這次 push 觸發的 GitHub Actions run，直到有結論。
- Deploy check 成功，且 `project.md` 的部署那一條寫了 **Production URL** 時，agent 接著做 **Production check**：用內建瀏覽器實際打開線上網址，像訪客一樣只讀不寫地核實。
- 兩個結果分開回報，失敗時附上證據並在本機開始查原因；不自動重跑、不 rollback。
- `/sync-workflow` 負責讓 `project.md` 有地方寫 Production URL，新 repo 在設定時問，已 sync 過的 repo 在下次 sync 時補問。

## User Stories

1. 身為 Owner，我要 agent 在它發起、碰到 Deploy paths 的 push 推送成功後，自動盯部署 run 到有結論，這樣我不用自己去 GitHub Actions 看。
2. 身為 Owner，我要 Deploy check 看的是這次 push 的 head commit 觸發的所有 run，全部成功才算成功，這樣 CI 測試失敗也會被算成部署失敗。
3. 身為 Owner，我要 Deploy check 在背景進行，agent 可以同時做別的事，這樣等部署的幾分鐘不會整個 session 卡住。
4. 身為 Owner，我要 agent 在 Deploy check 有結論之前，不把這次工作回報為完成，這樣我看到「完成」時部署結果已經在裡面了。
5. 身為 Owner，我要 Deploy check 盯超過 20 分鐘還沒結論時回報 Unknown 並附 run 網址，而不是當作成功，這樣卡住的部署不會被誤報。
6. 身為 Owner，我要我自己手動 push 的不被檢查，這樣 agent 不會為了它沒發起的部署在每個 session 開場多跑查詢。
7. 身為 Owner，我要 Production check 只在 `project.md` 寫了 Production URL 時才做，這樣純後端、沒有線上頁面的專案不會被多做一步。
8. 身為 Owner，我要 Production check 用內建瀏覽器打開每一個 Production URL，確認頁面有載入、console 沒有 error，並截圖，這樣我知道外面真的連得到。
9. 身為 Owner，我要這次改動在畫面上看得到時（文案、UI、新頁面），agent 實際在線上找到它，這樣我知道線上跑的是新版，而不只是「網站還活著」。
10. 身為 Owner，我要 Production check 在頁面打不開時先在約 1 分鐘內重試，再判定失敗，這樣容器剛重啟的空窗不會造成誤報。
11. 身為 Owner，我要 Production check 只做讀取：GET 與瀏覽、點連結可以，登入、送出表單、任何寫入、SSH 上主機都不做，這樣核實本身不會變成一次 production 寫入。
12. 身為 Owner，我要需要登入才看得到的頁面只驗公開的部分，並在回報裡說哪些沒驗到，這樣我知道核實的範圍。
13. 身為 Owner，我要回報裡 Deploy check 和 Production check 各一行結果（含 run 網址），截圖用 `SendUserFile` 傳給我，這樣我在手機上也看得到。
14. 身為 Owner，我要 Deploy check 失敗時，agent 回報失敗的 step 和 log 摘要；Production check 失敗時附上截圖和 console 內容，這樣我不用自己去翻 log。
15. 身為 Owner，我要失敗後 agent 在本機用 `diagnosing-bugs` 開始查原因，但不碰 production，這樣排查不必等我開口。
16. 身為 Owner，我要 agent 不自動重跑部署，重跑前像 push 一樣先用 `AskUserQuestion` 問我，只有失敗看起來是暫時性的（例如 registry 逾時）才主動提議，這樣每一次部署都經過我同意。
17. 身為 Owner，我要 agent 永遠不做 rollback，這樣 production 的回退永遠由我決定。
18. 身為 Owner，我要 Deploy check 成功但 `project.md` 沒有 Production URL 時，回報裡有一行提醒，說跳過了 Production check、可以跑 `/sync-workflow` 補上，這樣我知道還有一段沒被驗。
19. 身為 Owner，我要 `/sync-workflow` 在新 repo 或既有 repo 設定時，於我回答 push 會部署之後，一併問 Production URL（可以多個、可以留空），這樣新專案一開始就有。
20. 身為 Owner，我要已 sync 過的 repo 在下次 `/sync-workflow`（update 模式）時，若部署那一條沒寫 Production URL，被問一次，這樣 dvtp-2026、firehose 這些舊 repo 也補得上。
21. 身為 Owner，我要我回答「沒有 Production URL」時，這個答案也寫進 `project.md`，這樣之後每次 sync 不會一直問。
22. 身為 Owner，我要 agent 不會自己去改 `project.md` 補 URL，只透過 `/sync-workflow` 問我，這樣 `project.md` 的內容都經過我。
23. 身為 Owner，我要一個 repo 部署多個服務時（例如前台和 admin）可以列多個 Production URL，Production check 對每個各跑一次，這樣每個服務都被驗到。

## Implementation Decisions

- **`workflow.md`（Owner boundary 段，接在 Deploy paths 的 push 前提問之後）**新增一段 push 之後的規則：
  - 觸發：agent 發起、碰到 Deploy paths、Guard 放行且推送成功的 push。push 被拒或 Owner 在提問時說不，就沒有 Deploy check。
  - Deploy check：用 `gh` 找出這次 push 的 head SHA 觸發的所有 run（中間的 commit 不會觸發 run），在背景盯到結論；全部 `success` 才算成功；20 分鐘沒結論為 Unknown。`gh` 失敗（沒登入、離線）也是 Unknown，不是成功。
  - Production check：只在 Deploy check 成功、且 owner-boundary 那一條有 Production URL 時做；每個 URL 各做一次；頁面載入、console 無 error、截圖；看得到的改動要在線上找到；打不開時約 1 分鐘內重試。
  - 讀寫的界線照 User Stories 11、12，寫在這一段裡。
  - 失敗處理照 User Stories 14–17。重跑部署（`workflow_dispatch` 或 re-run）等同一次部署，比照 push 前提問。
  - 回報與證據照 User Stories 13、18。「完成」的回報要等 Deploy check（以及有做的 Production check）有結論。
  - 結果只在回報裡，不寫進 spec 或其他檔案：部署發生在 merge 之後，spec 已經是 `done`。
- **`project.md` 的部署那一條**格式延伸：在既有的結尾後加 `, Production URL <url>`（多個用逗號分隔），或 `, no Production URL`。EC2 的例子：「— deploys to EC2, host <host>, port <port>, Production URL https://…」。`templates/project.md` 的說明行（目前說明 host 與 port 的那一行）一併提到 Production URL。
- **`/sync-workflow`**：
  - 第 2 節（new、existing）：Owner 回答 push 會部署時，原本追問 Deploy paths 與「是否部署到 EC2」的那個 `AskUserQuestion` 加一題 Production URL：「Other」填一個或多個 URL，或選「沒有」。寫入 `{{PRODUCTION}}` 那一條時照上面的格式。
  - update 模式：新增一步，讀 `project.md` 的 Owner boundary；若有「deploys to」的那一條、但既沒有 `Production URL` 也沒有 `no Production URL`，用一個 `AskUserQuestion` 問 URL 或「沒有」，把答案附加到那一條，跟這次 sync 的其他變更一起顯示、一起 commit。已經有其中之一的，不問。
- **`CONTEXT.md`**：已在 grill 中加入 **Production URL**、**Deploy check**、**Production check**，並把 **Unknown** 放寬為「無法確認的狀態，永遠不等於通過」。
- Guard 不變：它不讀 Deploy paths，也不參與 Deploy check。

## Testing Decisions

- 好的測試只看外部行為：sync 之後 `project.md` 寫了什麼、agent 在 push 之後做了什麼、回報了什麼，不看規則文字怎麼措辭。
- **`/sync-workflow`**：在 scratchpad 的 throwaway repo 手動跑，保留輸出：
  - new 模式、會部署、填兩個 URL → 部署那一條結尾有兩個 Production URL。
  - new 模式、會部署、選「沒有」→ 結尾是 `no Production URL`。
  - update 模式、部署那一條沒有 URL → 問一次，附加後跟 sync 一起 commit。
  - update 模式、已有 `no Production URL` → 不問。
- **Deploy check 與 Production check（只讀演練）**：拿 firehose 最近一次真實部署（由 Owner 確認可以用）照新規則走一遍，不 push、不重跑：用它最近一次 deploy 的 head SHA 找 run、判斷結論；再對它的線上網址做一次 Production check 並截圖。驗的是規則能照字面執行，不是驗部署本身。
- **待真實部署驗**：真正由 push 觸發的完整流程（背景盯 run、完成回報等結論、失敗處理），要等下一次有 Deploy paths 的真實 push 才會第一次跑到。在 spec 的 `## Comments` 記一行待驗；第一次真實跑過時，由那個 session 補上結果。
- 驗證指令照 `project.md`：`sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`。這次沒改 Guard 與 drift，它們應保持全綠。

## Out of Scope

- Owner 自己手動 push 觸發的部署。
- 不走 GitHub Actions 的部署（Vercel 等）、GitLab，以及 `project.md` 自訂檢查指令。
- 要求 app 提供版本端點（例如 `/version` 回傳 SHA）。
- 自動重跑部署、rollback。
- 登入後頁面的核實、任何表單送出。
- SSH 上主機看 container log。
- 修正 dvtp-2026 目前的部署失敗（在它自己的 repo 處理）。
- 把結果寫進 spec 或任何檔案。

## Further Notes

- 建立在 `deploy-ec2-template` 已 merge 的 push 前提問上，那份已在 `main`，所以不需要 `After:`。
- 只讀演練用的是 firehose 的真實線上網址；它是讀取，不是 production 寫入，但開始前仍要 Owner 確認那個網址可以用。

## Comments

- 待真實部署驗：由 push 觸發的完整 Deploy check 與 Production check。
