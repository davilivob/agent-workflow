Status: ready-for-agent
Merge: ask
Plan: no
Execute: inline
Request: #2
Request: #3

# sync-policy

## Problem Statement

kit 對 push 和 pull 只有一套規則，套在每個 repo 上：

- 每次 push 都等 Guard 問 Owner，而且只在回報完成時才提議 push。my-friend 的記錄大多是 Owner 在 iPhone 上透過 Studio 的 Remote Control 寫的，push 卡在 Guard 的提示上，記錄就留在 Studio，mbp 拉不到。
- `main` 跟 origin 分岔、或 push 被拒時，`global.md` 禁止 pull、merge、rebase，只能停下來問 Owner。my-friend 有三個寫入端（Studio、mbp 上的 Claudian、兩台的 Obsidian Git），分岔會是常態；記錄多是新增檔或新增行，rebase 幾乎不會衝突。2026-10-18 就實際發生一次：mbp push 被拒，origin 上有 Studio 的 3 個 commit，兩邊沒碰同一個檔，仍得停下來等 Owner 同意才 rebase。
- 「把 `git push` 保留給 Owner」雖然已經是 `project.md` 能宣告的事，但只寫在 `global.md` 的一句話裡，Guard 不讀，全靠 agent 自覺。

## Solution

每個 repo 在 `project.md` 的 `## Sync` 段落宣告兩個政策，一個 repo 一個值，所有裝置共用：

- **Push policy**：`Push: owner | ask | auto`，沒寫就是 `ask`。
  - `owner`：push 全歸 Owner，Guard 直接擋下。取代 `global.md` 原本「reserves `git push`」那句。
  - `ask`：現行行為，Guard 每次 push 都問 Owner。
  - `auto`：`main` 一 commit 就立刻 push，Guard 不問。只放行 `main`。
  - 三種政策下，force、delete、tag、mirror、refspec（`+` 或 `:`）的 push 都照舊只歸 Owner；碰到 Deploy paths 的 push 照舊先用 `AskUserQuestion` 問。
- **Pull policy**：`Pull: ff | rebase`，沒寫就是 `ff`。
  - `ff`：現行行為。
  - `rebase`：只用在 `main`。開場的 Drift 報告顯示 `main` 跟 origin 分岔（既落後又超前），或 `main` 的 push 被拒時，agent 跑 `pull --rebase`，成功後立刻再 push 一次。不安全時退回現行做法，停下來問 Owner。

Guard 讀 Push policy 來決定擋、問或放行；drift 讀兩個政策，開場時印出跟這個 repo 宣告相符的規則文字。

## User Stories

