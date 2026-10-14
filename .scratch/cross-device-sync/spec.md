Status: done
Merge: ask
Plan: yes
Execute: sdd

# cross-device-sync

## Problem Statement

Owner 在 Mac Studio、MacBook、Windows 三台裝置上開發同一批 repo。偏好在 Mac 上開發，但不少專案要在 Windows 上才能跑。現有的 Drift 會報告落後、領先和未 commit 的改動，但跨裝置不同步仍然常發生，自動的 `pull --ff-only` 或 push 常常被擋下。主因有四個：

1. **`/sync-workflow` 自己製造分岔。** `workflow.md` 第一行的 `Template:` 記的是 kit 的 `HEAD`。kit 每多一個 commit（包括每個 Proposal），所有專案下次 sync 都會多一個只改第一行的 commit。兩台裝置各 sync 一次，就是兩個改同一行的 commit，必定衝突。sync 也不 fetch 目標 repo、不檢查目前在哪個 branch，所以 commit 可能疊在落後的基底上，或落在別的 branch。kit 有沒 push 的 commit 時，sync 照樣跑，寫進去的 sha 在其他裝置上根本不存在。
2. **commit 留在單一裝置上。** agent 只在 Owner 開口時才 push。工作做完、Owner 換到另一台裝置時，那些 commit 還在原來那台上。
3. **kit 本身在不同裝置上版本不同。** 在專案 repo 裡開的 session 從不檢查 kit 是否落後或領先。也沒有任何東西提醒某個專案的 `Template:` 已經比本機的 kit 舊。
4. **只能在另一個 OS 驗證的改動無處交接。** branch 只存在本機，Windows 看不到 Mac 上寫完、等 Windows 驗證的 branch。

另外，kit 和 sync 出去的 repo 都沒有 `.gitattributes`，換行完全看每台裝置的 `core.autocrlf`。設錯的 Windows 裝置會把 CRLF commit 進去，和 Mac 版的每一行都不同。

## Solution

- **push 改由 agent 主動發起，Owner 在 Guard 的權限框上同意。** Guard 本來就對一般 push 回傳 `ask`，現在改掉的是文字規則：agent 回報工作完成時，如果 `main` 上有沒 push 的 commit，就發起 push；session 開頭 Drift 報 ahead 時也提議 push。branch 仍然不 push，唯一例外是 OS-bound verification。
- **`/sync-workflow` 不再製造分岔。**
  - `Template:` 記最後一個改到 `templates/workflow.md` 的 kit commit。範本沒變，第一行就不變。
  - sync 前先確認目標 repo 在 `main` 並且是最新的，kit 沒有沒 push 的 commit。
  - sync 完立刻提議 push。
  - 寫入 `.gitattributes`。
- **Drift 也檢查 kit**：kit 落後而且乾淨就 ff；領先就提議 push；專案的 `Template:` 內容比本機 kit 舊就報告一行，建議跑 `/sync-workflow`。
- **OS-bound verification 的交接**：`project.md` 的驗證指令可以標註只在某個 OS 跑。在別的 OS 上寫完這類改動的 branch 會 push 出去，由對應 OS 的裝置在 Continue 裡看到、補驗證、merge、push。刪遠端 branch 交給 Owner。

## User Stories

