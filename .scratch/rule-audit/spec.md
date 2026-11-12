Status: done
Merge: ask
Plan: no
Execute: inline
Overlaps: ux-probe — low: 兩份都在 `global.md` 的 Phase 清單加字（這份加 `audit`，那份加 `probe`），也都在 `CONTEXT.md` 加名詞；同一行加不同的字，後 merge 的一方照現況補上即可。
Overlaps: soak-tune — low: 同 ux-probe，只碰 `global.md` 的 Phase 清單那一行。

# rule-audit

## Problem Statement

規則長得比內容快。每個 session 遇到問題就順手補一條規則，久了 `CLAUDE.md`、`project.md` 這類規則層會出現四種問題：

- 內容放錯檔，例如「該怎麼做」寫進狀態檔
- 同一件事寫在兩處、講法不一致，或改了一處另一處悄悄過期
- 主詞是 Owner、指派工作給 Owner，而 Owner 從沒要求過的規則
- 工具、hook 或 kit 已經在做的事，規則還在重述

my-friend 用 `longterm-doc-project` 的稽核程序和幾份「規則刪減清單」實際處理過這件事，創作一場夢的規則層從約 62k 字元收到約 2.2k。kit 沒有這套機制，其他 repo 的規則層只會繼續長，而且沒有任何東西提醒 Owner 該檢查了。

## Solution

新增 kit skill `/rule-audit`，跑一次 **Rule audit**：

1. 用子代理讀這個 repo 自己的規則層，找出上面四類問題，每條回原檔核對後才列出。
2. 在對話裡貼一張表，每條標建議的「刪／縮／留／問」，Owner 逐條確認或改標。
3. session 照標記改檔：刪、縮直接改；「留」而且是刻意設計的，在原處加一行短註，下次就不再報；「問」的進 grill。理由寫進 commit message，訊息帶 `[rule-audit]`。

另外，Drift 報告在稽查到期時加一行提醒，只提醒、不自動跑。

## User Stories

1. As the Owner, I want to run `/rule-audit` in any repo that follows the kit, so that its rule layer gets checked on demand.
2. As the Owner, I want the audit to cover only the repo's own rules, so that files the kit carries in are neither reported nor changed.
3. As the Owner, I want the kit's own `templates/`, `skills/` and `global.md` audited when I run it in the kit, so that the kit's rules get the same treatment.
4. As the Owner, I want rule files anywhere in the repo found, including a `CLAUDE.md` inside a subfolder, so that nested rule layers are not missed.
5. As the Owner, I want content in the wrong file reported, so that each file keeps one job.
6. As the Owner, I want duplicates that disagree or would silently go stale reported, so that I never act on the wrong copy.
7. As the Owner, I want rules that hand me work I never asked for reported, so that an unapproved to-do list does not pile up.
8. As the Owner, I want a rule with no traceable origin marked "no source found" and recommended for deletion, so that I can decide quickly.
9. As the Owner, I want rules that a tool, hook or the kit already enforces reported, so that the rule layer shrinks to what only text can do.
10. As the Owner, I want a deliberate "summary plus pointer" not reported, so that intentional design is not flagged as duplication.
11. As the Owner, I want the known false-positive kinds left out, so that the table stays worth reading.
12. As the Owner, I want every finding checked against the actual file before it reaches me, so that I never review a phantom.
13. As the Owner, I want each finding to say its kind, where it is, its size, where it should go, why, and whether moving it breaks a pointer, so that I can judge it without opening files.
14. As the Owner, I want findings ranked by how likely they are to make someone act wrongly, so that the worst come first.
15. As the Owner, I want a separate list of what looks like a problem but should stay, so that nothing deliberate gets deleted by mistake.
16. As the Owner, I want each finding to carry a recommended mark (delete, trim, keep, ask), so that I can mostly just confirm.
17. As the Owner, I want to confirm or change each mark in chat, so that nothing changes without my say.
18. As the Owner, I want delete and trim applied in the same session once I mark them, so that the audit ends with a smaller rule layer, not a to-do list.
19. As the Owner, I want a short note left where I chose keep for a deliberate reason, so that the next audit does not report it again.
20. As the Owner, I want items marked ask to go on to a grill, so that real design questions get their own discussion.
21. As the Owner, I want each change's reason in its commit message tagged `[rule-audit]`, so that the history explains every removal.
22. As the Owner, I want pointers re-checked after the changes, so that no file is left pointing at something gone.
23. As the Owner, I want no audit file committed, so that the decisions live in commit messages only.
24. As the Owner, I want the session-open report to remind me when an audit is due, so that "periodic" actually happens.
25. As the Owner, I want that reminder once more than 30 days have passed since the last `[rule-audit]` commit, so that audits keep a rhythm.
26. As the Owner, I want that reminder once the rule layer has grown more than 25% since then, so that a burst of new rules triggers a check sooner.
27. As the Owner, I want a repo never audited reminded only once its rule layer passes 8k characters, so that small repos are not nagged.
28. As the Owner, I want the reminder to never run the audit itself, so that I decide when.
29. As the Owner, I want the Session title Phase `audit` during a Rule audit, so that it is distinguishable from a code review.
30. As the Owner, I want `/rule-audit` usable only when I run it, so that no session starts trimming rules on its own.