1. 身為 Owner，我要在一個 repo 的 `project.md` 寫 `Push: auto`，這樣那個 repo 的記錄一 commit 就上 GitHub，其他裝置拉得到。
2. 身為 Owner，我要 `Push: auto` 只對 `main` 的 push 生效，這樣交接給別台裝置做 OS 驗證的分支 push 仍會先問我。
3. 身為 Owner，我要在 `Push: auto` 的 repo，agent 在 `main` 上 commit 完就立刻 push，不等回報完成，這樣記錄不會因為 session 沒收尾就卡在本機。
4. 身為 Owner，我要 `Push: auto` 時，碰到 Deploy paths 的 push 仍先用 `AskUserQuestion` 問我，這樣 `auto` 不會讓部署跳過我。
5. 身為 Owner，我要 force、delete、tag、mirror、refspec 的 push 在任何政策下都只歸我，這樣 `auto` 不會變成改寫歷史的後門。
6. 身為 Owner，我要沒寫 `Push:` 的 repo 照舊每次 push 都由 Guard 問我，這樣既有的 repo 行為不變。
7. 身為 Owner，我要在 `project.md` 寫 `Push: owner`，Guard 就實際擋下 agent 的每一次 push，並請 agent 把指令交給我，這樣保留 push 不再只靠 agent 自覺。
8. 身為 Owner，我要 `Push:` 寫錯或讀不到檔案時一律當成 `ask`，這樣打錯字不會意外放行。
9. 身為 Owner，我要 Guard 依 push 實際執行的目錄所屬的 repo 判斷政策，這樣 agent `cd` 到另一個 repo 再 push 時，套用的是那個 repo 的宣告。
10. 身為 Owner，我要在一個 repo 的 `project.md` 寫 `Pull: rebase`，這樣多個寫入端造成的 `main` 分岔不用每次停下來等我。
11. 身為 Owner，我要 `Pull: rebase` 只在兩種情況下觸發：開場的 Drift 報告顯示 `main` 分岔，或 `main` 的 push 被拒，這樣 rebase 不會在我沒預期的時候發生。
12. 身為 Owner，我要 `Pull: rebase` 只用在 `main`，其他分支分岔時照舊回報後問我，這樣功能分支的歷史不會被自動改寫。
13. 身為 Owner，我要 checkout 有沒 commit 的改動時，agent 不 rebase、改用 `AskUserQuestion` 問我，這樣我手上的改動不會被藏起來或弄丟。
14. 身為 Owner，我要本機有其他分支或 worktree 包含那些還沒 push 的 `main` commit 時，agent 不 rebase、改問我，這樣那些分支之後合回來不會讓 commit 重複出現。
15. 身為 Owner，我要 rebase 撞到衝突時，agent 先 `git rebase --abort`，再停下來問我，這樣衝突永遠由我決定怎麼解。
16. 身為 Owner，我要 push 被拒而 rebase 成功後，agent 立刻再 push 一次；又被拒就停下來告訴我，不 rebase 第二次，這樣不會無限重試。
17. 身為 Owner，我要 rebase 之後的那次 push 照 Push policy 走（`ask` 由 Guard 問，`auto` 直接放行），這樣兩個政策各管各的。
18. 身為 Owner，我要沒寫 `Pull:` 或值認不得的 repo 照舊只 `pull --ff-only`，這樣既有的 repo 行為不變。
19. 身為 agent，我要 session 開場的 Drift 報告直接印出這個 repo 宣告對應的規則，這樣我不用另外讀 `project.md` 才知道能不能 rebase、push 會不會被問。
20. 身為 Owner，我要 `/sync-workflow` 在新 repo 的 `project.md` 寫入 `## Sync`，裡面是 `Push: ask` 和 `Pull: ff`，不問我，這樣預設值看得見，要改時知道改哪一行。
21. 身為 Owner，我要 `/sync-workflow` 更新既有 repo 時，缺 `## Sync` 就補上預設值，已有的不動，這樣我改過的值不會被蓋掉。
22. 身為 Owner，我要 kit 自己的 `project.md` 也有 `## Sync`，寫 `Push: ask` 和 `Pull: ff`，這樣 kit 跟模板一致。
23. 身為 Owner，我要 `global.md` 的 push 條文、push 被拒的規則、Drift 規則都改成「依 `project.md` 的 Push policy／Pull policy」，這樣規則本身說清楚例外在哪。
24. 身為 Owner，我要 `CONTEXT.md` 有 **Push policy** 和 **Pull policy** 兩個詞條，**Owner** 的定義也跟著改，這樣各 repo 的 session 講同一套詞。

## Implementation Decisions

- **宣告的位置與格式**：`docs/agents/project.md` 新增 `## Sync` 段落，裡面各一行 `Push: <value>` 和 `Pull: <value>`。`templates/project.md` 在 `## Remote` 之後、`## Rules and lessons` 之前加這一段，寫上預設值。
- **讀取規則**：取該 repo git toplevel 下的 `docs/agents/project.md`，找行首的 `Push:` 和 `Pull:`。沒有檔案、沒有那一行，或值不在允許清單裡，Push 就當 `ask`，Pull 就當 `ff`。Guard 和 drift 都照這個規則讀；兩個 hook 可以各自寫一個很小的 reader，不必另外做共用模組。
- **Guard（`checkBash()` 的 push 分支）**：
  - owner-only push（現有的 `isOwnerOnlyPush()`）：照舊 deny。
  - `Push: owner`：deny，訊息說明這個 repo 的 push 歸 Owner，請 agent 把指令交出去。
  - `Push: auto`：只有在 push 執行的目錄目前在 `main` 分支上，而且 refspec 不是空的就是 `main` 時，才不輸出任何決定、直接放行；其他情況照 `ask` 處理。
  - `Push: ask`：照現狀 ask。
  - repo 由 `cd` 後的目錄決定，這是 `checkBash()` 現有的做法。一個指令裡有多個 push 時，只要有一個不放行，整個指令就照最嚴的那個處理。
- **drift（`--session`）**：讀 session 所在 repo 的兩個政策，依政策挑選 `FF`、`ASK`、`PUSH` 的規則文字：
  - `Pull: rebase` 時，`main` 分岔不再走「先問 Owner」那段文字，改印 rebase 的規則，包括 Q9 那三種會退回去問 Owner 的情況。
  - `Push: auto` 時，PUSH 那段改說「`main` 超前就直接 push」。
  - `Push: owner` 時，PUSH 那段改說「把 push 指令交給 Owner」。
  - kit 自己那一塊（`~/.claude/kit`）讀的是 kit 自己的 `project.md`。
  - drift 檔頭註解寫明這些文字是 `global.md` 條文的副本，改了 `global.md` 要一起改。
  - `drift` 指令（不帶參數，掃描多個 repo）只報狀態、不印規則，維持不動。
