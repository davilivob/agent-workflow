Status: ready-for-agent
Merge: auto
Plan: no
Overlaps: kit-guard-hooks — low: 兩者都改 `setup.sh` 與 `tests/setup.test.sh`，但本 spec 只動依賴安裝那一段與參數處理，kit-guard-hooks 只新增一段 guard 安裝；各加各的，互不改對方的區塊。

# kit-trim-skills

## Problem Statement

`setup.sh` 用 `-s '*'` 裝了 mattpocock/skills 的全部四十多個 skill。其中二十個是 model-invoked，description 每一輪都佔 context；有幾個與 pipeline 重疊或衝突（`implement`、`tdd`、`code-review` 會和 superpowers 的執行步驟搶觸發；`grill-me`、`grilling`、`grill-with-docs` 觸發詞互相重疊），多數在 199 份 transcript 裡用過零次。

另外，「pipeline 的依賴是否齊全」寫在三處：`setup.sh` 的安裝段、`init-workflow` 的 preflight（graphify）與 report（to-spec、grill-with-docs、superpowers）。pipeline 多一個依賴就得改三處。

`templates/triage-labels.md` 的對照表左右兩欄完全相同；唯一讀它的 skill（`setup-matt-pocock-skills`）已從本機移除。

## Solution

`setup.sh` 只裝一份保留清單上的 skill，缺哪個補哪個；本機多出來、不在清單上的 mattpocock skill 只印 `TODO:` 讓 Owner 自己清。`setup.sh --check` 只回報缺少的依賴、不安裝任何東西，成為「依賴是否齊全」的唯一判斷處，`init-workflow` 改呼叫它。刪掉 `triage-labels.md` Template。

保留清單（本機已依此清理完畢）：

- pipeline 本體：grill-with-docs、grilling、domain-modeling、to-spec、diagnosing-bugs
- 有在用：writing-for-agents、writing-great-skills、improve-codebase-architecture、codebase-design、resolving-merge-conflicts、prototype、wizard
- Owner 指定保留：wayfinder、teach、wait-what、research
- 推薦試用：handoff（`workflow.md` 允許 session 中斷時寫 handoff）、retro（把 lesson 收進 `project.md`）、to-questionnaire（grill 中把別人的決定轉成問卷）

## User Stories

1. 身為 Owner，我要 `setup.sh` 只安裝保留清單上的 skill，這樣新裝置不會載入我從來不用的 description。
2. 身為 Owner，我要保留清單只寫在 `setup.sh` 的一個地方，這樣增刪一個 skill 只改一行。
3. 身為 Owner，我要 `setup.sh` 補裝清單上任何缺少的 skill，而不是只檢查其中兩個，這樣之後加進清單的 skill 下次跑就會到每台裝置。
4. 身為 Owner，我要 `setup.sh` 用一次呼叫只裝缺少的那些，這樣重跑不會重裝或覆蓋已經在的 skill。
5. 身為 Owner，我要清單上的 skill 全都在時 `setup.sh` 完全不連網，這樣每次 `git pull` 後重跑仍然快、離線也能跑。
6. 身為 Owner，我要 `setup.sh` 對本機裝了但不在清單上的 mattpocock skill 印一行 `TODO:`，附上可直接執行的移除指令，這樣我能自己清理裝置。
7. 身為 Owner，我要 `setup.sh` 永遠不自己刪 skill，這樣刪除仍是我的決定。
8. 身為 Owner，我要從其他來源裝的 skill 不出現在那份報告裡，這樣 `TODO:` 只列 kit 負責的東西。
9. 身為 Owner，我要 `setup.sh --check` 對每個缺少的依賴（清單上的每個 skill、graphify、superpowers）印一行 `TODO:`，且不安裝任何東西，這樣我能看出裝置缺什麼而不改動它。
10. 身為 Owner，我要 `setup.sh --check` 不動 `CLAUDE.md` 和 skill 連結，這樣檢查沒有副作用。
11. 身為 Owner，我要 `setup.sh --check` 在有缺少時以非零狀態結束，這樣呼叫端不必解析文字就能分辨齊全與否。
12. 身為執行 `/init-workflow` 的 agent，我要 preflight 改跑 `setup.sh --check`，且只在它回報缺 graphify 時停下，這樣 graphify 的偵測不再有自己的一份。
13. 身為執行 `/init-workflow` 的 agent，我要最後的報告直接轉述 `setup.sh --check` 的 `TODO:` 行作為缺少的依賴，這樣依賴清單只存在於 `setup.sh`。
14. 身為 Owner，我要刪掉 `templates/triage-labels.md`，這樣不會再有 repo 拿到一張每個標籤都對應到自己的表。
15. 身為讀 repo `CLAUDE.md` 的 agent，我要 Triage labels 那節仍寫出五個角色字串，這樣沒有那個檔 `to-spec` 仍能套上 `ready-for-agent`。
16. 身為讀 `issue-tracker.md` 的 agent，我要它指向角色字串的 pointer 改指 `CLAUDE.md` 的 Triage labels 節，這樣沒有懸空的 pointer。
17. 身為 Owner，我要 `/init-workflow` 不再把 `triage-labels.md` 寫進 repo，這樣新 repo 不會拿到它。
18. 身為 Owner，我要已經有 `docs/agents/triage-labels.md` 的 repo 保持原樣，這樣這次改動不需要在 update 模式加遷移步驟。
19. 身為 Owner，我要 `domain.md` 保留為 Template，這樣「先讀 `CONTEXT.md`、與 ADR 衝突要明講」的規則仍會到每個 repo。