1. 身為 Owner，我要 agent 回報工作完成時，若 `main` 上有沒 push 的 commit，就主動發起 push，讓我在權限框上點一下就送出，這樣我換到另一台裝置時工作已經在 remote 上。
2. 身為 Owner，我要每一次 push 都經過 Guard 的權限框，這樣 agent 無法在我不知情時 push。
3. 身為 Owner，我要 force、delete、tag、mirror 等 push 仍然交給我執行，這樣放寬 push 不會順帶放寬危險的 push。
4. 身為 Owner，我要 push 被拒絕時 agent 停下來告訴我，不會 pull、merge 或 rebase 硬推，這樣分岔永遠由我決定怎麼處理。
5. 身為 Owner，我要 session 開頭 Drift 報 ahead 時，agent 提議 push 上次留下的 commit，這樣上次忘了 push 的工作會被收拾掉。
6. 身為 Owner，我要 agent 不會為了 branch 上的 commit 提議 push，這樣權限框不會多到讓我煩，branch 也照舊只在本機 merge。
7. 身為 Owner，我要範本沒變時，`/sync-workflow` 不產生任何 commit，這樣兩台裝置各跑一次 sync 不會衝突。
8. 身為 Owner，我要 `Template:` 記的 sha 在任何裝置上都一樣（只要範本內容一樣），這樣 sync 出來的 bytes 和裝置無關。
9. 身為 Owner，我要 3-way 比對照樣能找到 BASE 範本，這樣 sync 仍然能分辨 behind、ahead、diverged。
10. 身為 Owner，我要目標 repo 不在 `main` 時 sync 停下來，這樣 sync 的 commit 不會落在別的 branch。
11. 身為 Owner，我要 sync 先 fetch 目標 repo，落後而且乾淨就 `pull --ff-only`，分岔或有未 commit 的改動就停下來問我，這樣 sync 的 commit 不會疊在舊的基底上。
12. 身為 Owner，我要 kit 有沒 push 的 commit 時 sync 停下來並提議 push kit，這樣不會把其他裝置找不到的 sha 寫進專案。
13. 身為 Owner，我要 sync 的 commit 一做完就被提議 push，這樣其他裝置看不到它的時間盡量短。
14. 身為 Owner，我要 sync 寫入 `.gitattributes` 讓文字檔在 repo 裡一律是 LF，這樣 Windows 上的 `core.autocrlf` 設錯也不會產生整檔差異。
15. 身為 Owner，我要 `.bat`、`.cmd`、`.ps1` 保持 CRLF，這樣它們在 Windows 上照常運作。
16. 身為 Owner，我要已經有 `.gitattributes` 的 repo 只被補上缺的那幾行，這樣我原本的設定不會被蓋掉。
17. 身為 Owner，我要加入 `.gitattributes` 會讓既有檔案重新正規化時，agent 先問我，再用另一個獨立的 commit 處理，這樣大量換行差異不會混進 sync 的 commit。
18. 身為 Owner，我要在專案 repo 開 session 時，kit 落後而且乾淨就自動 ff，這樣每台裝置用的規則都是最新的。
19. 身為 Owner，我要 kit 有沒 push 的 commit 時，session 開頭提議 push kit，這樣 kit 不會停留在某一台裝置上。
20. 身為 Owner，我要專案 `workflow.md` 的範本內容比本機 kit 舊時，session 開頭報告一行並建議 `/sync-workflow`，但不自動跑，這樣我知道要同步，又不會被突然塞進 commit。
21. 身為 Owner，我要 `Template:` 還是舊格式（記 kit `HEAD`）的專案，只要範本內容和目前一樣就不被報為落後，這樣改格式不會一次讓所有專案都亮紅燈。
22. 身為 Owner，我要 kit 的檢查連不上 remote 時報 Unknown，不當成沒問題，這樣檢查失敗不會帶給我錯誤的安全感。
23. 身為 Owner，我要 session 開在 kit 自己裡面時，kit 不被檢查兩次，這樣報告不重複。
24. 身為 Owner，我要多一次 kit 的 fetch 不會讓 SessionStart 檢查超時，這樣開 session 的速度不變。
25. 身為 Owner，我要 `project.md` 的驗證指令可以標註 `(windows)` 或 `(macos)`，這樣 agent 知道哪些驗證這台裝置跑不了。
26. 身為 Owner，我要在 Mac 上完成、卻需要 Windows 驗證的 branch 被 push 出去，並在它的 spec 裡寫下還缺哪些驗證，這樣 Windows 那台拿得到它，也知道要跑什麼。
27. 身為 Owner，我要這類 branch 的 `Merge:` 一律當成 `manual`，這樣沒驗證過的東西不會進 `main`。
28. 身為 Owner，我要在 Windows 上跑 Continue 時，看到一組「等 Windows 驗證」列出這些遠端 branch，這樣我知道這台有事要做。
29. 身為 Owner，我要 Windows 那台驗證通過後 merge 到 `main` 並提議 push，刪除遠端 branch 的指令交給我，這樣交接收尾乾淨，危險的 push 仍然由我執行。
30. 身為 Owner，我要 Drift 報的 Unknown、落後加未 commit、分岔三種情況仍然問我，這樣會動到我工作的決定還是我的。

## Implementation Decisions

- **push 規則（`global.md`）**：「只在 Owner 要求時 push」改成：agent 可以自行發起 push，Guard 的權限框就是 Owner 的同意。
  - 何時提議：回報工作完成時 `main` 上有沒 push 的 commit；session 開頭 Drift 報 ahead。
  - branch 不 push，OS-bound verification 是唯一例外。
  - 不變的部分：只能 fast-forward 目前 branch 到它的 upstream；force、delete、tag、mirror、refspec 帶 `+` 或 `:` 的 push 都是 Owner 的；被拒就停，不 pull、merge、rebase；`project.md` 保留 `git push` 的 repo 照舊全歸 Owner。
  - 「一次要求涵蓋 repo 當時的狀態」這句刪掉，因為同意改成發生在每一次 push。
- **Guard 不改。** 它對一般 push 已經回傳 `ask`，對危險 push 已經 deny。
- **`Template:` 的值**：寫入時取 kit 裡最後一個改到 `templates/workflow.md` 的 commit。
  - 比較「是否落後」時用內容：專案的 sha 與 kit `HEAD` 之間的 `templates/workflow.md` 沒有差異，就算一致。舊格式的 sha（kit `HEAD`）因此不會被誤判。
  - sync 只在要寫入新內容時才改第一行。內容一致時不改，也不 commit，所以舊格式的第一行可以一直留著。
- **`/sync-workflow` 的事前檢查**，依序執行，任何一步停下都不寫任何檔案：
  1. 目標 repo 必須在 `main`，否則停下並說明。
  2. fetch 目標 repo。落後而且乾淨就 `pull --ff-only`；分岔或有未 commit 的改動就用 `AskUserQuestion` 問 Owner：先處理、或停下。
  3. kit 必須不領先 origin（有 remote 時）。有沒 push 的 commit 就停下，並提議 push kit。
