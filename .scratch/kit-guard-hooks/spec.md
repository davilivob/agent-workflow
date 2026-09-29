Status: ready-for-agent
Merge: ask
Plan: yes
Overlaps: kit-trim-skills — low: 兩者都改 `setup.sh` 與 `tests/setup.test.sh`，但本 spec 只新增一段 guard 安裝與對應斷言，kit-trim-skills 只動依賴安裝那一段與參數處理；各加各的，互不改對方的區塊。

# kit-guard-hooks

## Problem Statement

三條規則目前只靠文字守著，而且各寫了兩三遍：

- **不准 brainstorming**：寫在 `global.md` 與 `workflow.md`，但要對抗的是 superpowers 每個 session 開頭注入的「MUST brainstorm」。兩段文字互相比大聲，結果不穩定。
- **`git push` 歸 Owner**：寫在 `global.md`、`workflow.md` 的 pipeline 步驟與 Owner boundary 節。
- **`git commit` 一定帶路徑**：寫在 `global.md` 與 `workflow.md` 兩處。同一個 checkout 常有兩三個 session 同時開著，index 是共用的，不帶路徑的 commit 會把別的 session 剛 `git add` 的檔案一起掃進去。

這些都能機械判定，卻只能靠 agent 讀到並遵守；重複的文字又讓它們在階層上顯得比實際更重要，改一條要改好幾處。

另外，Owner 常得自己去查 agent 到底 commit 了沒有，尤其在 SDD：commit 由 subagent 做，主 agent 收尾時沒把它們列出來。

Guard 不能讓 Owner 守著螢幕：SDD 一次十幾個 commit，每個都跳確認是不可接受的。

## Solution

新增 **Guard**：一個由 `setup.sh` 裝進使用者層級設定的 PreToolUse hook，在工具呼叫前攔下：

| 情況 | 處理 |
| --- | --- |
| 在有 `docs/agents/workflow.md` 的 repo 呼叫 `superpowers:brainstorming` | 拒絕，理由說明 grill 加 `/to-spec` 取代它 |
| 任何形式的 `git push` | 跳出確認 |
| 主 checkout 上不帶路徑的 `git commit` | 拒絕，理由附上改正寫法；agent 自行改寫重試，不經過 Owner |
| linked worktree 裡的 commit | 放行（index 不共用） |
| merge、cherry-pick、revert 衝突解完後的 commit；`--amend --only` | 放行 |
| Guard 解析不了的指令 | 放行（Guard 是防線，不是牆） |

文字規則仍是唯一出處，Guard 是防線。同時去重：每條規則只留一處，並保留一行原因。`global.md` 的「列出每個 commit」改寫成可檢查的完成條件，涵蓋 subagent 的 commit。

## User Stories

