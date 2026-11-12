Status: ready-for-agent
Merge: ask
Plan: no
Execute: inline
Overlaps: soak-tune — low: 兩份都把 `probe` 加進 `global.md` 的 Phase 清單，改的是同一行的同一個字；後 merge 的一方看到已經加上就跳過。

# ux-probe

## Problem Statement

開發者自己用自己的介面，很難看出哪裡卡：流程早就背熟了，繞路不會覺得繞，文字不清楚也會自動腦補。要找出 UX 問題，得有人從頭到尾、反覆地照真實使用者的任務操作一遍，同時記錄每個卡住、繞路、看不懂的地方。這件事很花時間，所以通常不會有系統地做。

## Solution

新增 kit skill `/ux-probe`。

1. agent 先讀 README 和程式碼，列出幾個使用者任務，例如「新用戶註冊並建立第一個專案」，再提出看哪些面向和理想時長。
2. Owner 給出時間預算，雙方來回討論後定案。
3. 之後 agent 無人值守地用內建瀏覽器（Web）或 iOS Simulator 實際操作。每個任務跑兩遍，一遍當新手、一遍當熟手，另外看手機寬度和深色模式；任務做完再自由探索一下。過程中記錄摩擦點，並附上截圖。

最後產出一份 **Probe report**，放在 `.scratch/<slug>/report.md`。報告只提建議，Owner 要採用哪些，再走 grill。

## User Stories

1. As the Owner, I want the agent to derive user tasks from the README and the code, so that the probe follows what real users come to do.
2. As the Owner, I want to confirm, edit or add tasks before anything starts, so that the probe covers the flows I care about.
3. As the Owner, I want the agent to propose which lenses apply (second pass as a repeat user, phone width, dark mode) and drop the ones that do not fit, so that an iOS app is not judged at "phone width".
4. As the Owner, I want the agent to propose an ideal duration and set it against my time budget, so that we agree before it starts.
5. As the Owner, I want nothing asked once the plan is agreed, so that I can walk away.
6. As the Owner, I want web interfaces probed in the built-in browser, so that no extra tooling is needed.
7. As the Owner, I want iOS apps probed in the Simulator, so that native apps get the same treatment.
8. As the Owner, I want each task done first from a clean state as a newcomer, so that onboarding friction shows up.
9. As the Owner, I want each task done a second time as a repeat user, so that needless steps in repeated use show up.
10. As the Owner, I want web tasks also checked at phone width and in dark mode, so that layout and contrast problems show up.
11. As the Owner, I want a short free exploration after each task, so that friction outside the scripted paths has a chance to show.
12. As the Owner, I want each friction point recorded with where it happened, what was expected, what happened and a screenshot, so that every finding has evidence.
13. As the Owner, I want findings to separate UX friction from outright bugs, so that I can route bugs to debugging instead of a redesign.
14. As the Owner, I want a finding to name the screen or component and, where obvious, the code behind it, so that acting on it is quick.
15. As the Owner, I want the probe limited to local dev hosts and a test environment I named, so that it never touches production.
16. As the Owner, I want test accounts and test data handled by the rules for testing my own application, so that no real credentials are entered.
17. As the Owner, I want the machine kept awake during the run, so that a long probe is not cut off.
18. As the Owner, I want the run to stop with a failure-only report if the app cannot be started, so that I learn why.
19. As the Owner, I want the report in the same shape as every Probe report (setup and scope, observations with evidence, ranked recommendations with expected effect and confidence, what was not verified), so that reports are comparable.
20. As the Owner, I want the screenshots the report cites committed next to it and the rest left in the scratchpad, so that evidence travels without bloating the repo.
21. As the Owner, I want the report committed to `main` and pushed as the Push policy says, so that it reaches my other devices.
22. As the Owner, I want a notification when the run ends, so that I know the report is ready.
23. As the Owner, I want the report to recommend and never change code, so that adopting a change goes through a grill.
24. As the Owner, I want the run to stop probing past the Context limit and write the report with what it has, so that it still ends cleanly.
25. As the Owner, I want `/ux-probe` usable only when I run it, so that no session starts probing on its own.

## Implementation Decisions