## Implementation Decisions

- **新 kit skill `rule-audit`**：`setup.sh` 現有邏輯會自動連結；設 `disable-model-invocation: true`；寫法比照 `/drain`，分節，每節有 "Done when"。Session title 的 Phase 用 `audit`。
- **`global.md`**：Phase 清單加 `audit`（見 `Overlaps:`）。
- **規則層**（skill 和 Drift 的提醒用同一份定義）：
  - repo 裡任何位置的 `CLAUDE.md`、`AGENTS.md`，跳過 `node_modules`、`.git`、`.claude/worktrees`
  - `docs/agents/` 底下的檔，扣掉 kit 帶進來的那幾個（`workflow.md`、`issue-tracker.md`、`domain.md`、`dev-server.md`）。`project.md` 是專案自己的值，算在內
  - `CLAUDE.md` 裡 `/sync-workflow` 從 `claude-section.md` 插進來的那一段不算
  - `docs/silent-failures.md`、`CONTEXT.md`（含子資料夾的）、`docs/adr/`
  - `.claude/skills/*/SKILL.md`
  - 在 kit 裡另外加上 `templates/`、`skills/`、`global.md`。判斷「是不是 kit」沿用 Drift hook 現有的作法
  - 不提供讓 `project.md` 擴充清單的欄位；真的出現需要的 repo 再加
- **四類問題**：A 錯置、B 有害重複、C 自加規則、D 已被取代的機制。
  - C 的來源查 git log、spec、grill 紀錄；查不到就標「查無來源」，建議刪
  - D 的判準是：Guard、Drift、某個 skill 或 kit 規則已經在做同一件事
- **判準**：先讀該 repo 自己對各檔用途的描述（例如 `workflow.md` 對 `project.md`、`silent-failures.md` 的分工）；沒有的話用 `longterm-doc-project` 稽核程序的通則：狀態檔只放「現在怎樣」、「該怎麼做」一律歸規則檔，觸發時機幾乎重疊的兩檔合併。
- **已知誤報**：`稽核.md` 列的五類原樣搬進 skill（自檢清單與主檔重疊、同一條硬規則在不同層級出現、內嵌圖例、「何時才讀」vs 路由表、與資料緊耦合的操作規則），外加「摘要＋指標」。
- **子代理**：直接讀工作目錄，不另外複製一份（my-friend 的坑來自舊的暫存副本）。只分析、不改檔。主 session 逐條回原檔核對後才放進表。
- **表**：只貼在對話裡，不寫檔。每條寫類型／位置（檔名＋開頭幾個字）／字元數／該去哪／理由（引哪條判準）／搬動會不會斷指向／建議標記。依「會不會讓人照錯的規則行動」排序：說法不一致且影響判斷 → 失效指向 → 序號式引用 → 純錯置。最後另列「看起來像問題、但不該動的」。
- **拍板**：Owner 逐條確認或改標，可以用 `AskUserQuestion` 分批問。標了刪或縮就是已經完整給出答案，不必再 grill。
- **套用**：
  - 刪、縮：一條或一組一個 commit，訊息 `[rule-audit] <動作>: <條目>`，本文寫理由
  - 留而且是刻意設計：原處加一行短註，說明為什麼刻意不改
  - 問：列給 Owner，建議 `/grill-with-docs`，本次不改
  - commit 照 workflow **Commits** 的規則落到 `main`；這個 repo 若要求 worktree，就照 `Worktree:` 走
  - 改完重新 grep 被引用的檔名，確認都存在
