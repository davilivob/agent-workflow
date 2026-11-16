Status: ready-for-agent
Merge: ask
Plan: no
Execute: inline
Request: #9 #10 #11 #12 #13

# probe-device-runs

## Problem Statement

Owner 在 `2ENTER/Entropy` 要量 Quest 3 頭盔在不同負載下的上限（room-stress-2，2026-11-16），想照 `/soak-tune` 跑，對照之下五處套不上（Request #9–#13）：

- soak-tune 的 **Environment** 只准「this machine」，頭盔是從本機用 adb 連過去的裝置，照字面不適用（#9）。
- Probe 的 Run 一律開 `--detach` worktree；Entropy 是 Unity 專案，它的 `project.md` 規定碰 Unity 專案時 `Worktree: no`，因為一個 worktree 等於再匯入一份幾十 GB 的 `Library/`、再搶一把 project lock（#10）。
- 每一輪都要叫醒 session 挑下一輪；一晚 40–70 格就要醒幾十次，半夜會撞上 Context limit 而停；而且決策邏輯已經寫在專案自己有 self-check 的 loop 裡（#11）。
- 只有「粗掃再收斂、交出排序過的建議」一種策略；Owner 要的是「撐得住多少」的上限，報告只寫數字（#12）。
- 原始資料和 `runs.csv` 放 session 的 scratchpad，重開機或換 session 就沒了，跨夜接不上（#13）。

Owner 在 folding-status 的幾次整晚壓測（10-30、10-31、11-02）也碰過同類的坑：網路壞掉後半夜量到的是網路不是產品；一個無關的系統服務吃光記憶體造成失敗；driver 跟著 Claude Code 的 background Bash 工作一起被收掉；放 scratchpad 的工具重開機就沒了；中途換了幾次 build，數據得靠文字對版本；跑了 33 小時，期間要從別處看進度。

## Solution

Probe 共用規則（`unattended-run.md` 的 **Probe**）和 soak-tune 各自補上：

- 從本機連過去的待測裝置，經 Owner 在 Agree 點名，可以當 soak-tune 的環境。
- Probe 遵照專案的 `Worktree:`；不開 worktree 時在 main checkout 上跑，Claim 改成一個未完成的 `.scratch/<slug>/`。
- 原始資料一律寫進 main checkout 裡的 `.scratch/<slug>/`，跨夜靠它接續，每晚 commit 進度。
- soak-tune 多兩種選擇：交給專案的決策 loop 跑整晚，以及「找上限」策略；後者可以搭配 Probe 共用的「依 Agree 只寫數字、不給建議」。
- Probe 可以在 Owner 點名的路徑裡寫 **Probe harness**。
- 環境健康和指標一起記，`runs.csv` 記下每一輪的 commit。

## User Stories

