Status: ready-for-agent
Merge: ask
Plan: no
Execute: inline
Overlaps: session-claim — low: 兩者都改 `templates/workflow.md`，但 session-claim 只改 step 3（Plan）與「Continue」節；本 spec 改「When the pipeline applies」、step 1、step 2、step 4 與「Spec and Plan」節，不碰 step 3 與「Continue」。
Overlaps: kit-guard-hooks — low: 兩者都改 `templates/workflow.md` 的 step 4，但 kit-guard-hooks 只縮「No PR」那一行（外加 Commits 節與 Owner boundary 節）；本 spec 在 step 4 新增 inline 執行的分支，不動「No PR」那行。

# kit-optional-spec

## Problem Statement

現在每個有設計決策的改動都得走完 grill → spec → (plan) → SDD，而且每一步各開一個新 session。要不要寫 plan 已經交給 agent 在 grill 最後一輪判斷，但 spec 和 SDD 仍是必經。結果是：grill 已經把決策講清楚、改動小到當下這個 session 就做得完的工作，也得先寫 spec、等 Owner review、再開新 session 派 subagent，每個 task 還附兩層 review。流程成本遠大於改動本身。

現行的「小改動免 pipeline」只涵蓋沒有設計決策的改動；有設計決策但很小的那一段沒有出口。

## Solution

引入 **Route**：一個 grill 過的改動走到 `main` 的路徑。只有三條：

| Route | spec | plan | 誰實作 |
| --- | --- | --- | --- |
| **Direct** | 無 | 無 | grill 的 session 自己 inline 做完 |
| **Inline** | 有（`Execute: inline`） | 無 | 新 session 自己 inline 做 |
| **SDD** | 有（`Execute: sdd`） | 有或無 | 新 session 用 `superpowers:subagent-driven-development` |

Route 與要不要 plan 由 agent 在 grill 最後一輪判斷，附一行理由，Owner 只負責否決。`Merge:` 仍由 Owner 決定。不走 SDD 的 Route，merge 前跑一次 `code-review`（medium）補上 review。

## User Stories

1. 身為 Owner，我要 agent 在 grill 最後一輪直接說出這次走哪條 Route 並附一行理由，這樣我只要回「好」或「改成 X」，不必自己判斷。
2. 身為 Owner，我要 `Merge:` 仍由我決定，這樣 merge 這個動作始終在我手上。
3. 身為 Owner，我要小而決策已定的改動可以在 grill 的同一個 session 直接做完，這樣不必為一個小改動開三個 session。
4. 身為 Owner，我要走 Direct 時由 diff 驗收，而不是先讀一份 spec，這樣 review 的對象就是結果本身。
5. 身為 Owner，我要 Direct 只在四個條件同時成立時才能選，這樣大改動不會悄悄繞過 spec review。
6. 身為 Owner，我要跟還沒 merge 的 spec 有 `After:` 或 `Overlaps:` 關係的改動一律寫 spec，這樣依賴與衝突的解法仍有地方記錄。
7. 身為 Owner，我要 Direct 的 session 中斷時補寫 spec 交接，這樣做到一半的工作不會只存在於一段死掉的對話裡。
8. 身為 Owner，我要寫了 spec 但份量小的改動可以不派 subagent，這樣不必為兩三處文字修改付 SDD 每個 task 兩層 review 的成本。
9. 身為 Owner，我要不走 SDD 的改動在 merge 前仍跑一次 `code-review`，這樣 template 這種會發到每台裝置的改動仍有人看過。
10. 身為 Owner，我要走 SDD 時照舊不另跑 `code-review`，這樣不會重複 review。
11. 身為 Owner，我要「不寫 spec 卻跑 SDD」被禁止，這樣 grill 的 session 不會被 subagent 的輸出塞爆，subagent 也永遠有一份文件可依據。
12. 身為 Owner，我要「inline 卻寫 plan」被禁止，這樣不會為一個沒有 subagent 要讀的 plan 付成本。
13. 身為執行的 session，我要 spec 標頭的 `Execute:` 告訴我要 inline 還是 SDD，這樣我不用猜。
14. 身為執行的 session，我要 `Execute:` 沒寫時視為 `sdd`，這樣既有的 spec 不必改。
15. 身為寫 spec 的 session，我要 `Execute: inline` 一定搭配 `Plan: no`，這樣標頭不會自相矛盾。
16. 身為跑「Continue」的 agent，我要 `Execute: inline` 的 spec 因為 `Plan: no` 自然落在 Ready，這樣「Continue」的規則不必改。
17. 身為走 Direct 的 session，我要照樣取一個 slug、照 `Worktree:` 開 worktree 或分支、commit 用 `[<slug>]` 前綴，這樣它跟其他 Route 的痕跡長得一樣。
18. 身為走 Direct 的 session，我要把 grill 最後一輪 Owner 給的 Merge 決定寫進最後一個 commit 的 message，這樣沒有 spec 標頭時仍有紀錄。
19. 身為走 Direct 的 session，我要 grill 中寫下的 `CONTEXT.md` 與 ADR 先在 `main` 以 `[<slug>] context: ...` commit，再開 worktree，這樣 worktree 從帶著這些詞彙的 `main` 分出去。
20. 身為 Owner，我要「Always a design decision」清單只強制走 grill、不強制寫 spec，這樣清單的意義不變。
21. 身為 Owner，我要既有的「小改動免 pipeline」豁免照舊，並跟 Direct 分開：前者不 grill，後者 grill 過，這樣兩條路不混淆。
22. 身為 grill 中的 agent，我要「先問：現在做／放進 spec」這條規則不變，這樣 grill 途中冒出來的小改動仍由 Owner 點頭。
23. 身為讀 `CONTEXT.md` 的 agent，我要 **Route** 與 Direct、Inline、SDD 是有定義的詞，這樣 `workflow.md` 可以直接用。

