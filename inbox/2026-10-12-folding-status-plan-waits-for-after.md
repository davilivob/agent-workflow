Source: 2enter/folding-status @ 3da3009
Date: 2026-10-12
Kind: merges templates/workflow.md「A real dependency … **Before starting, confirm that one is already on `main`** … If not, wait.」
Touches: templates/workflow.md

## What

kit 現行文字（`templates/workflow.md`，folding-status 的 `docs/agents/workflow.md` 相同）：

> - **A real dependency**: this spec uses the other one's code, schema or decisions. Write `After: <slug>`. **Before starting, confirm that one is already on `main`**: `git log main --oneline --grep=<slug>`. If not, wait.

> - **Needs a plan**: specs with `Plan: yes` (or none written) and no `plan.md` in the directory.

第 3 步（Plan）只檢查 spec 本身已 commit，沒有檢查 `After:`。

提議改為：

1. `After:` 那條的「Before starting」改成明說涵蓋寫 plan：「**Before writing its plan or starting it**, confirm that one is already on `main` …」。
2. 第 3 步 Plan 加一條：「**Write a plan only once whatever `After:` (or `Overlaps: high`) names is on `main`**: `git log main --oneline --grep=<slug>`. A plan names exact files and code shapes; written against a dependency still on another branch, it goes stale when that one merges.」
3. 「Continue」的 **Needs a plan** 加上條件「and whatever `After:` (or `Overlaps: high`) names is already on `main`」；不符者列在 **Blocked**，註明它還缺 plan。

## Why

在 folding-status 裡，`kiosk-ui` 和 `sweep-volume` 都寫著 `After: debugger`，且都還沒寫 plan。「Before starting」到底包不包括寫 plan，規則沒有說清楚，「Continue」的 Needs a plan 也沒有檢查 `After:`。所以同一份 spec 分到 Needs a plan 或 Blocked 都說得通。owner 注意到 agent 有時說可以先寫 plan，有時又說要等擋住它的 spec 完工（2026-10-12）。

要等的理由：plan 是照 `main` 上的實際程式碼寫的，裡面有確切的檔案、函式和程式碼形狀。被依賴的 spec 還在別的分支上持續 commit 時（例如 `debugger` 在報告當下幾十秒前才剛 commit），照它寫的 plan 一合併就可能過期。而 plan 是 agent 寫的、owner 不讀，等前一個 spec 合併再寫，成本很低。

## Generality

- **Portable**：只涉及 spec、plan 和 `After:` 的流程，跟技術棧無關。
- **New**：kit 有「開工前確認 `After:` 已上 `main`」這條，但沒說清楚寫 plan 算不算開工，Continue 的分組也沒檢查。這份 Proposal 是把現有規則講清楚，所以標成 merges。
- **A rule, not a value**：每個用這套 pipeline 的 repo 都會遇到，不是哪個 repo 自己的設定值。