1. 身為 Owner，我要 agent 在 kit repo 裡呼叫 `superpowers:brainstorming` 時被直接拒絕，這樣 superpowers 的注入再大聲也不會把 session 帶離 pipeline。
2. 身為 agent，我要被拒絕時的理由告訴我改用 grill 加 `/to-spec`，這樣我知道下一步做什麼，而不是重試。
3. 身為 Owner，我要沒有 `docs/agents/workflow.md` 的 repo 仍能正常使用 brainstorming，這樣 Guard 不會影響不走這套 workflow 的專案。
4. 身為 Owner，我要 agent 執行任何 `git push` 都跳出確認，這樣 push 仍在我手上，即使 permission classifier 某天放行。
5. 身為 Owner，我要 `git -C <dir> push`、串在 `&&` 或 `;` 後面的 push 也被攔下，這樣換個寫法繞不過去。
6. 身為 Owner，我要主 checkout 上不帶路徑的 `git commit` 被拒絕，這樣別的 session staged 的檔案不會被悄悄掃進來。
7. 身為 Owner，我要 commit 規則從不跳確認，這樣 SDD 跑十幾個 commit 時我不必守著螢幕。
8. 身為 agent，我要被拒絕時的理由直接給出改正寫法（`git commit <paths> -F -`），這樣我改寫一次就能繼續。
9. 身為 agent，我要 `git commit <paths> -F -` 搭配 heredoc 的標準寫法直接放行，這樣照規則做事不會被打擾。
10. 身為 agent，我要 `git commit -m "<msg>" <paths>` 與 `git commit -- <paths>` 也放行，這樣任何帶路徑的寫法都算數。
11. 身為 agent，我要 `git commit -a` 與 `--all` 在主 checkout 上被拒絕，這樣「全部都 commit」不會被當成帶了路徑。
12. 身為 SDD 裡的 subagent，我要在 linked worktree 裡的任何 commit 都放行，因為那裡的 index 只屬於這個 worktree。
13. 身為 agent，我要在 merge、cherry-pick 或 revert 衝突解完後不帶路徑的 commit 放行，因為 git 在這些狀態下拒絕部分 commit，帶路徑根本做不到。
14. 身為 agent，我要衝突狀態與「是不是 linked worktree」都依指令實際作用的 git 目錄判斷（包括 `git -C`），這樣判斷不會因為 session 的 cwd 而錯。
15. 身為 agent，我要 `git commit --amend --only` 不帶路徑時放行，因為它只改訊息、不碰 index。
16. 身為 agent，我要不帶路徑也沒有 `--only` 的 `--amend` 在主 checkout 上被拒絕，理由提示改用路徑或 `--only`。
17. 身為 Owner，我要 Guard 解析不了的指令放行，這樣 Guard 的解析漏洞不會把 agent 卡死。
18. 身為 Owner，我要與 git 無關的 Bash 指令完全不受影響，這樣 Guard 不會拖慢或打擾日常工作。
19. 身為 Owner，我要 push 的確認視窗寫明是哪條規則，這樣我一眼就知道為什麼被問。
20. 身為 Owner，我要 agent 每次回報時列出這一輪的所有 commit，包括 subagent 做的，這樣我不必自己去查有沒有 commit。
21. 身為 Owner，我要 `setup.sh` 把 Guard 以冪等的方式合併進使用者層級的 `settings.json`，這樣重跑不會重複登記。
22. 身為 Owner，我要 `settings.json` 裡原有的設定與其他 hook 在合併後都保留，這樣裝 Guard 不會弄壞我的其他設定。
23. 身為 Owner，我要 `settings.json` 不存在時被建立，格式壞掉時 `setup.sh` 停下、原檔不動，這樣它永遠不會覆蓋我讀不懂的設定。
24. 身為 Owner，我要沒有 Node 的裝置印出一行 `TODO:`，這樣我知道那台只剩文字規則。
25. 身為 Owner，我要 Guard 在 Windows 的 Git Bash 下也能運作，這樣每台裝置都有同一道防線。
26. 身為 Owner，我要 `git pull` 後重跑 `setup.sh` 就拿到新版 Guard，這樣它跟 kit 其他部分一起更新。
27. 身為讀 `global.md` 的 agent，我要 commit 與 push 規則在這裡寫一次，附一行原因，這樣所有專案都讀到同一份。
28. 身為讀 `workflow.md` 的 agent，我要它只留 repo 層級的 commit 規則（main 上只 commit 驗證過的、只 `git add` 自己動過的檔案、prefix），這樣不再重述 `global.md`。
29. 身為讀 `workflow.md` 的 agent，我要 Owner boundary 節只留做法（被拒時怎麼說、指令怎麼交給 Owner、用 `read_terminal` 讀結果）加上指向 `project.md` 的 pointer，這樣規則本身只在 `global.md`。
30. 身為讀 `workflow.md` 的 agent，我要「不用 brainstorming」只在這裡寫一行並附原因（grill 加 `/to-spec` 取代它），這樣它跟 pipeline 放在一起。
31. 身為 Owner，我要 `global.md` 裡針對 brainstorming 的那條刪掉，這樣它不再與 `workflow.md` 重複。

## Implementation Decisions

- **Guard**：kit 內一支 Node script，讀 stdin 的 hook JSON，決定 deny、ask 或不表態。以 `hookSpecificOutput.permissionDecision` 加 `permissionDecisionReason` 回傳（ask 只有 JSON 能表達，deny 也走同一條路）。不表態時什麼都不輸出、以 0 結束，交回一般的 permission 流程。
- **登記**：兩個 PreToolUse matcher，`Skill` 與 `Bash`，都指向同一支 script，指令以 `node "$HOME/..."` 形式寫，讓 Git Bash 與 macOS 都能展開。
- **Brainstorming**：Skill 工具輸入的 `skill` 欄位為 `superpowers:brainstorming`，且 session 的專案目錄（`CLAUDE_PROJECT_DIR`，沒有就用 hook 輸入的 `cwd`）所在 repo 有 `docs/agents/workflow.md` → deny。
- **push**：Bash 指令拆成以 `&&`、`||`、`;`、`|`、換行分隔的片段；任一片段是 `git`（中間可帶全域選項如 `-C <dir>`、`-c k=v`）接著 `push` → ask。
- **commit**：同樣拆片段找 `git … commit`，heredoc 內容排除在解析之外。
  - 帶路徑：`--` 之後有東西，或選項之外有位置參數；會吃下一個參數的選項（如 `-m`、`-F`、`-C`、`-c`、`--author`、`--date`、`-t`、`--fixup`、`--squash`、`--trailer`、`--cleanup`）的值不算路徑。`-a`／`--all` 一律當成不帶路徑。
  - 帶路徑 → 不表態。
  - 不帶路徑時，在指令作用的目錄（session cwd，套上 `-C`）問 git：`--git-dir` 與 `--git-common-dir` 不同（linked worktree）→ 不表態；`--git-path` 下存在 `MERGE_HEAD`、`CHERRY_PICK_HEAD` 或 `REVERT_HEAD` → 不表態；帶 `--amend --only` → 不表態；否則 deny，理由附改正寫法。
  - 解析失敗或 git 查詢失敗 → 不表態。
