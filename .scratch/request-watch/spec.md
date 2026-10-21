Status: done
Merge: ask
Plan: yes
Execute: sdd

# request-watch

## Problem Statement

Request（含 Proposal）是 GitHub issue，只有 Owner 開 Continue（`/next`）或點名 issue 號碼時才會被看到；Triage 之後也要等 Owner 挑 verdict 才動。很多 Request 是 Owner 自己用 `/file-request` 送出、`## What` 已經把改法寫死的 Proposal——Triage 一定判 Apply，Owner 也一定選 Apply，卻還是要等 Owner 回到電腦前開一個 session 才會被做。結果 Request 堆在 GitHub 上，來源 repo 等著它的修正。

## Solution

新增 **Request watch**：一台裝置（預設 `studio`，幾乎都在線）每小時跑一次無人值守的排程，掃這台裝置上所有在 `project.md` 點名它的 repo，對每個新的 Request 做 Triage：

- Owner 送出、符合 `/file-request` 格式、而且 applied as written（沒有留下任何選擇）的，直接照現有的 Apply 流程做完：worktree、verification、`Fixes #<n>`、merge 到本機 `main`。**不 push**，用 push notification 告訴 Owner 回來看 diff、push。
- 其他的（判 Drop 或 Grill、作者不是 Owner、格式不符、驗證失敗）只通知 Owner，issue 本身不動。

repo 用 `project.md` `## Sync` 底下一行 `Request watch: <Device code> | off` 宣告由哪台裝置看；一個 repo 只點名一台，同一個 Request 不會被 apply 兩次。

## User Stories

1. As the Owner, I want Requests I filed with `/file-request` to be applied while I am away, so that the source repo gets its fix without me opening a session.
2. As the Owner, I want only Requests that leave me nothing to choose to be applied unattended, so that every design decision still reaches me.
3. As the Owner, I want issues opened by anyone else in a public repo never to be applied, so that a stranger cannot write into my rules through an issue.
4. As the Owner, I want an issue that lacks the `/file-request` format (`From:`, `## What`) to be skipped even if I opened it, so that a hand-written note is not mistaken for a ready Request.
5. As the Owner, I want an applied Request to stop at a commit on local `main`, so that I review the diff before anything leaves the device.
6. As the Owner, I want a push notification when a Request was applied, naming the repo, the issue and the commit, so that I know there is something to push.
7. As the Owner, I want a push notification for each Request the watch did not apply, with its Triage verdict and reason, so that I can pick it up with a normal Triage or grill.
8. As the Owner, I want the watch never to comment on, label or close an issue, so that nothing is published on GitHub without me.
9. As the Owner, I want a repo to declare which device watches it in `project.md`, so that every device reads the same declaration and no Request is applied twice.
10. As the Owner, I want `/sync-workflow` to write `Request watch: studio` into a repo's `project.md`, so that every synced repo is watched by default.
11. As the Owner, I want a repo whose `project.md` has no `Request watch:` line to be unwatched, so that the watch only acts where a file says it may.
12. As the Owner, I want `Request watch: off` to turn the watch off for one repo, so that I can opt a repo out.
13. As the Owner, I want one scheduled task per device that walks every repo naming that device, so that a new repo is watched by writing one line, not by installing another schedule.
14. As the Owner, I want the watch to find repos the way the `drift` command does (the drift roots, Retired repos skipped), so that there is one list of repos per device.
15. As the Owner, I want a run to skip a repo whose `main` is behind, diverged or Unknown, or that has uncommitted changes or any Claim, and tell me so (only when the reason changed since the last run), so that the watch never fights a session that is working there.
16. As the Owner, I want a Request whose verification fails to leave nothing behind (no commit, worktree removed) and to tell me with the output, so that `main` only ever gets verified work.
17. As the Owner, I want a Request the watch already handled not to be handled or notified again on the next run, so that hourly runs do not spam me.
18. As the Owner, I want a run where `gh` fails to report the repo as Unknown, never as having no Requests, so that a silent outage is visible.
19. As the Owner, I want Continue to show an open Request that local `main` already carries a `Fixes #<n>` commit for as applied and awaiting push, so that I do not triage it a second time.
20. As the Owner, I want the applied change to follow every rule an attended Apply follows (worktree, verification, commit prefix, Guard), so that unattended work is no less safe than mine.
21. As a session in another repo, I want my Proposal to the kit to land without waiting for the Owner to open the kit, so that the next `/sync-workflow` carries it.

## Implementation Decisions

- **Glossary**：`CONTEXT.md` 改了 **Triage**（無人值守的 Triage 只自動 apply Owner 送出、applied as written 的 Request），新增 **Request watch**。
- **`project.md` 欄位**：`## Sync` 底下加 `Request watch: <Device code> | off`。沒有這一行、值認不得、讀不到：`off`。template 的預設值是 `studio`。讀法跟 Push policy、Pull policy 同一套 reader。
- **`/sync-workflow`**：new 模式照 template 寫入 `Request watch: studio`；update 模式在 `## Sync` 沒有這一行時補上 `Request watch: studio`，不問；已有的值不讀不改。commit 訊息照現有慣例加 `, add Request watch to project.md`。
- **候選清單是確定性的程式，不是 agent 判斷**：`drift` 命令加一個 `--watch` 入口，重用它的 repo 掃描（drift roots、Retired repos）和 `project.md` reader，對每個 `Request watch:` 等於本機 Device code 的 repo：
  - 檢查 `main` 的 Drift、未 commit 的變更、Claim（`.claude/worktrees/` 下的 worktree、`.scratch/*/plan.md` 未 commit）；有任何一項就把這個 repo 標成 skipped 並附原因。`main` 只有 ahead（還沒 push 的 commit，包括 watch 自己 apply 的）不算：新的 worktree 從本機 `main` 開，`merge --ff-only` 照樣成功（plan 時 Owner 決定）。
  - 用 `gh issue list --state open` 取 open issues；`gh` 失敗就把這個 repo 標成 Unknown。
  - 每個 issue 標上：作者是否為 Owner 的 GitHub 帳號（`gh api user` 取得）、body 是否有 `From:` 行和 `## What`、是否已在本機 state 檔裡。
  - 輸出一份機器可讀的清單（JSON），讓 skill 照著做。
