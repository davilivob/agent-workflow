Status: done
Merge: ask
Plan: no
Execute: inline
Overlaps: cross-device-sync — low: 兩者都在 `workflow.md` 的 Continue 段落加一組（本 spec 加 Requests，對方加「等 <OS> 驗證」），各自新增在不同位置；後 merge 的一方兩組都保留，解完跑 `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`。

# cross-repo-requests

## Problem Statement

Owner 的專案之間，協作和相互依賴越來越多。常見的有兩種：

- A repo 的某個功能要等 B repo 先改完，例如 API、schema、共用套件。
- 在 A 工作時發現 B 有 bug 或缺東西，想丟一張單給 B，但不想切過去。

現有的機制都只在單一 repo 內有效：`After:` 和 `Overlaps:` 只認同一個 repo 的 slug，本機 ticket 也只存在 `.scratch/` 裡。唯一跨 repo 的管道是 kit 的 Inbox，但它只收 kit 的 Proposal。而且每個 Proposal 都是一個直接 commit 在 kit `main` 上的 commit：它會讓所有裝置的 kit 落後或領先，也讓每個專案下次 sync 時多出 commit，本身就是跨裝置衝突的來源。

## Solution

跨 repo 的單一律開成**被請求那個 repo 的 GitHub issue**，稱為 **Request**，不設中央分配器。

- 新 skill `/file-request`：在 A repo 工作時，agent 起草一張給 B 的 Request，送出前用 `AskUserQuestion` 給 Owner 看標題和內文，同意後才送出。
- kit 的 Proposal 就是以 kit 為目標的 Request。Inbox 退休，`/propose-to-kit` 併入 `/file-request`。
- 每個 repo 的 Continue 都多一組 **Requests**，列出 open 的 Request。Owner 挑一張，就走 Triage（apply、drop、grill），和以前 kit 的 Inbox 一樣。
- spec 可以寫 `After: owner/repo#n`。Continue 查到那張 Request 已經關閉，才算解除封鎖。
- 完成 Request 的 commit 帶上 `Fixes #n`，push 到預設 branch 時 GitHub 會自動關單。

## User Stories

1. 身為 Owner，我要在 A repo 工作時，請 agent 開一張 Request 給 B repo，而不用切過去，這樣發現的問題不會被遺忘。
2. 身為 Owner，我要 Request 送出前先看到標題和完整內文，同意後才送出，這樣不會有我沒看過的東西被公開發佈。
3. 身為 Owner，我要 Request 的內文固定包含 What、Why、會碰到 B 的哪些地方，以及來自哪個 repo，這樣 B 那邊的 session 不需要回頭看 A 的對話就能判斷。
4. 身為 Owner，我要 B repo 的 Continue 列出它所有 open 的 Request，每張一行（編號、日期、來源 repo、一句摘要），這樣我一眼看出有誰在等這個 repo。
5. 身為 Owner，我要挑中一張 Request 時，先得到一份 Triage（它說什麼、為什麼、會碰到什麼、建議的判定和一句理由），這樣我能快速決定。
6. 身為 Owner，我要 Triage 只建議，由我用 `AskUserQuestion` 選 apply、drop 或 grill，在我選之前什麼都不改，這樣決定權在我。
7. 身為 Owner，我要選 drop 時，agent 帶著我給的理由關掉那張 Request，這樣來源 repo 知道它為什麼沒被採納。
8. 身為 Owner，我要選 apply 時，agent 照常開 worktree、驗證、merge，最後一個 commit 帶 `Fixes #n`，這樣 push 時 Request 自動關閉。
9. 身為 Owner，我要選 grill 時，agent 列出我要做的決定後就停下，由我自己跑 `/grill-with-docs <Request 的網址>`，這樣大的變更照常走 grill。
10. 身為 Owner，我要 A repo 的 spec 能寫 `After: owner/B#12`，這樣跨 repo 的依賴和同 repo 的依賴寫法一致。
11. 身為 Owner，我要 Continue 在 `After:` 指向的 Request 還沒關閉時，把這個 spec 列為 Blocked 並說明在等哪張單，這樣我不會在依賴還沒好之前開工。
12. 身為 Owner，我要 `gh` 沒裝、沒登入或連不上時，Requests 組和跨 repo 的 `After:` 都顯示 Unknown，不當成沒有單或已解除封鎖，這樣查不到不會被誤當成沒事。
13. 身為 Owner，我要 kit 的 Proposal 也是 kit repo 上的 GitHub issue，不再是 kit `main` 上的 commit，這樣寫 Proposal 不會讓各裝置的 kit 分岔。
14. 身為 Owner，我要 Proposal 除了一般 Request 的內容之外，還寫明在來源 repo 怎麼試過、結果如何，這樣 kit 的 Triage 知道它不是空想。
15. 身為 Owner，我要 `/generate-kit-proposal` 最後交給 `/file-request` 並以 kit 為目標，這樣兩個入口產出同一種東西。
16. 身為 Owner，我要 kit 的 Continue 和其他 repo 一樣只有一組 Requests，不再有 Inbox 組，這樣所有 repo 的行為一致。
17. 身為 Owner，我要 kit 以外的 session 仍然完全不能編輯 kit，連以前的 `inbox/` 例外也拿掉，這樣 kit 只能透過 Request 改變。
18. 身為 Owner，我要 `[inbox]` 系列的 commit 前綴和 kit `project.md` 的 Inbox 規則被刪除，這樣不留下不再適用的規則。
19. 身為 Owner，我要 Request 和 spec 底下的本機 ticket（issue）用不同的名字，這樣兩種「單」不會混淆。