## Implementation Decisions

- **`CONTEXT.md`**：新增 **Route**（已在 grill 中寫入），_Avoid_: path, track, mode。
- **`templates/workflow.md`「When the pipeline applies」**：pipeline 的描述從「四步」改為「grill 之後依 Route 走」；「小改動免 pipeline」與其「先問」規則不動。
- **step 1（Grill）**：
  - 「A grill always lands in a written spec or an ADR」改為：grill 永遠落在文字上——spec、ADR，或（Direct）commit 的 message 加 `CONTEXT.md`。
  - 最後一輪改為：Owner 決定 `Merge:`；agent 給出 Route 與要不要 plan，附一行理由，Owner 可否決。
  - Direct 的四個條件，全部成立才可選：
    1. 一個 branch、一次 merge 做得完，不需拆成多份 spec；
    2. 跟任何還沒 merge 的 spec 沒有 `After:` 或 `Overlaps:` 關係；
    3. 不需要 plan，且當下 session 的 context 放得下整個實作；
    4. Owner 在 grill 做的決策看 diff 就能驗收，不需要先讀文件批准。
  - 「Always a design decision」清單只強制 grill，不強制 spec。
- **Direct 的流程**（寫在 step 1 之下或獨立一小段）：取 slug → grill 產生的 `CONTEXT.md`／ADR 在 `main` 以 `[<slug>] context: ...` commit → 照 `Worktree:` 開 worktree 或分支 → inline 實作 → 驗證 → `code-review`（medium）→ 最後一個 commit 的 message 寫明 Merge 決定 → 照該決定 merge。中斷則補寫 spec 交接，之後照 Inline 或 SDD 走。
- **step 2（Spec）**：標頭新增 `Execute: sdd | inline`（沒寫視為 `sdd`）；`inline` 一定搭配 `Plan: no`。
- **step 4（Execute）**：
  - `Execute: sdd`：照現行。
  - `Execute: inline`：同樣開 worktree 或分支，session 自己實作；merge 前跑 `code-review`（medium）。Merge 規則照 `Merge:`。
  - 「Its built-in reviews are the review; do not also run `code-review`」限定在 SDD。
- **「Spec and Plan」節**：Spec 仍是「the only document the owner reviews」，但註明 Direct 沒有 spec，Owner 驗收的是 diff。
- **`templates/issue-tracker.md`**：spec 標頭列舉加上 `Execute:`。
- 不寫 ADR：改規則文字，容易改回來。
- 「Continue」節不改：`Execute: inline` 帶 `Plan: no`，現有 Ready 條件已涵蓋。Direct 沒有 spec，「Continue」看不到它，只能靠 worktree 或分支（session-claim merge 後即為 Claim）。

## Testing Decisions

- 本 spec 只改文字規則，沒有程式可測；seam 是「新版 `workflow.md` 的文字是否涵蓋 grill 的每個決定」。
- 跑 `sh tests/setup.test.sh`，確認沒有破壞既有的安裝測試。
- 逐條比對：Implementation Decisions 的每一條都能在新版 `templates/workflow.md`（或 `templates/issue-tracker.md`、`CONTEXT.md`）找到對應文字；把對照表附在完成報告裡作為證據。

## Out of Scope

- 修改 `grill-with-docs`、`to-spec`、`superpowers:*` 等外部 skill；新規則寫在 `workflow.md`，由執行該步驟的 session 遵守。
- 各 repo 同步新版 `workflow.md`：下次 `/init-workflow` 會看到 behind 的 hunk。
- 用 Guard 機械式地擋「沒有 spec 卻跑 SDD」之類的禁止組合。
- 讓「Continue」看見進行中的 Direct 工作：交給 session-claim 的 Claim。

## Further Notes

- 本 spec 自己就是 Route 判斷的第一個案例：因為跟 session-claim、kit-guard-hooks 有 Overlaps，不符合 Direct 的條件二，所以寫 spec；份量只是幾段文字，走 Inline。
- 「`CONTEXT.md` 先在 `main` commit 再開 worktree」是寫 spec 時補上的細節，grill 中沒有明講；Owner review 時可否決。