- **State 檔**：本機、每台裝置一份，放在 `~/.claude/` 下，以 `<owner/repo>#<n>` 為鍵記下已處理的 Request 和結果（applied / notified）。不在 GitHub 上打 label——不對外寫入，而且只有一台裝置看同一個 repo。由 skill 在處理完每個 Request 後寫入。
- **新 skill `request-watch`**（`disable-model-invocation: true`，由排程任務以 `/request-watch` 呼叫）：讀 `drift --watch` 的清單，對每個還沒處理、作者是 Owner、格式符合的 Request 做 Triage：
  - **applied as written** 的判定：`## What` 寫出確切的文字或值，沒有並列的選項、沒有 `TODO(owner)`，不碰 `project.md` 列為 Always a design decision 的項目。全部成立才判 Apply；任何一項有疑慮就判 Grill 或 Drop。寧可漏判也不誤判。
  - 判 Apply：照 `workflow.md` 的 Apply 做（worktree、verification、最後一個 commit 帶 `Fixes #<n>`、merge 到本機 `main`），不 push，不跑 Deploy check。
  - 驗證失敗：丟掉 worktree 和 branch，不 commit，通知 Owner 並附輸出。
  - 其他（Drop、Grill、作者不是 Owner、格式不符、skipped、Unknown）：只通知，不碰 issue。
  - 通知用 push notification，一個 run 合併成一則，列出每個 repo 的結果。沒有任何新東西就不通知。被跳過或 Unknown 的 repo，原因跟 state 檔記下的上一輪一樣就不再通知；恢復正常時清掉紀錄（plan 時 Owner 決定）。
- **`workflow.md`**：**Requests** 一節加 Request watch 一段：誰被自動 apply、做到哪、其他的怎麼處理；原本「change nothing until the owner picks」限定在 Owner 挑的 Request。**Continue** 的 Requests 群組：本機 `main` 已有 `Fixes #<n>` commit 的 open Request 標成「applied, awaiting push」。
- **排程任務**：每台被點名的裝置一個 Desktop scheduled task，每小時，prompt 是 `/request-watch`。由 Owner 在 app 裡建立一次；README 寫怎麼建。
- **kit 自己**：`docs/agents/project.md` 的 `## Sync` 加 `Request watch: studio`。
- Guard 照常作用；排程 session 不 push，所以不會卡在 Guard 的 push 提示上。

## Testing Decisions

- 只測從外面看得到的行為；唯一的 seam 是 `drift --watch` 的輸出。agent 的 Triage 判斷不寫自動測試。
- **`tests/drift.test.cjs`**：用現有的 `clone()`、`commit()` 和暫存 HOME（寫 `~/.claude/device`、`drift-roots`），在 PATH 前面放一個假的 `gh` 腳本回傳固定的 issue 清單和帳號，斷言：
  - `Request watch:` 是本機 Device code 的 repo 才列出；別台裝置、`off`、沒寫、值認不得、Retired repo：不列。
  - Owner 送出且格式符合的 issue 標成候選；作者不是 Owner、缺 `From:` 或 `## What`：標成不符並附原因。
  - state 檔裡已有的 issue 標成已處理。
  - `main` 有 Drift、未 commit 變更、worktree Claim、未 commit 的 `plan.md`：repo 標成 skipped 並附原因。
  - 假 `gh` 失敗：repo 標成 Unknown。
- **`/request-watch`**：照 `project.md` 的 Verification，在 session 的 scratchpad 建暫存 repo 和假 `gh`，手動跑一次，涵蓋一個 Apply（驗證通過）、一個驗證失敗、一個 Grill、一個非 Owner 的 issue，留下輸出當作證據。
- **`/sync-workflow`**：在 scratchpad 的暫存 repo 手動跑 new 和 update（`## Sync` 先刪掉 `Request watch:` 行）各一次，留下輸出。
- `workflow.md` 的條文交給 SDD 的 review 對照這份 spec。

## Out of Scope

- Push：自動 apply 停在本機 `main`；Push policy 不變。
- 在 GitHub 上留言、打 label、關 issue。
- 處理非 Owner 開的 issue（即使內容合理）。
- 自動建立排程任務；Owner 在 app 裡手動建一次。
- 多台裝置共同看同一個 repo、裝置離線時的接手。
- 用 GitHub Actions 或 cloud routine 跑（沒有 Guard 和 `~/.claude/kit`）。
- 監看 Request 以外的東西。

## Further Notes

- 決策在 grill 裡定案：範圍是 kit 通用功能、第一版在 kit 啟用；作者＋格式把關；只 apply applied as written；studio 本機排程每小時；停在本機 `main` 加通知；Drop、Grill 只通知；沒有 `Request watch:` 行等於 `off`（`/sync-workflow` 補上 `studio` 後才生效）。
- 寫 plan 時要先實際確認：Desktop scheduled task 能呼叫 kit 的 skill、在無人值守時通過 Guard 的 commit 規則，以及 push notification 在排程 session 裡送得出去。任何一項不成立，回來問 Owner。
- repo 是 PUBLIC：作者檢查是信任邊界，不能拿掉。