- **sync 之後**：commit 後立刻依新的 push 規則提議 push 目標 repo。
- **`.gitattributes`**：sync 確保目標 repo 有 `* text=auto eol=lf`，以及 `*.bat`、`*.cmd`、`*.ps1` 的 `eol=crlf`。
  - 檔案存在時只補缺的行。
  - 若 `git add --renormalize` 會改到既有檔案，先用 `AskUserQuestion` 問 Owner，同意後另做一個獨立的 commit。
  - kit 自己的 repo 也加上同樣的 `.gitattributes`。
- **Drift 的 session 模式**多一項 kit 檢查。
  - kit 的位置是 `~/.claude/kit`，跟隨 symlink。
  - 與 session repo 的 fetch 並行，共用既有的時限。
  - 結果和 session repo 一樣分 FF／ASK／提議 push 三種：
    - kit 落後而且乾淨 → FF
    - kit 落後而且有未 commit 的改動 → ASK
    - kit 領先 → 提議 push
    - 連不上 → Unknown
  - session repo 就是 kit 時跳過這項。
- **Drift 的 Template 檢查**：session repo 有 `docs/agents/workflow.md` 時，用上述內容比較法比對本機 kit。落後就輸出一行，建議 `/sync-workflow`；專案記的 sha 在本機 kit 找不到時，輸出一行說明「kit 可能落後」。
- **Drift 對 ahead 的規則**從「只提示一行」改成「提議 push」，和 push 規則一致。Unknown、落後加未 commit、分岔維持 ASK。
- **OS-bound verification**：
  - `project.md` 範本的驗證段落說明可以在指令後標註 `(windows)` 或 `(macos)`。
  - 執行 spec 的 session 跑不了某條標註指令時：其餘驗證照跑；在 spec 底部的 `## Comments` 寫下還缺哪些 OS-bound verification；push 這個 branch；不 merge。
  - 這類改動不走 Direct，因為 Direct 要求整個實作在同一個 session 內完成。
  - Continue 新增一組「等 <OS> 驗證」：列出 `origin` 上名字是某個 slug、而那個 spec 還沒 `done` 的 branch，只列出缺的驗證是這台 OS 的那些。
  - 對應 OS 的 session 接手：checkout 那個 branch，跑缺的驗證，通過就照 `Merge:` merge 到 `main`，提議 push `main`，再把刪除遠端 branch 的指令交給 Owner。
- **`setup.sh --check`**：kit 的 `.gitattributes` 不屬於安裝項目，不檢查。

## Testing Decisions

- 好的測試只看外部行為：Drift 輸出的文字和規則標記，以及 sync 後目標 repo 的檔案和 commit。不測內部函式。
- **Drift**：延用 drift 的既有測試做法，用臨時 bare repo 和 clone 模擬 remote 與裝置，新增以下案例：
  - kit 落後而且乾淨 → FF
  - kit 領先 → 提議 push
  - kit 連不上 → Unknown
  - session repo 就是 kit → 不重複
  - 專案 `Template:` 內容落後 → 報一行
  - 舊格式 sha 但內容一致 → 不報
  - sha 在 kit 找不到 → 報 kit 可能落後
  - session repo ahead → 規則是提議 push
- **Guard**：行為不變，既有測試照跑即可。
- **`/sync-workflow`**：在 scratchpad 裡用一個 bare repo 和兩個 clone 模擬兩台裝置，各跑一次 sync，確認：
  - 範本沒變時兩邊都不產生 commit
  - 範本有變時兩邊產生的 commit 內容相同，第二台 pull 不衝突
  - 不在 `main`、目標落後、kit 領先，三種情況各自停下
  - `.gitattributes` 正確寫入或補行
  
  保留輸出作為證據。
- **OS-bound verification 與 push 規則**：屬於文字規則，在 scratchpad 的 repo 手動走一遍並保留輸出。
- 驗證指令照 `project.md`：`sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`。

## Out of Scope

- 自動處理分岔、落後加未 commit、Unknown。這三種仍然由 Owner 決定。
- 用 GitHub Actions 的 Windows runner 跑驗證。
- Guard 解析 Deploy paths。部署前的提問屬於 `deploy-ec2-template`。
- 刪除遠端 branch 的自動化。這是 Owner 的 delete push。
- 已經有 CRLF 的既有 repo 的大規模清理，只在 sync 時逐一詢問。
- `.scratch/` 裡既有的舊 spec。

## Further Notes

- `deploy-ec2-template` 是 `After: cross-device-sync`，因為它用到這裡放寬後的 push 規則。
- `cross-repo-requests` 和本 spec `Overlaps: low`：兩者都在 Continue 加一組，加在不同區塊。
- 尚未確認 `graphify claude install` 會不會寫入只屬於某台裝置的內容，例如絕對路徑或依版本而異的輸出。plan 階段先查；會的話，把它列為 sync 造成分岔的另一個來源，一併處理或寫進 `docs/silent-failures.md`。