- **Drift 提醒**：加在 SessionStart 的 Drift 報告，對 session 所在的 repo 計算。
  - 上次稽查 = `git log` 裡最近一個訊息含 `[rule-audit]` 的 commit，不另開狀態檔
  - 規則層大小 = 上面那份清單的總字元數；「上次」的大小用那個 commit 的檔案內容算
  - 三個條件任一成立就加一行，例如 `rule audit: due (last one 42 days ago); suggest /rule-audit, do not run it`：
    - 距上次超過 30 天
    - 規則層比上次多了 25% 以上
    - 從沒跑過，而且規則層超過 8k 字元
  - 中文翻譯表跟著加一條
  - 這行只是建議，不算 Drift 狀態，不改變報告的 Unknown 判斷
  - 要在 hook 現有的 deadline 內算完；算不出來就不印，不讓整個報告變成 Unknown
- **`CONTEXT.md`**：已在 grill 時加了 **Rule audit**，跟這份 spec 一起 commit。

## Testing Decisions

- 好的測試只看外部行為：hook 印出什麼、skill 跑完 repo 變成什麼樣，不測內部函式。
- **Seam 1：Drift hook 的 SessionStart 輸出**。沿用 `tests/drift.test.cjs` 現有的 `session()`／`expect()` 寫法（Template 那幾個案例就是前例），建用完即丟的 repo，涵蓋：
  - 從沒稽查、規則層 < 8k：沒有提醒
  - 從沒稽查、規則層 > 8k：有提醒
  - 上次稽查在 30 天內、規則層沒長：沒有提醒
  - 上次稽查超過 30 天：有提醒（用 commit 的日期造出來）
  - 上次稽查後規則層長了 25% 以上：有提醒
  - kit 帶進來的 `workflow.md` 再大也不算進規則層
  - 子資料夾的 `CLAUDE.md` 算進規則層
- **Seam 2：`/rule-audit` skill 本身**。在 scratchpad 建一個用完即丟的 repo，規則層刻意埋：
  - 一條錯置（狀態檔裡寫「該怎麼做」）
  - 一組講法不一致的重複（兩檔不同門檻）
  - 一條查無來源、主詞是 Owner 的規則
  - 一條 Guard 已經在擋的規則
  - 一組刻意的「摘要＋指標」
  - 一份 kit 帶進來的 `workflow.md`，裡面也埋一條問題
  
  照這個 worktree 裡的 `skills/rule-audit/SKILL.md` 實際跑一次。要確認：四條埋的問題都被找到並附正確的建議標記；「摘要＋指標」出現在「不該動的」；`workflow.md` 的問題沒被報；照標記套用後 commit 訊息帶 `[rule-audit]`、標「留」的地方有短註、沒有斷掉的指向。保留對話輸出作為證據。
- 再跑 `project.md` 的 Verification 指令。

## Out of Scope

- 程式碼和一般文件（README、其他 docs）：程式碼由 `ponytail-audit` 負責。
- kit 帶進專案的檔：在專案裡跑時不查也不報。
- 自動排程或無人值守的稽查，包括 `/drain` 順便跑。
- 讓 `project.md` 擴充規則層清單的欄位。
- 把刪減表寫成檔案留存。
- `/next` 列出「該稽查了」。

## Further Notes

- 來源：my-friend 的 `longterm-doc-project` skill 的稽核程序（`references/稽核.md`）、`40_Archives/*規則刪減清單.md`、`20_Areas/飲控/archive/稽核-2026-09-01-自生規則複審.md`。C 類「主詞是誰」的判準來自那份自生規則複審。
- my-friend 最後拿掉了長度門檻，改成「Owner 說跑才跑」。這裡保留門檻，但只當提醒線：數字定錯了，成本只是多一行或少一行提醒。