## Implementation Decisions

- **用詞**：GitHub issue 這個概念叫 **Request**；**Proposal** 是以 kit 為目標的 Request；本機 ticket 照舊叫 issue。Inbox 退休。`CONTEXT.md` 已經按此更新。
- **新 skill `/file-request`**：
  - **輸入**：目標 repo（`owner/repo`，或 kit）和要請求的事。
  - **內文段落**：What、Why、Touches（會碰到目標 repo 的哪些地方）、From（來源 repo）。目標是 kit 時再加 Tried（在來源 repo 怎麼試過、結果）。
  - 送出前用 `AskUserQuestion` 顯示完整標題和內文，同意後用 `gh issue create -R` 送出，回報網址。
  - `gh` 不能用時停下並說明，不改用別的管道。
- **`/propose-to-kit` 刪除**，併入 `/file-request`。名字改了，是因為 Proposal 只是 Request 的一種。`/generate-kit-proposal` 結尾改成交給 `/file-request`，以 kit 為目標。
- **Continue 的 Requests 組**：每個 repo 都用 `gh issue list` 列出 origin repo 上 open 的 issue，每張一行：編號、開單日期、From、What 的第一句。`gh` 失敗時這一組顯示 Unknown。
- **Triage**：沿用 kit `project.md` 原本對 Inbox 的 Triage 規則，搬進 `workflow.md`，因為現在每個 repo 都適用：
  - 對象改成 Request。
  - **apply**：pick a slug，照常 worktree、驗證、merge，最後一個 commit 訊息帶 `Fixes #n`，之後依 push 規則送出。
  - **drop**：用 Owner 給的理由 `gh issue close --comment`。Owner 在 Triage 的選擇就是這次關單的同意。
  - **grill**：列出要做的決定後停下。Owner 跑 `/grill-with-docs <網址>`，產出的 spec 開頭寫 `Request: #n`，執行時最後一個 commit 帶 `Fixes #n`。
- **跨 repo 的 `After:`**：`After: owner/repo#n`。Continue 用 `gh issue view --json state` 判斷，關閉才算已在 `main`；查不到就是 Unknown，列在 Blocked 並註明。
- **Guard**：拿掉「kit 外的 session 可以寫入 kit 的 `inbox/`」這個例外，拒絕訊息改成指向 `/file-request`。
- **kit `project.md`**：刪除 Inbox 段落和 `[inbox]` 前綴，以及 Continue 的第五組 Inbox 說明。
- **README、`workflow.md`** 裡提到 `/propose-to-kit` 或 Inbox 的地方一起更新。
- 現有 `inbox/` 是空的，不需要遷移。

## Testing Decisions

- 好的測試只看外部行為：Guard 對 kit 編輯的允許或拒絕，以及 skill 產出的 Request 內容。
- **Guard**：改寫既有 kit 編輯測試中 `inbox/` 的案例：寫入 kit 的 `inbox/` 現在要被拒絕；拒絕訊息指向 `/file-request`。
- **`/file-request` 與 Requests 組**：skill 屬於文字規則，在 scratchpad 的 repo 手動走一遍：起草、顯示、Owner 拒絕時不送出。
  - 真的送出一張 Request 會發佈到 GitHub，需要 Owner 當下同意並指定一個測試用的 repo；Owner 不同意時就只驗到送出前為止，並在證據裡說明。
  - Requests 組和跨 repo `After:` 的 Unknown，用暫時讓 `gh` 找不到（例如清空 `PATH`）的方式驗證。
- 驗證指令照 `project.md`：`sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`。

## Out of Scope

- 中央 issue 分配器或總覽所有 repo 的儀表板。
- 需要多個 repo 同時上線的需求（breaking change 和所有使用端一起上線）。這種情況很少，手動協調。
- GitHub labels、milestones、projects。
- 把 spec 底下的本機 ticket 改成 GitHub issue。

## Further Notes

- 「Request（含 Proposal）是 GitHub issue，Inbox 退休」記在 ADR 0001。
