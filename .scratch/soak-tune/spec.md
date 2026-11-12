Status: done
Merge: ask
Plan: no
Execute: inline
Overlaps: ux-probe — low: 兩份都把 `probe` 加進 `global.md` 的 Phase 清單，改的是同一行的同一個字；後 merge 的一方看到已經加上就跳過。

# soak-tune

## Problem Statement

專案的參數，例如連線池大小、timeout、批次大小、快取容量、worker 數量，通常是第一次寫的時候隨手設的，之後就沒人動過。要知道哪個值比較好，得反覆改設定、施加負載、看數據、再改，或者讓它長時間跑，看會不會慢慢漏記憶體、慢慢變慢。這件事很花時間，Owner 得一直守在旁邊，所以通常就不做了。

## Solution

新增 kit skill `/soak-tune`，主要面向是長時間運轉。

1. agent 先讀專案，提出要調的參數和範圍、目標指標、施加負載的方式，以及它認為理想的時長。
2. Owner 給出自己的時間預算，雙方來回討論後定案。
3. 之後 agent 無人值守地在一個用完即丟的 worktree 裡起服務、改參數、施壓或長時間運轉、收數據。先粗掃，再細調。預算用完或結果收斂就停。

最後產出一份 **Probe report**，放在 `.scratch/<slug>/report.md`，附上每輪指標的 CSV。報告只提建議，Owner 要採用哪些，再走 grill 變成 spec。

## User Stories

1. As the Owner, I want the agent to read the project and propose which parameters are worth tuning, so that I do not have to list them myself.
2. As the Owner, I want each proposed parameter to come with its current value and a range to try, so that I can judge whether the search is sensible.
3. As the Owner, I want the agent to propose the metrics that define "better" (latency percentiles, throughput, error rate, memory, CPU), so that the run optimises for something I agreed to.
4. As the Owner, I want the agent to propose how load is applied, or that the run is a long soak instead of a burst, so that the test fits what the project actually does.
5. As the Owner, I want the agent to propose an ideal duration with its reasoning, and to set it against my own time budget, so that we agree on a duration before anything starts.
6. As the Owner, I want to adjust parameters, ranges, metrics and duration in that discussion, so that the run matches what I care about.
7. As the Owner, I want nothing asked once the plan is agreed, so that I can walk away for hours.
8. As the Owner, I want the run limited to local services and a test environment I named, so that nothing ever loads production.
9. As the Owner, I want parameters changed only in a throwaway worktree and never committed, so that the run leaves no stray changes in my repo.
10. As the Owner, I want the machine kept awake during the run, so that a long soak is not cut off by sleep.
11. As the Owner, I want a coarse sweep first and refinement around the best region after, so that the time budget goes where it matters.
12. As the Owner, I want the run to stop when the budget is spent or results converge, so that it never runs forever.
13. As the Owner, I want load and measurement to run in the background while the agent wakes only between rounds, so that hours of running do not fill the session's context.
14. As the Owner, I want a parameter set that crashes the service recorded as a finding, then the service restored and the run continued, so that one bad value does not end the run.
15. As the Owner, I want the run to end early with a report if the service cannot be restored, so that I still get what was learned.
16. As the Owner, I want the run to stop with a failure-only report if the app cannot be started at all, so that I learn why instead of getting nothing.
17. As the Owner, I want the report to state the setup and scope, observations with their evidence, ranked recommendations each with expected effect and confidence, and what was not verified, so that every report reads the same way.
18. As the Owner, I want per-round metrics committed as a small CSV next to the report, so that I can recheck the evidence from any device.
19. As the Owner, I want the report committed to `main` and pushed as the Push policy says, so that it reaches my other devices like any other change.
20. As the Owner, I want a notification when the run ends, so that I know the report is ready.
21. As the Owner, I want the report to recommend and never decide, so that adopting a value goes through a grill like any change.
22. As the Owner, I want the run to stop iterating past the Context limit and write the report with what it has, so that a long run still ends cleanly.
23. As the Owner, I want `/soak-tune` usable only when I run it, so that no session starts hours of load on its own.

## Implementation Decisions