- **安裝**：`setup.sh` 新增一段，以 `node -e` 讀寫使用者層級的 `settings.json`：已含 Guard 的登記就不動；不存在就建立；JSON 解析失敗就印錯誤、不寫入、以非零結束。沒有 `node` → 印 `TODO:` 並跳過這段。
- **去重的落點**：
  - commit 不用問、commit 帶路徑（附 index 共用的原因）、`git push`／production／SSH 歸 Owner → `global.md` 為唯一出處。
  - `global.md` 的「列出每個 commit」改寫為可檢查的完成條件：回報前用 `git log --oneline <本輪起點>..HEAD` 列出這一輪的所有 commit，含 subagent 做的，每個一行、放在回覆開頭。
  - `workflow.md` 的 Commits 節刪掉與 `global.md` 重複的兩條；pipeline 步驟裡的「No PR. `git push` is always the owner's.」縮成「No PR.」；Owner boundary 節刪掉第一句的規則本身、保留其餘做法。
  - brainstorming → `workflow.md` 保留一行，`global.md` 刪除。

## Testing Decisions

- 好的測試只看外部行為：餵進 hook JSON，看輸出的決定與結束狀態；不測內部的解析函式。
- **Seam 1，Guard 本身**：新的 Guard 測試，以 stdin 餵 JSON、斷言 deny／ask／無輸出。每種情況至少一個 case，git 相關的在暫存目錄用真的 git 造出狀態：
  - brainstorming 在有與沒有 `workflow.md` 的 repo。
  - push：單獨、`-C`、串在 `&&` 後 → ask。
  - commit 在主 checkout：`<paths> -F -` 加 heredoc（heredoc 內含 `git commit` 字樣也不誤判）、`-m` 加路徑、`--` 加路徑 → 無輸出；只有 `-m`、`-a`、`--amend` → deny；`--amend --only` → 無輸出；merge 衝突中（造出 `MERGE_HEAD`）→ 無輸出。
  - commit 在 linked worktree：只有 `-m` → 無輸出；`git -C <worktree>` 從主 checkout 發出 → 無輸出。
  - 無關指令（`ls`、`git status`）→ 無輸出。
- **Seam 2，安裝**：沿用 setup 測試的拋棄式 `HOME`。跑兩次後 `settings.json` 裡 Guard 恰好登記一次；預先放進去的其他 key 與 hook 都還在；預先放一份壞掉的 `settings.json` 時 `setup.sh` 失敗且原檔不變。
- 新的 Guard 測試加進 `project.md` 的驗證指令。
- merge 前的人工證據：在真的 Claude Code session 裡試一次 `git push` 看到確認視窗；在主 checkout 試一次不帶路徑的 commit，看到拒絕與 agent 自行改寫；呼叫一次 brainstorming，看到拒絕。

## Out of Scope

- 攔 `git add -A`／`git add .`（commit 帶路徑已涵蓋）。
- 攔 SSH 與 production 指令（各 repo 定義不同，留在 `project.md` 的文字規則）。
- 停用 superpowers 的 SessionStart 注入（沒有官方機制）。
- 用 hook 提醒 agent 回報 commit（subagent 的 commit 在它自己的 context 裡，主 agent 收不到；改由 `global.md` 的完成條件處理）。
- 把 Guard 做成 plugin，或把 kit 改成 plugin。
- `setup.sh --check` 回報 Guard 是否已安裝。
- 保留清單、`--check`、刪 `triage-labels.md`（kit-trim-skills）。

## Further Notes

- 每條規則的 deny／ask 只是 Guard 裡的一個值；Owner 覺得 push 的確認很煩時可以改。
- `workflow.md` 改動後，各 repo 下次跑 `/init-workflow` 會看到 behind 的 hunk；本 spec 不處理各 repo 的同步。
- merge 後 Owner 要在本機重跑 `sh ~/.claude/kit/setup.sh` 才會裝上 Guard；其他裝置在 push 之後同樣如此。