- 新增 kit skill `ux-probe`，`setup.sh` 現有邏輯會自動連結，設 `disable-model-invocation: true`。寫法比照 `/drain`：分節，每節有 "Done when"。Session title 的 Phase 用 `probe`。`global.md` 的 Phase 清單裡如果還沒有，就加在 `batch` 之後（見 `Overlaps:`）。
- **只用一個主持 session 搭配 subagent**，不用多 session 協作。
- **介面**：Web 用內建瀏覽器，iOS 用 Simulator 工具，截圖和操作都在背景完成，不需要開面板。其他介面（CLI、TUI、桌面 app）在提案時就說明不支援並停下。
- **環境邊界**：只在本機開發主機，或 Owner 在討論時明確點名的測試主機。永遠不碰 production。測試帳號和測試資料照「測試自己的 app」規則：優先自己產生，或用專案 seed、fixture 裡的；產生的帳密寫進專案的 seed 或 example config，不在對話裡重複。
- **1. 提案**：任務清單（每個一句話，加上預期的完成狀態）、適用的面向（熟手第二遍、手機寬度、深色模式，不適用的刪掉）、理想時長和理由。
- **2. 討論與確認**：Owner 給時間預算，來回討論後定案，那次回答就是要引用的授權句。從這裡開始不再發問，有疑問就寫進報告。
- **3. 執行**：
  - 開跑時用 `request_keep_awake`。
  - 啟動方式：先找專案的 `.claude/launch.json` 或 `run` skill，iOS 用專案自己的 build 方式；起不來就停下，寫只有失敗原因的報告。
  - 每個任務：先以新手身分從乾淨狀態做一遍，再以熟手身分做一遍，接著做適用的面向，最後短暫自由探索。
  - 每個摩擦點記下：在哪個畫面、預期什麼、實際發生什麼、截圖，再標成 UX 問題或 bug。
  - 預算用完、任務全部做完，或超過 Context limit（200k）就停。沒做到的列進「沒驗證到的地方」。
  - 不改程式碼。
- **4. 報告**：
  - 位置是 `.scratch/<slug>/report.md`，slug 取 `ux-probe-<主題>`；目錄已存在就在後面加日期。
  - 段落跟 `soak-tune` 相同：設定與範圍 / 觀察（附證據）/ 建議（排序，每條附預期效果與把握程度）/ 沒驗證到的地方。本文用繁體中文。
  - 報告引用到的截圖放在同目錄的 `screenshots/`，跟報告一起 commit；其餘留在 scratchpad。
  - commit 照 workflow **Commits** 的規則進 `main`，訊息是 `[<slug>] report: ...`。push 照 Push policy；Deploy paths 照 workflow 比對。
  - 發 `PushNotification`。最後的訊息附上報告路徑、最重要的幾條建議，以及 `global.md` 要求的 commit 清單與 push 行。
- `/next` 不新增「Probe reports」這一組。

## Testing Decisions

- 這個 seam 就是 `/ux-probe` skill 本身。在 scratchpad 建一個用完即丟的 repo，放一個有兩、三個頁面的玩具 web app，故意埋幾個 UX 問題：模糊的按鈕文字、多一步的流程、深色模式下看不清的文字、一個真的會壞的 bug。依照這個 worktree 裡的 `skills/ux-probe/SKILL.md` 實際跑一次，預算定得很短。
- 要確認：提案有任務、面向和時長；確認之後不再發問；每個任務都跑了兩遍和適用的面向；埋的問題大部分被找到，而且 bug 被標成 bug；報告四個段落齊全，引用的截圖都在 `screenshots/` 裡；沒有改到 app 的程式碼。
- 另外跑一次 app 起不來的情況。
- 這台是 macOS，iOS 的部分可以順手用一個最小的 SwiftUI app 跑一次。做不到的話，在 spec 的 `## Comments` 寫明 iOS 沒驗證到。
- 保留報告和對話輸出作為證據。再跑 `project.md` 的 Verification 指令。

## Out of Scope

- CLI、TUI、桌面 app 介面。
- 修改程式碼，或直接產出 spec。
- 多 session 協作、多個 persona 互相討論。
- 無障礙檢查的完整稽核（只記操作中遇到的明顯問題）。
- `/next` 追蹤報告的處理狀態。

## Further Notes

- 跟 `soak-tune` 共用 **Probe report** 的格式，但不抽共用骨架。兩個都上線之後，有重複再抽出來。
