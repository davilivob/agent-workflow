Status: done
Merge: ask
Plan: no
Overlaps: kit-guard-hooks — low: 兩者都改 `templates/workflow.md`，但 kit-guard-hooks 只刪 Commits 節重複的兩條、縮 step 4 的「No PR」那行、刪 Owner boundary 第一句；本 spec 只改 step 3（Plan）與「Continue」節；各改各的區塊。

# session-claim

## Problem Statement

同一個 checkout 常有兩三個 session 同時開著。Owner 在一個 session 裡跑「Continue」，想知道下一步能做什麼，結果另一個 session 正在寫的 plan 完全看不出來：`plan.md` 要等寫完才 commit，寫的過程中沒有任何痕跡，於是「Continue」把它列成 Needs a plan，還建議開新 session 去寫，等於叫第二個 session 重寫同一份 plan。

`workflow.md` 其實要求「Mark any that another session is already working on and leave them out of Ready」，但沒說怎麼判斷。唯一的訊號是 Owner 在訊息裡說「X just started」。Execute 階段雖然會留下 worktree 與分支，「Continue」也沒被要求去看。

## Solution

引入 **Claim**：一個 session 宣告「這個 slug 由我處理」的可見痕跡，全部沿用檔案與 git 既有的狀態，不加新欄位、不多 commit。

| 階段 | Claim |
| --- | --- |
| 寫 plan | `.scratch/<slug>/plan.md` 存在但還沒 commit（寫 plan 的 session 一開始就寫出只有一行 `Writing` 的空殼） |
| 執行 | `git worktree list` 裡有 `.claude/worktrees/<slug>`，或存在名為 `<slug>` 的分支 |

「Continue」新增第四組 **In progress**，列出有 Claim 的 slug 與它距今多久沒動；這些 slug 不再出現在其他組。過期的 Claim 只報告，由 Owner 決定是否接手。

## User Stories

1. 身為 Owner，我要「Continue」把另一個 session 正在寫 plan 的 spec 列在 In progress，而不是 Needs a plan，這樣我不會開第二個 session 重寫同一份 plan。
2. 身為 Owner，我要「Continue」把正在執行的 spec 列在 In progress，而不是 Ready，這樣我不會叫第二個 session 去執行它。
3. 身為 Owner，我要 In progress 的每一行附上距今多久沒動，這樣我能判斷那個 session 是還在跑，還是已經死了。
4. 身為 Owner，我要過期的 Claim 只被報告、不被自動判定為可接手，這樣兩個 session 同時寫同一份 plan 的事不會發生。
5. 身為 Owner，我要接手一個過期的 Claim 只能由我明說，這樣所有權的轉移永遠在我手上。
6. 身為寫 plan 的 session，我要在確認 spec 已 commit 之後、動手寫之前，先寫出只有一行 `Writing` 的 `plan.md` 空殼，這樣別的 session 立刻看得到我在寫。
7. 身為寫 plan 的 session，我要在開始前發現 `plan.md` 已經存在（不論有沒有 commit）時停下來告訴 Owner、不覆寫，這樣我不會蓋掉別人寫到一半的 plan。
8. 身為寫 plan 的 session，我要用完整的 plan 覆蓋空殼後再 commit，這樣 commit 進 `main` 的永遠是完整的 plan。
9. 身為執行的 session，我不需要額外寫任何標記，因為開 worktree 或分支本身就是 Claim。
10. 身為 `Worktree: no` 專案裡的 Owner，我要主 checkout 上名為 `<slug>` 的分支也算執行中的 Claim，這樣沒有 worktree 的專案同樣適用。
11. 身為跑「Continue」的 agent，我要「Mark any that another session is already working on」改成指向 In progress 這一組，這樣我知道要看哪些痕跡，而不是只靠 Owner 的訊息。
12. 身為跑「Continue」的 agent，我要寫 plan 的 Claim 以空殼的修改時間計算距今多久，執行的 Claim 以該分支最後一個 commit 計算，這樣我不用猜「最後活動時間」怎麼算。
13. 身為讀 `CONTEXT.md` 的 agent，我要 **Claim** 是一個有定義的詞，這樣 `workflow.md` 可以直接說「看 Claim」，不必每次重述痕跡有哪幾種。
14. 身為 Owner，我要「還沒 commit 的 `plan.md` = 有人在寫」和既有的「還沒 commit 的 spec = Owner 在讀」同一個形狀，這樣規則好記。

## Implementation Decisions

- **不新增欄位、不新增檔案類型**：寫 plan 的 Claim 就是還沒 commit 的 `plan.md`；執行的 Claim 就是 worktree 或分支。`Status:` 的值維持 `ready-for-agent` 與 `done`。
- **Plan 步驟（step 3）新增兩條**：
  - 開始前：`plan.md` 已存在（committed 或 untracked 皆然）→ 停下、告訴 Owner、不覆寫。
  - 確認 spec 已 commit 之後的第一個動作：寫出內容只有一行 `Writing` 的 `plan.md`，不 commit；寫完後以完整的 plan 覆蓋，再照原規則 commit。
- **「Continue」節**：
  - 由三組改為四組，新增 **In progress**：有 Claim 的 slug，註明是寫 plan 還是執行，以及距今多久（寫 plan 看空殼的修改時間；執行看分支最後一個 commit 的時間）。
  - 有 Claim 的 slug 不再列入 Needs a plan、Ready、Blocked。
  - 「Mark any that another session is already working on and leave them out of Ready」改寫為指向 In progress。
  - 過期與否不自動判定；只報告時間，由 Owner 決定是否接手。
  - 原本「X just started」表示別碰 X 的那句保留：Owner 的訊息仍是 Claim 之外的另一個訊號。
- **`CONTEXT.md`**：新增 **Claim**，_Avoid_: lock, reservation。
- 兩人同一秒搶到同一份 plan 的競態不處理。

## Testing Decisions

- 本 spec 只改文字規則，唯一的 seam 是「照新規則跑一次『Continue』，看分組對不對」，只看外部輸出。
- 跑 `sh tests/setup.test.sh`，確認沒有破壞既有的安裝測試。
- 人工證據（依 `project.md`：改 template 就在 scratchpad 的拋棄式 repo 手動跑）：拋棄式 repo 裡放三份已 commit 的 spec，分別是
  - 一份帶有未 commit 的 `plan.md` 空殼 → In progress（寫 plan），附時間；
  - 一份有同名 worktree → In progress（執行），附時間；
  - 一份什麼都沒有 → Needs a plan。
  在該 repo 讀新版 `workflow.md` 跑「Continue」，保留輸出作為證據。
- 另在同一個 repo 模擬寫 plan 的 session：`plan.md` 已存在時，它停下而不覆寫。

## Out of Scope

- 跨裝置的可見性：另一台機器上的 session 在做什麼，要等 Owner push 才看得到，本 spec 不處理。
- 用 Guard 機械式地擋「覆寫已存在的 `plan.md`」：先看文字規則的效果。
- 自動判定 Claim 過期或自動接手。
- grill 與寫 spec 階段的 Claim：這兩步由 Owner 親自跑。
- 兩個 session 同一秒搶同一份 plan 的競態。

## Further Notes

- `workflow.md` 改動後，各 repo 下次跑 `/init-workflow` 會看到 behind 的 hunk；本 spec 不處理各 repo 的同步。
- `superpowers:writing-plans` 本身不知道要先寫空殼；這條規則寫在 `workflow.md` 的 Plan 步驟，由執行該步驟的 session 在呼叫 skill 前自行完成。
