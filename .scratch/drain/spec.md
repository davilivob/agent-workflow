Status: done
Merge: ask
Plan: no
Execute: inline

# drain

## Problem Statement

specs 累積之後，Owner 得一份一份走完 pipeline：每份開新 session、等它做完、在 `Merge: ask` 時回來按 merge，再開下一份。Owner 不在電腦前，整條隊伍就停住，而且每份都要重新動手。最後的 push 也要另外處理。

OS-bound verification 是另一個卡點。現行流程要把分支 push 出去、等對應 OS 的裝置驗證後才 merge，所以改動長時間進不了 `main`，依賴它的 spec 也跟著等。實務上需要 OS 驗證的 repo 通常不綁自動部署，先進 `main` 並 push 不會造成問題，Owner 的工作方式也已經偏向這樣。

## Solution

新增 kit skill `/drain`，啟動一次 **Batch run**：一個 session 依序做完 repo 裡所有能做的 spec，開跑時確認一次，之後到結尾都不再問。做不完的 spec 留在自己的分支上，其他繼續。結尾可選擇 push。

同時全面改掉 OS-bound verification：其他驗證通過就 merge，OS 驗證變成 spec 上的待辦，由 `/next` 列出，不只 `/drain` 如此。分支交接流程整段刪除。

## User Stories

1. As the Owner, I want to run one command that works through every spec a repo has ready, so that I do not open a session per spec.
2. As the Owner, I want specs that still need a plan to get one during the run, so that the backlog does not need a separate planning pass.
3. As the Owner, I want to see the order, a summary of each spec, how its `Merge:` will be handled, what will be skipped and the push choice before anything starts, so that one confirmation is an informed authorization.
4. As the Owner, I want nothing asked between that confirmation and the end, so that I can walk away.
5. As the Owner, I want `Merge: ask` specs to merge without asking during a Batch run, so that starting the run already answers that question.
6. As the Owner, I want `Merge: manual` specs left unmerged with their evidence in the final report, so that a choice I made on purpose is not overridden.
7. As the Owner, I want a failed spec to stop alone while unrelated specs go on, so that one small failure does not waste the night.
8. As the Owner, I want specs depending on a failed or unmerged spec to be skipped and reported, so that nothing is built on work that is not on `main`.
9. As the Owner, I want the whole run to stop if `main` itself breaks, so that later specs do not stack on a broken base.
10. As the Owner, I want a spec unblocked by an earlier merge to be picked up in the same run, so that a dependency chain finishes in one go.
11. As the Owner, I want a failed spec's reason written on its branch, so that it survives compaction and the next session can read it.
12. As the Owner, I want to re-run `/drain` after an interruption and have merged specs gone from the list, so that no progress file is needed.
13. As the Owner, I want a half-done branch shown as In progress and left alone unless I name it at confirmation, so that a run never takes over another session's work.
14. As the Owner, I want to choose at confirmation whether the run pushes at the end, so that I am not asked again at the end.
15. As the Owner of a repo with Deploy paths, I want three push choices with "only if no Deploy path is touched" as the default, so that a run may push docs but never deploys unless I said so.
16. As the Owner, I want a notification right before the push, so that I know to come back when the Guard is waiting for me.
17. As the Owner, I want another notification only if the push or the Deploy check fails, so that a success does not interrupt me twice.
18. As the Owner, I want the Guard unchanged, so that a Batch run opens no hole in the owner boundary.
19. As the Owner, I want `/drain` usable only when I run it, so that no session starts a Batch run on its own.
20. As the Owner, I want a change needing OS-bound verification merged once everything else passes, so that it does not sit on a branch waiting for another device.
21. As the Owner, I want the pending verification listed by `/next` on every device, so that it is not forgotten.
22. As the Owner, I want the pass recorded on `main` by the verifying device, so that the spec reaches `done` without a branch or merge.
23. As the Owner, I want a failed OS verification treated as a bug and fixed forward, so that there is one clear path and no rollback.
24. As a session on another device, I want specs awaiting verification kept out of Ready, so that nobody executes them a second time.
25. As a repo using `/sync-workflow`, I want these rules in the Template, so that every repo gets them the same way.

## Implementation Decisions

**`/drain`: new kit skill**

