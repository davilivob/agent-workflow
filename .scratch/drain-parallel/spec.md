Status: ready-for-agent
Merge: ask
Plan: no
Execute: inline

# drain-parallel

## Problem Statement

`/drain` 的 Batch run 一次只做一份 spec：寫 plan、執行、驗證、merge 全部做完，才開始下一份。互不相干的 spec 也排成一列，Owner 要等很久才拿得到結果，大部分時間都花在等前一份的 subagent 跑完。

但不是每份 spec 都適合同時跑。有的會互相衝突，有的會搶同一個 port 或資料庫，有的改的正是別人要用的驗證工具。每個專案、每份 spec 的情況都不一樣，為了快而一律平行，只會換來更難收拾的失敗。

## Solution

**Batch run** 改成由主持 session 判斷哪些 spec 可以一起跑：可以的就平行寫 plan、平行執行，各自在自己的 branch 上；不適合的排隊，並寫明原因。開跑確認時，Owner 會看到「一起跑」和「排隊」兩組，可以在同一個問題裡改分組。

merge 仍然一份一份在 `main` 進行，先做完的先 merge。`main` 被弄壞時才分得清是哪一份造成的。同時進行的 spec 最多 3 份。`Worktree: no` 的 repo 只有一個 checkout，照舊一次一份。

## User Stories

1. As the Owner, I want independent specs in a Batch run executed at the same time, so that the run finishes sooner.
2. As the Owner, I want specs that still need a plan to get their plans written side by side at the start, so that planning does not hold up the whole run.
3. As the Owner, I want the agent to judge, per spec, whether running it alongside others is safe, so that the run is not fast at the cost of tangled failures.
4. As the Owner, I want each spec that waits its turn to carry a one-sentence reason in the confirmation list, so that I can see why it was not parallelised.
5. As the Owner, I want to regroup specs in the same confirmation question, so that I can override the agent's judgement without a second round.
6. As the Owner, I want specs with `Overlaps: medium` on each other kept apart by default, so that a likely merge conflict does not hit two half-finished specs at once.
7. As the Owner, I want a spec that changes tests, verification tooling or build config to run alone, so that other specs are not verified against tooling in flux.
8. As the Owner, I want specs whose verification competes for one resource (a fixed port, one local database, one simulator) kept apart, so that verifications do not fail because of each other.
9. As the Owner, I want a very large spec allowed to run alone, so that it does not starve the others of tokens or machine resources.
10. As the Owner, I want at most 3 specs in flight at once, so that nested subagents do not blow up token use and machine load.
11. As the Owner, I want a freed slot filled by the next eligible spec straight away, so that the run keeps moving.
12. As the Owner, I want specs merged in the order they finish, `After:` still respected, so that a slow spec does not hold up finished ones.
13. As the Owner, I want merges into `main` done one at a time, so that a broken `main` points to exactly one merge.
14. As the Owner, I want a spec that fails to stop alone while the others in flight carry on, so that one failure does not waste the rest.
15. As the Owner, I want the whole run to stop merging when `main` breaks, with in-flight specs left on their branches, so that nothing stacks on a broken base.
16. As the Owner, I want the run past the Context limit to dispatch nothing new but finish every spec already in flight, so that no work is cut short halfway.
17. As the Owner of a `Worktree: no` repo, I want the run to stay one spec at a time, so that specs never share one checkout.
18. As the Owner, I want `.scratch/batch-run` and `/next` to keep working as before, so that another session still sees every queued slug as In progress.
19. As the Owner, I want the final message to say which specs ran side by side, so that I can judge whether the agent's grouping was sound.
20. As the Owner, I want a re-run after an interruption to read state from git as before, so that parallel execution adds no state file.

## Implementation Decisions

- 只改 `/drain` skill 本身，以及 `CONTEXT.md` 的 **Batch run** 定義（grill 時已改好，跟這份 spec 一起 commit）。`workflow.md` 對 Batch run 的描述只說「一個 session 主持每個步驟」，沒有說要依序，所以不必改。
- **分組**（section 1 列清單時）：每份要跑的 spec 歸入「一起跑」或「排隊」。符合以下任一條件就排隊，並寫一句原因：
  - 跟 run 裡另一份 spec 有 `Overlaps: medium`；
  - 改的是測試、驗證工具或 build 設定本身；
  - 驗證要搶共用資源，例如固定 port、同一個本機資料庫、同一台模擬器；
  - 規模大到單獨就會吃掉大量 token 或機器資源；
  - 其他 agent 讀完 spec 判斷有風險的情況，寫明理由。
  `After:` 和 `Overlaps: high` 照現行規則，本來就要等，不算進這份清單。