## Implementation Decisions

- **保留清單**：放在 `setup.sh` 依賴段開頭的一份清單，即上面 19 個名字。mattpocock 的安裝指令把缺少的名字以空格分隔接在 `-s` 後面（skills CLI 接受這種寫法；逗號不行）。
- **「存在」** 的定義沿用現狀：`~/.claude/skills/<name>` 存在。
- **多餘報告**：一個 skill 算 kit 負責，條件是 skills CLI 記錄它是從 `mattpocock/skills` 裝的。plan 階段找出 CLI 把這筆記錄放在哪；讀不到就安靜跳過報告，不要猜。所有多餘的 skill 列在同一行 `TODO:`，附可直接執行的 `npx -y skills@latest remove -g -y <names>`。
- **`--check`**：`setup.sh` 唯一接受的參數。只跑依賴偵測（清單上的 skill、graphify、superpowers），對無法自行安裝的項目印出與一般執行相同的 `TODO:` 行，不安裝、不建連結、不動 `CLAUDE.md`。有印出任何 `TODO:` 就以 1 結束，否則 0。一般執行在 global import 與 skill 連結上的行為不變。
- **`init-workflow`**：preflight 第 4 步改為「跑 `sh ~/.claude/kit/setup.sh --check`；若有一行提到 graphify，停下並請 Owner 跑 `setup.sh`」。報告步驟裡「Present means …」那段換成「轉述 `setup.sh --check` 的 `TODO:` 行」。寫入表格裡照抄的檔案拿掉 `triage-labels.md`。
- **Template**：刪掉 `triage-labels.md`。`claude-section.md` 的 Triage labels 小節保留寫出五個角色字串的那句，拿掉「See …」pointer。`issue-tracker.md` 指向 `triage-labels.md` 取角色字串的那行，改指 `CLAUDE.md` 的 Triage labels 節。

## Testing Decisions

- 一個 seam：在拋棄式 `HOME` 下跑 `setup.sh`，沿用現有 setup 測試的做法。測試只檢查使用者看得到的東西：`HOME` 底下的檔案與連結、印出的 `TODO:` 行、結束狀態、`npx` 被呼叫時的參數。
- `PATH` 最前面放一個假 `npx`，只記錄參數，不碰網路。
- 案例：
  - 清單全在 → 不呼叫 `npx`。
  - 缺幾個 → `npx` 只呼叫一次，`-s` 後面恰好是缺少的名字。
  - 有一個多餘的 mattpocock skill → 有一行 `TODO:` 提到它；跑完後它的目錄仍在。
  - `--check` 且有缺 → 印出 `TODO:`、結束狀態 1、沒呼叫 `npx`、沒建連結、`CLAUDE.md` 不變。
  - `--check` 且全在 → 沒有 `TODO:`、結束狀態 0。
- 既有斷言（import 行恰好一次、既有 `CLAUDE.md` 行完好、kit skill 已連結、陌生目錄不被動）繼續通過；測試目前預先建兩個 skill 目錄的替身，改成預先建整份清單。
- `init-workflow` 的改動依 `project.md`，在 scratchpad 的拋棄式 repo 裡手動跑一次 `/init-workflow`，保留輸出作為證據。

## Out of Scope

- 在任何裝置上自動移除多餘的 skill。
- 從已經有 `docs/agents/triage-labels.md` 的 repo 刪掉它。
- guard hook 與 `global.md`／`workflow.md` 去重（kit-guard-hooks）。
- `init-workflow` update 模式拆成獨立檔案、把 Overlaps 規則移出 `workflow.md`（之後另開 spec）。
- `issue-tracker.md` 內 `Status:` 說法前後不一。
- plugin（superpowers、ponytail）及其 skill。

## Further Notes

- 本機的多餘 skill 已由 Owner 手動移除；merge 後第一次跑應該不會印出多餘報告。
- 其他裝置要等 Owner push、並在那台重跑 `setup.sh` 才會生效。