1. As the Owner, I want a device reached from this machine over adb, USB or the LAN to count as a soak-tune environment once I name it in Agree, so that I can tune a headset or a dev board with the same skill.
2. As the Owner, I want the writes allowed on that device (installing this run's build, changing load parameters, restarting the app) settled in Agree, so that the run does exactly what I agreed and nothing more.
3. As the Owner, I want a factory reset, wiping data, or touching a device real users rely on to be never allowed, so that a probe cannot damage a device I care about.
4. As the Owner, I want a device read from a config or README not to count until I name it, so that the test-host rule holds for devices too.
5. As the Owner of a Unity project, I want a probe to follow my `project.md`'s `Worktree:` and its exceptions, so that it does not import a second `Library/` or fight the project lock.
6. As the Owner, I want the same Worktree rule for `/ux-probe`, so that both probes behave alike on the same project.
7. As the Owner, I want `/next` to list a running or paused probe as In progress (probing), so that I can see it whether or not it opened a worktree.
8. As the Owner, I want a probe's Claim to be a `.scratch/<slug>/` in the main checkout with no committed `report.md`, so that one rule covers both modes.
9. As the Owner, I want `/next` to report how long ago a probe's Claim last moved and never judge it stale itself, so that I decide whether to take an abandoned probe over.
10. As the Owner, I want a probe running on the main checkout to prefer environment variables or launch arguments over editing tracked files, so that other sessions' work is untouched.
11. As the Owner, I want a probe that must edit tracked files to refuse when those files already have uncommitted changes, so that it never mixes with someone else's edits.
12. As the Owner, I want a probe to record which tracked files it changed and restore only those with `git restore` before its commit, so that the main checkout is left as it found it.
13. As the Owner, I want raw measurements written to `.scratch/<slug>/` in the main checkout from the start, so that a reboot or a new session does not lose them.
14. As the Owner, I want raw files committed with the report only when they total 1 MB or less, and their location and size named otherwise, so that the repo does not swell.
15. As the Owner, I want a soak spread over several nights to be one `/soak-tune` per night, each resuming the same slug after I say so in Agree, so that I see the progress before each night and no scheduler is needed.
16. As the Owner, I want each night to commit a `progress.md` beside the data, so that I can follow a long soak from another device.
17. As the Owner, I want only the last night to write and commit `report.md`, so that the Claim ends exactly when the probe ends.
18. As the Owner, I want a probe to be allowed to write a Probe harness (stress scene, decision loop) only in paths I name in Agree, so that measuring code does not leak into the project's own code.
19. As the Owner, I want any harness with decision logic to come with a self-check that passes before it is used, so that the numbers rest on tested code.
20. As the Owner, I want the harness committed separately (`[<slug>] harness: ...`) with each night's results and listed in the report, so that I can review it, reuse it next night, or revert it.
21. As the Owner, I want a probe that needs a change outside the named paths to say what it needs in the proposal and stop, so that such a change goes through the normal workflow.
22. As the Owner, I want soak-tune to offer handing the whole night to the project's own decision loop, so that the session wakes only at start and end and the Context limit does not stop it at 3 a.m.
23. As the Owner, I want that loop started detached, with its pid and a heartbeat in `.scratch/<slug>/`, and a separate background waiter that wakes the session, so that the loop survives the session's tool task being reaped.
24. As the Owner, I want the session to start a new waiter if it wakes and finds the loop still alive, so that losing the waiter loses nothing.
25. As the Owner, I want the loop to write `runs.csv` in soak-tune's format, so that the report reads the same either way.
26. As the Owner, I want a loop that exits before its budget to be restarted once if it can resume from its data, and the run to stop and report otherwise, so that one crash does not end the night but repeated ones do not loop forever.
27. As the Owner, I want a ceiling strategy (×1.5 steps, bisect to under 10 %, a long confirmation of the last step), so that I learn what the system withstands.
28. As the Owner, I want what counts as a failed step defined in the proposal and the three numbers changeable in Agree, so that each case fits its own limits.
29. As the Owner, I want several parameters climbed one at a time with the others at baseline, each with its own ceiling and confirmation, so that the ceilings do not mask each other.
30. As the Owner, I want to agree in Agree that a Probe report states numbers only, and then see 建議 say it is withheld by that agreement, so that a probe never steers a budget I want to set myself.
31. As the Owner, I want soak-tune's proposal to list Environment health signals (network reachability, system memory, free disk; for a device its battery, temperature and link), recorded alongside each round, so that I can tell a product problem from a broken environment.
32. As the Owner, I want windows where the environment was unhealthy kept apart in the report and not used for conclusions, so that a dead Wi-Fi does not become a finding about my product.
33. As the Owner, I want a `commit` column in `runs.csv` and the run never to switch builds itself, so that every number traces to a version and builds change only between nights, by me.
34. As an agent resuming a soak, I want the slug, its data and its `runs.csv` where I can find them from the main checkout, so that I continue from the last row.

## Implementation Decisions

- **Probe 共用（`unattended-run.md` 的 Probe）**
  - **Environment**：維持「what the skill allows locally」加 test host；skill 可以另外允許從本機連過去的裝置，規則比照 test host（Owner 在 Agree 點名才算）。
  - **Worktree**：讀專案 `project.md` 的 `Worktree:` 和它列的例外。`yes`（且這次要動的路徑不在例外裡）照舊 `git worktree add --detach`；否則在 main checkout 上跑。worktree 只負責隔離，不再是 Claim。
  - **Claim**：main checkout 裡有 `.scratch/<slug>/`，且沒有已 commit 的 `report.md`。run 一開始就建立這個目錄（資料、`progress.md`、改過的檔案清單都在這裡）。
  - **Slug**：Agree 時 Owner 說「接續 `<slug>`」就沿用該 slug 與目錄，不加日期後綴；否則照現行規則。
  - **改專案檔案**（不開 worktree 時）：優先環境變數或啟動參數；一定要改已追蹤的檔案時，開跑前檢查那些檔案沒有未 commit 的改動（有就停、寫進報告），改了哪些記進 `.scratch/<slug>/`，收尾時 `git restore` 只還原這些，再確認 `git status` 只剩 `.scratch/<slug>/`（與允許的 harness 路徑）。
  - **Probe harness**：只准寫在 Agree 點名的路徑；有判斷邏輯的要附 self-check，開跑前跑過且通過；用 `[<slug>] harness: ...` 跟每晚的結果分開 commit；報告的 **設定與範圍** 列出它。需要動到點名路徑以外的程式碼：提案寫明缺什麼就停。開 worktree 時 harness 寫在 worktree 裡，commit 前帶回 main，照 `workflow.md` **Commits** 的「不在 `main` 上」做法。
  - **建議**：Agree 時 Owner 講定「只寫數字」時，**建議** 一節寫「依 Agree 不給」，其餘三節照舊。
  - **跨夜**：每晚收尾 commit `.scratch/<slug>/progress.md`（這晚跑了什麼、到哪、下一晚從哪接）與 harness，訊息 `[<slug>] progress: ...`；不寫 `report.md`。最後一晚寫 `report.md` 並 commit，Claim 隨之結束。Wrap-up 的通知與最後訊息照舊，每晚都發。
  - **Report 的 commit**：`runs.csv`；原始資料合計 1 MB 以內一起 commit，超過就不 commit，報告寫位置與大小（門檻是技術決定）。
- **soak-tune**
  - **Environment**：本機，或 Owner 在 Agree 點名的、從本機連過去的裝置（adb、USB、區網）。Agree 同時講定裝置上允許的寫入；恢復原廠、清資料、真實使用者在用的裝置永遠不行。量測一律從本機發起。
  - **Propose** 加兩項：**Environment health**（外網可達、系統記憶體、剩餘磁碟；裝置則電量、溫度、連線），以及 **How it runs**：每輪由 session 挑（現行）或交給專案的決策 loop；**Strategy**：收斂（現行）或找上限。
  - **Rounds**：原始輸出寫進 `.scratch/<slug>/`，不再寫 scratchpad。每輪連同 Environment health 一起記。
  - **交給 loop**：loop 是 `main` 上已有的、或這次在 harness 路徑裡寫的，開跑前跑它的 self-check。用獨立方式啟動（`setsid`/`nohup`，Windows `Start-Process`），pid 與心跳檔寫進 `.scratch/<slug>/`；另起一個 background command 當等待者，pid 消失或時限到才退出。session 醒來發現 loop 還活著就再起一個等待者；loop 在時限前退出：支援接續就重啟一次，再退出就停、寫報告。loop 照 soak-tune 格式寫 `runs.csv`；session 不 poll。Context limit 照常在每次啟動前檢查。
  - **找上限**：每格 ×1.5 往上爬，失敗就二分到差距 < 10 %，最後一格做長時間證實；三個數字是預設，Agree 可改；證實時長與「失敗」的定義在 Propose 提。多個參數一次爬一個，其餘固定在基準值。**觀察** 寫每個上限、證實結果、第一個失敗格的讀數。
  - **`runs.csv`**：加 `commit` 欄（該輪的 `HEAD`）。run 從不換 build；換 build 是 Owner 在兩晚之間做。
  - **報告**：Environment health 不健康的時段分開列，不拿來下結論，只進 **觀察**。
  - **收尾**：worktree 存在時照舊 `remove --force`；不存在時照 Probe 的還原規則。
- **`/ux-probe`**：只跟著 Probe 共用的 Worktree、Claim 改；它不改專案檔案，所以還原規則對它是空集合。worktree 收尾一行改成「worktree 存在時」。
- **`workflow.md` Continue**：Claim 清單加第四種「Probing：main checkout 有 `.scratch/<slug>/`、沒有 spec、沒有已 commit 的 `report.md`」，最後動的時間取該目錄內最新檔案的修改時間。
- **`CONTEXT.md`**：**Claim**、**Probe report** 已在 grill 時改，新增 **Probe harness**；隨本 spec commit。
- **Request 的關閉**：最後一個 commit 寫 `Fixes #9, fixes #10, fixes #11, fixes #12, fixes #13`（GitHub 每個編號要有自己的關鍵字）。`Request:` 一行列五個編號。

## Testing Decisions

- 改的全是規則文字，沒有可單元測試的程式。好的驗證是看外部行為：一個 session 照新規則讀，會做出預期的事。
- 迴歸：`sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs` 全過。
- 手跑（scratchpad 裡的拋棄式 repo，輸出留作證據）：
  - `/next`：repo 裡放一個未 commit 的 `.scratch/<x>/`（無 spec、無 `report.md`），應列在 In progress（probing）並附時間；再 commit 一個 `report.md`，應不再列出。
  - `/soak-tune`：一個 `Worktree: no` 的 repo，跑到 Agree 為止：提案要有 Environment health、How it runs、Strategy；Agree 應問到裝置點名與允許的寫入（以一個假想的 adb 裝置）。
- 做不到、寫進 **## Comments**：真的跑一整晚、真的連頭盔、loop 被收掉後的等待者重起。這些只有實際的 run 能證實。
- 前例：`request-gitea-tea`、`clear-next-step` 都是以三支測試加手跑 skill 驗證的文字規則變更。

## Out of Scope

- 用排程讓 session 隔晚自己醒來（每晚各跑一次 `/soak-tune` 取代）。
- run 中途換 build。
- `/ux-probe` 使用實體裝置或非本機環境。
- Probe harness 以外的程式碼由 probe 修改。
- 改 Entropy 或 folding-status 本身。
- 「被擋前先變慢」之類的產品觀察規則。

## Further Notes

- Request 原文寫「spec 要求時只寫數字」；probe 沒有 spec，改以 Agree 為準。
- #9 原文要「只讀」；room-stress-2 要裝 apk、改負載，與「只讀」矛盾，改成「Agree 講定的寫入」。
- 改了 `templates/workflow.md`，各 repo 要 `/sync-workflow` 才拿得到 Continue 的新 Claim。
- folding-status 的報告是 grill 的佐證：10-31 網路中斷、11-02 RunSwUSB、11-02 driver 被收、10-31 `player-mem/` 留在 scratchpad、11-02 的 7 次 interim commit 與 3 次換 build。