- **排隊的意思**：排隊的 spec 不跟任何其他 spec 同時跑，要等手上全部做完才開始，它自己跑時也不派新的。
- **確認**（section 2）：清單分成兩組。`AskUserQuestion` 的 Other 讓 Owner 用文字改分組，Owner 的回答優先於 agent 的判斷。
- **並行上限**：同時最多 3 份 spec。一份 spec 從開始寫 plan 起，到 merge、失敗或跳過為止，都佔一個位置。有位置空出來，就從順序裡挑下一份可以跑的補上。上限不寫進 `project.md`。
- **派工**：plan 和 execute 的 subagent 都在背景跑，主持 session 在各自完成時被喚醒，跟目前一樣只收結果摘要。worktree 和 branch 由主持 session 依序開好，再交給 subagent。
- **進 `main` 的 git 操作由主持 session 依序做**，以免多個 subagent 同時改 `main` 時撞到 git 的 lock 或互相覆蓋。plan 的 subagent 照 workflow step 3 寫好 `plan.md`，連同 Claim 規則，但把 commit 交回主持 session，由它依序 commit 進 `main`。
- **merge 順序**：先做完的先 merge。`After:` 指向的 spec 要先 merge。每次 merge 後跑 section 1 的 lookups，把解除封鎖的 spec 排進來，但不會排進 In progress 的 slug。Overlaps low 或 medium 的衝突照 workflow step 4，由後 merge 的一方依 spec 的寫法解；沒寫或寫的不涵蓋實際衝突，就 `git merge --abort`，該份算失敗。
- **驗證**：照舊，主持 session 在 merge 前自己在該 branch 跑 Verification。各 branch 的驗證不同時跑，在 merge 的序列裡依序跑，避免它們搶資源。
- **失敗**：照現行規則，該份單獨停下，其他繼續。
- **`main` 壞掉**：不再 merge，也不再派新的 spec。正在跑的 subagent 讓它們在自己的 branch 上收完，主持 session 不 merge，也不寫 `Batch run failed` 那一行。留下的 branch 就是 Claim，下次 `/drain` 會列成 In progress。最後的訊息列出這些 spec 停在哪裡。
- **Context limit**：門檻仍是 200k，每次 lookups 之後、派下一份之前檢查。超過了就不再派新的，正在跑的全部做完並照常 merge，之後才進 section 4。沒開始的 spec 是 Left for the next run。
- **`Worktree: no`**：不分組，一次一份，跟現在一樣。確認清單直接說明原因。
- **最後的訊息**：多一項，列出哪些 spec 是一起跑的。

## Testing Decisions

- 這個 seam 就是 `/drain` skill 本身：在 scratchpad 建一個用完即丟的 repo（`Worktree: yes`，驗證指令是簡單的 shell 測試），放幾份很小的 spec，在那裡依照這個 worktree 裡的 `skills/drain/SKILL.md` 實際跑一次 Batch run。
- 要涵蓋的情境：兩份互不依賴的 spec 會一起跑；一份 `After:` 其中一份的 spec，要等那份 merge 後才開始；一份改驗證腳本的 spec 會被排隊並附原因；一份故意讓驗證失敗的 spec 單獨失敗，其他照常 merge。
- 證據：確認清單的分組、各 branch commit 時間有重疊、merge 一次一個、最後的訊息。保留這些輸出。
- 再跑 `project.md` 的 Verification 指令。這次沒有改到 hooks 或 setup，應該照舊通過。
- 先例：`.scratch/drain/spec.md` 當初的驗證方式。

## Out of Scope

- 驗證指令本身平行跑。
- 並行上限做成 `project.md` 的設定。
- 跨 repo 的 Batch run。
- 用多個 session 取代 subagent 來執行 spec。

## Further Notes

- `Execute: sdd` 的 subagent 還會再開自己的 subagent。3 份同時跑時，subagent 的總數大約是單份的三倍，所以上限定在 3。