- 放在 kit 的 skills 目錄，由 `setup.sh` 現有邏輯連結，設 `disable-model-invocation: true`，只有 Owner 能觸發。寫法比照 `/request-watch`：分節，每節有 "Done when"。
- 範圍只限當前 repo，因為各 repo 的 Push policy 和驗證指令都不同。
- 納入 `/next` 的 **Ready** 和 **Needs a plan**。不碰有 Claim 的 slug、未 commit 的 spec、Blocked 和 Request。Awaiting OS 驗證的 spec 也不納入，由 `/next` 列出，Owner 決定何時跑。
- **開跑確認**：`AskUserQuestion` 之前列出順序、每份一句摘要、`Merge:` 處理方式、會跳過哪些及原因、In progress 的 slug。Owner 這次回答就是 workflow「Say where the authorization came from」要引用的句子。這也是唯一能指定接手 In progress slug 的時機；接手就從現有分支繼續。
- **push 選項**：repo 有 Deploy paths 時三選一：都不推、沒碰 Deploy paths 才推（預設）、碰到也推。沒有 Deploy paths 時只問推或不推。`Push: auto` 的 repo 選「碰到也推」時，清單要標明這是無人確認地部署到 production。`Push: owner` 的 repo 不問，結尾交出指令。
- **順序**：依序執行，不平行：`After:` 要等前一份進 `main`，`Worktree: no` 也只能一次一份。`After:` 和 `Overlaps: high` 優先，其餘照 slug 字母序。每次 merge 後重新掃描，把解除封鎖的 spec 排進來。
- **執行者**：單一指揮 session，是「one new session per step」的例外；把這條例外寫進 `workflow.md`。理由：side session 的事件鏈在連續多則之後會被 app 壓到下一輪，長批次會停在半路；`claude -p` 沒有 `AskUserQuestion`，Guard 的 ask 在 headless 下的行為也未知。
  - 缺 plan：照 workflow step 3（含 Claim 和 commit 規則），交給 subagent 寫，不佔指揮 session 的 context。
  - 每份 spec 交給一個 subagent 跑完 workflow step 4 到 merge 之前：`Execute: sdd` 由它跑 `superpowers:subagent-driven-development`（靠巢狀 subagent，Claude Code 預設允許到主對話以下三層）；`Execute: inline` 由它實作再跑 `code-review`。它回傳結果摘要，過程不進指揮 session 的 context。
  - 指揮 session 只負責排程、merge 和報告。subagent 的回報不算證據：merge 前指揮 session 自己在該分支跑一次驗證指令。
  - 巢狀不可用（例如 `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` 關掉）時，該份算失敗，報告寫明原因。
- **Merge**：`auto` 照舊；`ask` 視同 `auto`；`manual` 不 merge，分支留著，結尾附證據，依賴它的 spec 跳過並列入報告。Batch run 以外，`ask` 的行為不變。
- **失敗**（驗證沒過、merge 衝突無法依 `Overlaps:` 解決、spec 的決定必須改）：該份停下，進度 commit 在分支上，原因寫進該分支 spec 的 `## Comments` 一行，不 merge；依賴它的跳過，其他繼續。留下的分支就是 Claim，下次 `/drain` 自然跳過並標成 In progress。spec 只是事實錯誤時，照 workflow 由 plan session 修正，不算失敗。
- **`main` 壞掉**：merge 不是 fast-forward 時，merge 後在 `main` 上重跑驗證；失敗就整批停，不回滾，也不 push，並發通知。
- **接續**：不做狀態檔，重跑時一律從 git 判斷。
- **push**：結尾推一次 `main`，遵守 Push policy、Rebase rule 和 Guard。開跑時已回答過，所以 workflow 的 Deploy paths 問題在 Batch run 裡不再問：選「沒碰才推」而碰到時不推，報告列出符合的檔案和它們比對到的 Deploy paths。這批含未跑 OS 驗證的改動時，報告也要標明。push 之後照 workflow 跑 Deploy check 和 Production check。
- **Guard 不動**：`Push: ask` 的最後一步會跳 Guard 提示，等 Owner 按。Owner 要完全免按就把該 repo 設成 `Push: auto`。
- **通知**：`PushNotification` 在 push 前發一則（幾份 merge、幾份失敗、是否 push），沒有要 push 時就在結尾發。push 或 Deploy check 失敗時再發一則。無法載入或發送時，在最後的訊息說明。
- **最後的訊息**：每份的結果（merge、`manual` 等待、失敗原因、跳過原因）、Awaiting OS 驗證的待辦、push 結果，以及 `global.md` 要求的 commit 清單與 push 行。Compact proposal 只在結尾提，不在中途。
- Session title 的 Phase 用 `batch`：`global.md` 的 Phase 清單要加上（`CONTEXT.md` 已加）。

**OS-bound verification：全面改動**

