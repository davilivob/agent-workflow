Status: done
Merge: auto
Plan: no
Execute: inline

# remove-request-watch

## Problem Statement

Request watch（每小時在 studio 無人值守跑 `/request-watch`，自動 Triage 並套用 Owner 照 `/send-request` 格式寫的 Request）Owner 實際上沒在用。它卻佔了 kit 不少地方：一份 skill、`drift.cjs` 的一整個 `--watch` 模式和約一百行測試、`workflow.md` 一段規則、`project.md` 模板一行預設值、`/sync-workflow` 三處規則、`README.md` 一節、`CONTEXT.md` 一個詞條。每次改動 Request 相關規則（例如接下來 `request-gitea-tea` 要把 Request 擴到 Gitea）都得順帶顧慮它，而且已經 sync 過的 repo 的 `project.md` 都留著一行沒人讀的 `Request watch: studio`。

## Solution

整個移除 Request watch。Request 回到只有一條路：Owner 開 Continue（`/next`）或點名 issue 號碼時才被看到，Triage 之後由 Owner 挑 verdict。`/sync-workflow` 更新既有 repo 時，把 `project.md` 裡殘留的 `Request watch:` 行刪掉，不必詢問。studio 上的排程與狀態檔在各機器本機，由 Owner 手動刪除。

## User Stories

1. 身為 Owner，我要 kit 不再有 `/request-watch` 這個 skill，這樣 skill 清單裡沒有我不用的東西。
2. 身為 Owner，我要 `drift` 不再有 `--watch` 模式，這樣 Drift check 的程式只做 Drift 這一件事。
3. 身為 Owner，我要 `drift` 其他模式（SessionStart hook、`--prompt`、`--tool`、`drift` 命令）的行為完全不變，這樣移除 watch 不會影響每個 session 開場的 Drift 報告。
4. 身為 Owner，我要 `tests/drift.test.cjs` 刪掉 watch 的測試後，其餘斷言照樣全部通過，這樣能確認沒有誤刪共用的程式。
5. 身為 Owner，我要 `workflow.md` 的 **Requests** 一節不再提 Request watch，這樣每個 repo 讀到的 Request 規則只有 Triage 這條路。
6. 身為 Owner，我要 `templates/project.md` 的 `## Sync` 不再有 `Request watch:` 的說明與預設行，這樣新 repo 不會被寫進一個沒人讀的值。
7. 身為 Owner，我要 `/sync-workflow` 更新既有 repo 時，看到 `## Sync` 裡有 `Request watch:` 開頭的行就刪掉，不問我，並併進那次 sync 的 commit，這樣舊 repo 不會留著讓人誤以為功能還在的設定。
8. 身為 Owner，我要那次 sync 的 commit 訊息註明刪了這一行，這樣看 log 就知道 `project.md` 為什麼變了。
9. 身為 Owner，我要 `project.md` 沒有 `Request watch:` 行的 repo，`/sync-workflow` 什麼都不做，這樣不會產生多餘的 commit。
10. 身為 Owner，我要 `/sync-workflow` 新建 repo 時寫出的 `## Sync` 只有 `Push: ask` 和 `Pull: ff`，這樣跟模板一致。
11. 身為 Owner，我要 kit 自己的 `docs/agents/project.md` 也刪掉 `Request watch: studio`，這樣 kit 跟模板一致。
12. 身為 Owner，我要 `README.md` 刪掉 Request watch 一節和 drift 說明裡講 `--watch` 的那句，這樣說明文件不會教我去建一個已經不存在的排程。
13. 身為 Owner，我要 `CONTEXT.md` 刪掉 **Request watch** 詞條，**Triage** 詞條裡講無人值守 Triage 的那句也一併刪掉，這樣詞彙表只描述現存的概念。
14. 身為 Owner，我要 ADR 0001 的 Gitea 修正段落不再說 Request watch 還走 `gh`，改成註明 Request watch 已移除，這樣 ADR 的現況描述正確。
15. 身為 Owner，我要完成報告提醒我到 studio 刪掉每小時跑 `/request-watch` 的 Scheduled task 和 `~/.claude/request-watch.json`，這樣本機的殘留不會被遺忘，也不會繼續每小時叫一個已經不存在的 skill。
16. 身為 Owner，我要 `skills/unattended-run.md` 保留不動，這樣 `/drain`、`/soak-tune`、`/ux-probe` 照常運作。

## Implementation Decisions