- **`global.md`**：
  - 改 push 條文：拿掉「the Guard asks the owner at every push」和句尾「reserves `git push`」，改成依 Push policy 的三種值。force、delete、tag、mirror、refspec 歸 Owner、只能 push `main`、OS 交接分支第一次 push 的規定都保留。
  - 改「A rejected push」那句：預設照舊停下來；`Pull: rebase` 且是 `main` 時，照 rebase 規則做，再 push 一次。
  - 改 Drift 相關條文：`main` 分岔且 `Pull: rebase` 時，照 rebase 規則做，不先問。
  - rebase 規則只寫一次（觸發條件、三種退回問 Owner 的情況、只重試一次），其他條文引用它。
  - 「If a fast-forward fails, stop … never merge or rebase instead」那句加上 `Pull: rebase` 的例外。
- **`/sync-workflow`**：
  - new／existing 模式寫 `project.md` 時，`## Sync` 照模板寫入預設值，不問 Owner。
  - update 模式：`project.md` 缺 `## Sync` 就照模板的位置補上預設值，commit 訊息加上 `, add Sync to project.md`；已有的不讀、不改。
- **kit 自己的 `docs/agents/project.md`**：補上 `## Sync`，寫 `Push: ask` 和 `Pull: ff`。
- **`CONTEXT.md`**：**Push policy**、**Pull policy** 兩個詞條和 **Owner** 定義的修改，已在 grill 時寫好，跟這份 spec 同一個 commit。

## Testing Decisions

- 只測從外面看得到的行為：把 hook 的 JSON 餵給 hook，看它輸出的決定或文字；不測 reader 的內部。
- **`tests/guard.test.cjs`**：用現有的 `repo()` 和 `bash()` 建幾個暫存 repo，各寫一份帶 `## Sync` 的 `docs/agents/project.md`，斷言：
  - `auto`：在 `main` 上的 `git push` 和 `git push origin main` 放行（`none`）。在其他分支上 push、或 `git push origin feature`，都是 `ask`。`git push --force` 仍是 `deny`。
  - `owner`：`git push` 是 `deny`。
  - `ask`、沒寫、值認不得、沒有 `project.md`：都是 `ask`。
  - `cd <auto repo> && git push`，從另一個 repo 的 cwd 發出：依 auto repo 判斷。
- **`tests/drift.test.cjs`**：用現有的 `session()`、`expect()` 和 `RULES` 表：
  - `Pull: rebase` 的 repo，`main` 分岔時印 rebase 規則而不是「ask the owner」；`Pull: ff` 或沒寫的 repo，照現有斷言。
  - `Push: auto` 和 `Push: owner` 的 repo 超前時，各印對應的 PUSH 文字。
  - `RULES` 表需要時加上新的鍵。
- **`/sync-workflow`**：照 `project.md` 的 Verification，在 session 的 scratchpad 建一個暫存 repo，手動跑一次 new 模式和一次 update 模式（後者的 `project.md` 先刪掉 `## Sync`），留下輸出當作證據。
- `global.md` 的條文沒有自動測試，交給 `code-review` 的 Spec 軸對照這份 spec 檢查。

## Out of Scope

- `Pull: report`（只回報、連乾淨的 checkout 也不 ff）：沒有 repo 需要，等真的需要再加。
- 依裝置分開設定政策：宣告只以 repo 為單位。
- `auto` 放行 `main` 以外的 push，包括 OS 交接分支的第一次 push。
- `main` 以外的分支自動 rebase。
- 用 `--autostash` 在有未 commit 改動時 rebase。
- my-friend 那邊的改動：建一份只有 `## Sync`（`Push: auto`、`Pull: rebase`）的 `docs/agents/project.md`，把 `CLAUDE.md`「運作」裡 push 和分岔那兩條改成引用宣告。由 my-friend 自己的 session 在這份 spec merge 並 push 之後做。
- Obsidian Git 的設定：它不經過 Claude，kit 不管。

## Further Notes

- 這份 spec 來自 Request #2（push 政策）和 #3（pull 政策），兩者都由 `davilivob/my-friend` 提出，在同一場 grill 裡合併處理。最後一個 commit 帶上 `Fixes #2` 和 `Fixes #3`。
- 這份 spec 不需要 ADR：決定之後要推翻並不難，現有規則也已經說明了理由。
- `Push: owner` 取代的那句話，目前沒有任何 repo 在用（mbp 上 `~/Documents/program` 底下的 `project.md` 都查過），不需要遷移。