- `workflow.md` step 4：跑完其他驗證後，在 spec 底部 `## Comments` 為每個跑不了的指令加一行 ``- Awaiting OS-bound verification (<os>): `<command>` ``，`Status` 不設 `done`，commit，然後照 `Merge:` merge。`Status` 仍是 `ready-for-agent`，因為 tracker 規定兩個狀態之間沒有中間值；那一行就是待辦的標記。
- 刪除分支交接：`git push -u origin <slug>`、push 後刪本機分支、`git push origin --delete` 都不再需要。一般 wrap-up 照做。
- **補驗證**：對應 OS 的 session 從 `/next` 接手，在 `main` 上跑 awaiting 指令；通過就把那行換成 ``- OS-bound verification (<os>) passed: `<command>` ``，同一個 commit 設 `Status: done`，直接 commit 到 `main`（走 workflow **Commits** 的規則），再照 Push policy 處理。
- **補驗證失敗**：停下來把輸出給 Owner，改動已在 `main`，當 bug 走 `diagnosing-bugs` 往前修，不回滾。spec 維持未完成。
- `Request: #<n>` 的 `Fixes #<n>` 移到設 `done` 的那個 commit，否則 Request 會在驗證前就被關閉。
- `After:` 一個 awaiting 的 spec 時可以繼續，因為它已在 `main`。
- workflow **Commits** 的「On `main`, commit only what passed verification」加上例外：awaiting 的 OS-bound verification。
- workflow **Continue**：Awaiting 群組改成掃 `main` 上已 commit 的 spec（`Status` 不是 `done` 且有 awaiting 行），不再看 `origin/<slug>`。不算 Ready、不算 In progress。每台裝置都列出，並標明這台能不能跑。
- workflow **Routes** 的 Direct 條件 3：「a change with an OS-bound verification this device cannot run is never Direct」保留，因為 Direct 沒有 spec 可以掛待辦。
- `global.md` 的 Push policy：刪除「except one handed over for OS-bound verification」和 `git push -u origin <slug>` 的例外，只剩 `main`。
- Drift hook 的 `ask`、`auto` 兩則訊息：刪除 OS-bound verification handover 的字樣，`auto` 的第二句也隨之簡化。
- `templates/project.md`：「handed over as `workflow.md` step 4 says」改成新說法。
- `/sync-workflow` 不用改，template 改動走現有機制。

**Glossary**

- `CONTEXT.md` 的 **Batch run**、**OS-bound verification**、**Phase** 已更新，隨這份 spec commit。

## Testing Decisions

- 這個改動只有規則文字和一個 skill，沒有新邏輯，不新增自動化測試。好的驗證看的是外部結果：git 狀態和最後的報告，不是 skill 的內部步驟。
- **自動**：`project.md` 的 Verification 指令全部通過。Drift 訊息改字後，`tests/drift.test.cjs` 要繼續過；目前沒有測試比對到 handover 字樣。
- **手動**：在 session scratchpad 的 throwaway repo（含 bare remote）跑一次 `/drain`，保留輸出當證據。至少涵蓋：
  - `After:` 鏈，且第二份在第一份 merge 後才解除封鎖。
  - 一份 Needs a plan。
  - 一份 `Execute: sdd`，實際走過 subagent 裡再派 subagent 的路徑；一份 `Execute: inline`。
  - `Merge: ask` 自動 merge；`Merge: manual` 留在分支。
  - 一份驗證失敗：分支留著、`## Comments` 有原因、依賴它的跳過、其他繼續。
  - 一份 OS-bound 驗證這台跑不了：merge 進 `main`，awaiting 行在，`/next` 列出且不算 Ready。
  - 重跑 `/drain`：失敗的分支標成 In progress 且被跳過。
  - push：推或不推都走一次；Deploy paths 的「沒碰才推」用一份碰到的 spec 驗證不推。
- Prior art：`/request-watch` 的手動驗證方式。

## Out of Scope

- 跨 repo 的 Batch run。
- 平行執行多份 spec。
- 修改 Guard，或在 Batch run 期間放行 push。
- 狀態檔或自動接手中斷的分支。
- `/drain` 順便跑 Awaiting 的 OS 驗證。
- `/request-watch`：它把跑不了的 OS-bound 指令算失敗，這個行為不變。
- 遷移進行中的交接分支：kit 的 origin 上沒有。其他 repo 若還有，由 Owner 個別處理。

## Further Notes

- 名稱：`/drain` 是指令，**Batch run** 是詞。`/batch` 排除，它是 Claude Code 的 bundled skill；`/drain` 在官方指令參考裡沒有同名項目。
- 需要 Owner 回來的唯一常態情況，是 `Push: ask` 最後的 Guard 提示；這時前面的工作都已完成。