- 新增 kit skill `soak-tune`，`setup.sh` 現有邏輯會自動連結，設 `disable-model-invocation: true`。寫法比照 `/drain`：分節，每節有 "Done when"。Session title 的 Phase 用新的 `probe`，兩個 probe skill 共用。`CONTEXT.md` 的 **Phase** 已在 spec commit 時加上，這份 spec 要把它加進 `global.md` 的 Phase 清單，`batch` 之後。
- **只用一個主持 session 搭配 subagent**，不用多 session 協作。長時間的部分靠背景程序撐過好幾輪，不靠另外開 session。
- **環境邊界**：只在本機，或 Owner 在討論時明確點名的測試主機（名稱要帶 staging、dev、test 之類的標記）。永遠不碰 production，也不能由 agent 推斷某台主機是測試環境。
- **1. 提案**：agent 讀 config、程式碼和 README，提出參數（目前值、建議範圍）、目標指標、施壓或長跑方式、理想時長和理由。
- **2. 討論與確認**：Owner 給時間預算，來回討論直到定案。定案時的回答就是 workflow「Say where the authorization came from」要引用的句子。從這裡開始不再發問，有疑問就寫進報告。
- **3. 執行**：
  - 開一個用完即丟的 worktree：`git worktree add --detach .claude/worktrees/<slug>`，不開 branch。它就是這次的 Claim，`/next` 會列成 In progress。參數改在這個 worktree 的 config 或環境變數裡，一律不 commit。
  - 開跑時用 `request_keep_awake` 防止機器睡眠。
  - 啟動方式：先找專案的 `.claude/launch.json` 或 `run` skill；起不來就停下，直接寫只有失敗原因的報告。
  - 負載和量測丟到背景程序跑，數據寫成檔案。主持 session 只在每一輪結束時醒來讀結果、決定下一輪。
  - 策略：先粗掃，每個參數抽幾個點；再在表現好的區域細調。預算用完或結果收斂就停。
  - 服務被某組參數弄掛：記成一條觀察，還原後繼續。還原失敗：提早結束，寫報告。
  - Context limit：跟 Batch run 一樣是 200k，超過就不開新的一輪，用已有的數據寫報告，沒跑到的範圍列進「沒驗證到的地方」。
- **4. 報告**：
  - 位置是 `.scratch/<slug>/report.md`，slug 取 `soak-tune-<主題>`；目錄已存在就在後面加日期。
  - 固定段落：設定與範圍 / 觀察（附證據）/ 建議（排序，每條附預期效果與把握程度）/ 沒驗證到的地方。本文用繁體中文。
  - 每輪的指標存成 `runs.csv` 放在同一個目錄。
  - commit 照 workflow **Commits** 的規則進 `main`，訊息是 `[<slug>] report: ...`。push 照 Push policy：`ask` 在最後的訊息提議、`auto` 直接推。Deploy paths 照 workflow 比對。
  - 收尾：移除 worktree，發 `PushNotification`。最後的訊息附上報告路徑、最重要的幾條建議，以及 `global.md` 要求的 commit 清單與 push 行。
- `/next` 不新增「Probe reports」這一組。
- `CONTEXT.md` 的 **Probe report** 在 grill 時已寫好，跟 `drain-parallel` 那份 spec 一起 commit。

## Testing Decisions

- 這個 seam 就是 `/soak-tune` skill 本身。在 scratchpad 建一個用完即丟的 repo，裡面放一個有可調參數的玩具 HTTP 服務，例如有可設定 worker 數或人為延遲的小服務。依照這個 worktree 裡的 `skills/soak-tune/SKILL.md` 實際跑一次，預算定在 10 分鐘左右。
- 要確認：提案涵蓋參數、指標、負載方式和理想時長；確認之後不再發問；worktree 沒有 branch、沒有 commit 任何參數修改；有 `runs.csv`，報告四個段落齊全；至少一組參數讓服務出錯時有被記錄並還原；收尾時 worktree 已移除。
- 另外跑一次 app 起不來的情況，確認只產出失敗原因的報告。
- 保留報告、CSV 和對話輸出作為證據。再跑 `project.md` 的 Verification 指令。
- 先例：`.scratch/drain/spec.md` 和 `.scratch/request-watch/spec.md` 的「在用完即丟的 repo 實際跑 skill」。

## Out of Scope

- 自動把建議值套用到專案，或直接產出 spec。
- 多 session 協作、互相傳訊討論。
- 對 production 施壓。
- `/next` 追蹤報告的處理狀態。
- 把參數清單固定寫進 `project.md`（跑過幾次、格式穩定之後再考慮）。

## Further Notes

- 跟 `ux-probe` 共用 **Probe report** 的段落格式，但不抽共用骨架。兩個都寫完、確定有重複之後再說。