- 刪除整份 `request-watch` skill。
- `drift.cjs`：刪除 `--watch` 模式的入口、檔頭說明、狀態檔路徑常數、讀 `Request watch:` 的函式、單一 repo 的 watch 判斷與整個 watch 主程式，以及只有 watch 用到的 `gh` 呼叫函式。其他模式共用的函式（讀 git 狀態、Claim、Push／Pull policy、pool 等）若仍有其他呼叫者就保留；只剩 watch 在用的一併刪除。
- `tests/drift.test.cjs`：刪除 watch 的整段（假 `gh`、watch-home、watch-root 與相關斷言）。
- `workflow.md`：刪除 **Requests** 一節最後的 Request watch 段落；Triage、Apply、Drop、Grill 的文字不動。
- `templates/project.md`：`## Sync` 的說明句刪掉 `Request watch:` 的部分，刪掉預設行 `Request watch: studio`。
- `/sync-workflow`：
  - 第 3 節的 **Request watch** 段落改為：`## Sync` 裡有 `Request watch:` 開頭的行就刪除，連同舊模板說明文字裡以 `` `Request watch:` is the Device code`` 開頭的那句；不問；第 8 節 commit。（實作時補上：手動跑發現舊 repo 的 `## Sync` 說明句也提到 `Request watch:`，只刪值行會留下誤導的說明。）新增整段 `## Sync` 的那段（模板已不帶這行）不必再提。
  - 第 3 節的 Done when 改成「`project.md` 有 `## Sync`，且沒有 `Request watch:` 行」。
  - 第 5 節表格裡 `## Sync` 的預設值只列 `Push: ask`、`Pull: ff`。
  - 第 8 節：update 的 commit 訊息附加詞由 `, add Request watch to project.md` 改為 `, remove Request watch from project.md`（第 3 節刪了那一行時）；「Nothing written」的列舉同步改成「沒有刪 `Request watch:`」。
- kit 自己的 `docs/agents/project.md` 刪掉 `Request watch: studio`。
- `README.md`：刪掉 `## Request watch` 一節，以及 drift 說明最後講 `drift --watch` 的那句。
- `CONTEXT.md`：刪除 **Request watch** 詞條；**Triage** 詞條刪掉「An unattended triage applies on its own …」那句。
- ADR 0001 的「Amendment 2026-11-14: Gitea targets」段落：把「and Request watch」從仍走 `gh` 的清單中拿掉，並加一句 Request watch 已於本 slug 移除。（`request-gitea-tea` 之後會再改寫這段。）
- `skills/unattended-run.md` 不動。

## Testing Decisions

- 好的測試只看外部行為：`drift` 各模式的輸出與 exit code、`/sync-workflow` 實際寫出的檔案與 commit，不看函式內部。
- Verification command：`sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`，刪掉 watch 測試後全部通過。
- 殘留檢查：在 kit 根目錄 grep `Request watch`、`request-watch`、`--watch`（大小寫不拘），排除 `.scratch/`、ADR 0001 那句「已移除」的說明，以及 `/sync-workflow` 裡刪除舊 `Request watch:` 行的規則本身，應該沒有結果。
- 手動跑 skill（kit 對 skill／模板改動的既有作法）：在 session 的 scratchpad 建一個一次性 repo，`docs/agents/workflow.md` 是舊版模板、`docs/agents/project.md` 的 `## Sync` 有 `Request watch: studio`，跑 `/sync-workflow` 的 update 模式，確認該行被刪、其他行不變、commit 訊息帶 `, remove Request watch from project.md`；再對一個沒有該行的一次性 repo 跑一次，確認不產生 commit（工作流程已同步時）。保留輸出作為證據。

## Out of Scope

- studio 上的 Scheduled task 與 `~/.claude/request-watch.json`：在各機器本機，由 Owner 手動刪除；不寫 `setup.sh --check` 偵測。
- Request 的 Gitea 支援：見 `request-gitea-tea`（它 `After:` 本 spec）。
- `.scratch/request-watch/` 等已完成 spec 的歷史紀錄：不改。

## Further Notes

- 起因是 Request #8 的 grill（2026-11-14）：Owner 在決定 watch 要不要一起支援 Gitea 時，表示根本沒在用，直接刪掉。
- 完成後 Owner 要在 studio 手動做：Claude desktop app → Scheduled，刪掉跑 `/request-watch` 的任務；刪除 `~/.claude/request-watch.json`。
