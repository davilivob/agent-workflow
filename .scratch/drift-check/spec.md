Status: ready-for-agent
Merge: ask
Plan: no
Execute: inline
Overlaps: response-language — medium: 兩者都改 `setup.sh` 第 4 節寫 `~/.claude/settings.json` 的那段 node 程式（response-language 加 `language`，本 spec 加 SessionStart hook），也都在 `tests/setup.test.sh` 的 Guard 檢查後面加斷言、在 `README.md` 加一行。後 merge 的一方解衝突：兩邊的新增都保留，同一次寫檔完成，「沒有缺的就提早結束」的條件要同時考慮兩者；解完跑 `sh tests/setup.test.sh && node tests/guard.test.cjs`。

# drift-check

## Problem Statement

Owner 平常在三台機器上工作：Mac Studio、MacBook、Windows。每台都有同一批 repo 的 local checkout，靠 GitHub 交換。沒有任何東西會告訴 Owner 某台機器上的 repo 已經和 remote 不一致，例如落後 remote、有 commit 還沒 push、有未 commit 的修改，或某個 branch 從沒上過雲端。

這是一步錯、步步錯的問題：在落後的 `main` 上開工，後面的 spec、plan、code 全是建立在舊狀態上，發現時要整串重來；在一台機器上沒 push 就離開，換到另一台時那份工作根本不存在。更糟的是「看起來沒事」：檢查本身失敗（離線、認證錯誤、逾時）卻被當成沒問題，Owner 會帶著錯誤的安全感開工。

## Solution

在 kit 裡加入 **Drift** 檢查，由 `setup.sh` 在每台機器安裝，分兩個入口：

1. **開 session 時**：Claude Code 的 SessionStart hook 先 `git fetch`，再檢查目前所在的 repo，包括目前所在的 branch，以及預設 branch（`main`）是否落後。
   - 落後，或狀態是 **Unknown**：agent 在動任何檔案之前，先用 `AskUserQuestion` 讓 Owner 選「`pull --ff-only`／先不管／停下來」。
   - ahead、未 commit 的修改、沒有 upstream：只提示一行，不擋。
2. **`drift` 指令**：在 terminal 裡跑，掃描這台機器設定的所有根目錄底下的 git repo，每個 repo 先 fetch，列出所有 Drift、Unknown 和 no remote。適合收工前或換機器前跑一次。

最高原則：**無法確認的狀態一律報 Unknown，永遠不當成沒有 Drift。** 機制只會 `git fetch`，從不自動 pull 或 push。

## User Stories

1. 身為 Owner，我要開 session 時，若目前所在 repo 的 `main` 落後 `origin/main`，agent 在動任何檔案前先問我，這樣我不會在舊的 code 上開工。
2. 身為 Owner，我要 session 開在 worktree 裡（目前的 branch 沒有 upstream）時，`main` 的落後一樣被偵測到，這樣最常見的開工方式不會讓檢查失效。
3. 身為 Owner，我要目前所在 branch 有 upstream 且落後時，同樣在開工前被問，這樣任何 branch 的落後都擋得住。
4. 身為 Owner，我要被問時有三個選項：`pull --ff-only`、先不管、停下來，這樣決定權在我手上，agent 不會自己 pull。
5. 身為 Owner，我要選 `pull --ff-only` 而無法 fast-forward 時，agent 停下來告訴我，不嘗試 merge 或 rebase，這樣分歧的歷史不會被自動處理掉。
6. 身為 Owner，我要 fetch 失敗、離線、認證錯誤或逾時時，session 開頭明確報 Unknown 並和落後一樣先問我，這樣我不會帶著假的安全感開工。
7. 身為 Owner，我要 fetch 時不會跳出密碼或 SSH 提示把 session 卡住，這樣檢查失敗會變成 Unknown，而不是一個掛著的 hook。
8. 身為 Owner，我要有 commit 還沒 push 時，session 開頭只提示一行，不擋，這樣我記得要 push，但不會每次都被打斷。
9. 身為 Owner，我要有未 commit 的修改（含 untracked 檔案）時只提示一行，不擋，因為同一台機器上常有好幾個 session 共用同一個 checkout，dirty 很常見，擋了會讓我對提醒麻痺。
10. 身為 Owner，我要有 local branch 沒有 upstream 時只提示一行，不擋，這樣我知道那份工作只在這台機器上。
11. 身為 Owner，我要 repo 完全沒有 Drift 時，session 開頭不出現任何東西，這樣提醒只在有事時出現。
12. 身為 Owner，我要 session 不是開在 git repo 裡時，hook 什麼都不做，這樣在一般資料夾開 session 不受影響。
13. 身為 Owner，我要 repo 沒有 remote 時，session 開頭提示一行「no remote」，不擋，這樣忘了設 remote 的 repo 會被我看到。
14. 身為 Owner，我要 `/clear` 或 resume 後也會重新檢查一次，這樣隔了很久回來的 session 也拿得到最新狀態。
15. 身為 Owner，我要在 terminal 打 `drift` 就掃描這台機器所有根目錄底下的 repo，不需要開 Claude，這樣收工前或換機器前可以隨手跑一次。
16. 身為 Owner，我要 `drift` 對每個 repo 先 fetch 再判斷，這樣落後的狀態是當下的，不是上次 fetch 時的。
17. 身為 Owner，我要 `drift` 每個 repo 的每個 local branch 都檢查落後、ahead、沒有 upstream，不只目前所在的 branch，這樣藏在別的 branch 的未 push 工作也會被列出來。
18. 身為 Owner，我要 `drift` 只列出有 Drift、Unknown 或 no remote 的 repo，每個 repo 寫清楚是哪幾種、在哪些 branch，這樣報告短到我會真的去讀。
19. 身為 Owner，我要 `drift` 把沒有 remote 的 repo 另外列成「no remote」，不算 Drift，這樣純本機的實驗 repo 不會淹掉真正的問題，但忘了設 remote 的 repo 也不會被漏掉。
20. 身為 Owner，我要 `drift` 最後一行寫出總數（幾個 repo 有 Drift、幾個 Unknown、幾個 no remote，掃了幾個），這樣我一眼知道結果，也知道它確實掃到了東西。
21. 身為 Owner，我要 `drift` 在全部沒有 Drift、沒有 Unknown 時才用 exit code 0 結束，其餘都非 0，這樣之後要接到其他自動化時不會誤判。
22. 身為 Owner，我要這台機器還沒設定根目錄時，`drift` 報錯、說明怎麼設定、以非 0 結束，絕不印出「沒有 Drift」，這樣沒設定不會被當成全部正常。
23. 身為 Owner，我要某個設定的根目錄不存在時，`drift` 把它列出來並以非 0 結束，這樣打錯的路徑不會讓整個目錄被悄悄跳過。
24. 身為 Owner，我要根目錄底下一個 repo 都沒找到時，`drift` 報錯而不是報沒有 Drift，這樣設錯的根目錄看得出來。
25. 身為 Owner，我要 `drift` 不往 repo 裡面再找 repo（包括 `.claude/worktrees/` 裡的 worktree），因為 worktree 的 branch 已經算在主 repo 的 local branch 裡，這樣同一份工作不會被報兩次。
26. 身為 Owner，我要 `drift` 跳過 `node_modules` 這類依賴目錄，這樣掃描不會慢到我不想跑。
27. 身為 Owner，我要 `drift` 平行 fetch 多個 repo，這樣幾十個 repo 也能在可以接受的時間內跑完。
28. 身為 Owner，我要每台機器的根目錄設定放在不進 git 的本機設定檔，這樣三台機器路徑不同（Windows 是 `C:\Users\User\Documents\program\proj`）也不會互相覆蓋。
29. 身為 Owner，我要在 Mac 的 zsh 和 Windows 的 PowerShell、Git Bash 裡都能直接打 `drift`，這樣三台機器的用法一樣。
30. 身為 Owner，我要跑 `setup.sh` 就裝好 SessionStart hook，而且重跑不會重複註冊，也不會動到 `settings.json` 裡我自己的其他設定和 hook，這樣新機器一次設好，舊機器重跑安全。
31. 身為 Owner，我要 `setup.sh`（含 `--check`）在根目錄設定檔不存在，或 `drift` 不在 PATH 上時印出 TODO 和要做的事，這樣每台機器漏了哪一步一看就知道。
32. 身為 Owner，我要這套機制除了 `git fetch` 不會改動任何 repo，這樣它不會在我不知情時改到某個 session 正在讀的工作目錄。
33. 身為跑 session 的 agent，我要 `global.md` 寫明「session 開頭收到落後或 Unknown 的 Drift 時，動任何檔案前先問 Owner」，這樣規則有書面來源，hook 的輸出只是觸發它的訊號。
34. 身為跑 session 的 agent，我要 hook 的輸出直接寫明是哪個 repo、哪個 branch、落後幾個 commit，或為什麼是 Unknown，這樣我問 Owner 時不用自己再去查。
35. 身為讀 `CONTEXT.md` 的 agent，我要 **Drift** 和 **Unknown** 是有定義的詞，這樣 hook 輸出、`drift` 報告和規則用的是同一套說法。

## Implementation Decisions

- **用詞**：**Drift**（落後、ahead、未 commit 的修改含 untracked、local branch 沒有 upstream）與 **Unknown**（無法確認，永遠不等於沒有 Drift）已寫進 `CONTEXT.md`。「no remote」不是 Drift，是另外列的一種狀態。
- **一個模組、兩個入口**：用 Node 寫一個 Drift 檢查程式，和 Guard 一樣放在 kit 的 hooks 旁，三種 OS 都能跑。
  - SessionStart 模式：從 stdin 讀 hook JSON，用其中的 `cwd` 決定 repo（也看 `CLAUDE_PROJECT_DIR`，規則和 Guard 一樣）。
  - CLI 模式：掃描根目錄。
  - 判斷 Drift 的邏輯兩個入口共用一份。
- **fetch**：
  - 每個 repo `git fetch` 所有 remote，加逾時，並關掉互動提示（`GIT_TERMINAL_PROMPT=0`、SSH 的 BatchMode）。
  - fetch 失敗、逾時或讀不到 git 狀態，一律是該 repo 的 Unknown。
  - 逾時秒數要能在 SessionStart hook 的時限內跑完。
- **SessionStart 模式要判斷的**：
  - 目前所在 branch：落後、ahead、沒有 upstream。
  - 預設 branch（`origin/HEAD` 指向的那個；沒有就用 `main`）的 local branch 是否落後它的 upstream。
  - 未 commit 的修改。
  - 沒有 remote 時提示 no remote，不 fetch。
  - 不在 git repo 裡：沒有輸出。
  - 沒有任何 Drift、也不是 Unknown：沒有輸出。
- **SessionStart 的輸出**：
  - 給 agent 的 context：寫明 repo、branch、種類、落後或 ahead 的 commit 數、Unknown 的原因。
  - 落後或 Unknown 時，附上「依 `global.md`，動任何檔案前先問 Owner」的提示。
  - 也要讓 Owner 自己看得到，透過 hook 能顯示給使用者的訊息欄位。
  - matcher 涵蓋 startup、resume、clear；compact 不重跑。
- **`global.md` 新增一條規則**：session 開頭收到落後或 Unknown 的 Drift 時，動任何檔案前先用 `AskUserQuestion` 問 Owner 要「`pull --ff-only`／先不管／停下來」。
  - `pull --ff-only` 失敗就停下來告訴 Owner，不嘗試 merge 或 rebase。
  - 若落後的是在別的 checkout 裡被 checkout 的 `main`，就到那個 checkout 做 fast-forward（沿用 `workflow.md` Commits 一節的做法）。
  - 只有這一條是新規則；hook 是它的訊號，不是它的來源。
- **CLI 模式（`drift` 指令）**：
  - 根目錄來自本機設定檔（一行一個路徑，放在 `~/.claude/` 下、kit 之外，不進 git）。設定檔不存在、某個根目錄不存在、或一個 repo 都沒找到，都報錯並以非 0 結束。
  - 往下找到含 `.git` 的目錄就算一個 repo，不再往裡面找。跳過 `node_modules`。
  - 對每個 repo 平行 fetch。每個 local branch 都檢查落後、ahead、沒有 upstream，再檢查一次未 commit 的修改。
  - 輸出：只列有 Drift、Unknown 或 no remote 的 repo，最後一行是總數。exit code 只有在沒有 Drift、也沒有 Unknown 時才是 0。
- **`drift` 指令的安裝**：kit 附上可執行的 `drift`（sh 版給 zsh 和 Git Bash，`.cmd` 版給 PowerShell），兩者都只是轉呼叫那支 Node 程式。`setup.sh` 不改任何 shell profile；`drift` 不在 PATH 上時印 TODO，寫出要加進 PATH 的那個目錄。
- **`setup.sh`**：
  - 在寫 `settings.json` 的同一段裡加上 SessionStart hook 的註冊，重跑不重複、保留既有設定和 hook，`--check` 不寫入。
  - 新增兩項 TODO 檢查：根目錄設定檔是否存在、`drift` 是否在 PATH 上。
  - `README.md` 補一行說明。
- **不改動 repo**：整套機制唯一會寫入 repo 的動作是 `git fetch`。

## Testing Decisions

- **好的測試**：只看外部行為，也就是給定一個 repo 狀態，程式輸出什麼、exit code 是多少；不測內部函式。
- **一個 seam：用子行程跑 Drift 檢查程式**。
  - 測試在暫存目錄裡用 bare repo 當 remote，clone 出 local repo，再造出各種狀態：
    - 落後：另一個 clone push 了新 commit
    - ahead
    - dirty：已追蹤檔案被修改，以及只有 untracked 檔案
    - 沒有 upstream 的 branch
    - worktree 裡的 session：目前的 branch 沒有 upstream，`main` 落後
    - no remote
    - remote 指向不存在的路徑：要得到 Unknown
    - 完全同步：沒有輸出、exit 0
  - SessionStart 模式：餵 hook JSON 給程式，檢查輸出的 context 內容（有沒有輸出、有沒有「先問 Owner」的提示）。
  - CLI 模式：用暫存 HOME 放設定檔，檢查報告的內容、總數和 exit code，包括設定檔不存在、根目錄不存在、找不到任何 repo，以及不重複算 worktree。
- **前例**：`tests/guard.test.cjs`。同樣用 `spawnSync` 餵 JSON 給 hook、在暫存目錄建 git repo、用 `assert` 檢查，新測試沿用這個形狀。
- **`setup.sh`**：在 `tests/setup.test.sh` 加斷言：
  - SessionStart hook 註冊恰好一次，重跑也一樣
  - 既有的設定和 hook 保留
  - 根目錄設定檔不存在時有 TODO
- **驗證指令**：`project.md` 的驗證指令要加上新的測試檔。

## Out of Scope

- **看見其他機器的狀態**：例如每台機器把自己的狀態寫到共用的地方，在 Mac Studio 上看到「MacBook 有 commit 沒 push」。本 spec 只看本機；「另一台忘了 push」這種情況抓不到，這是已經接受的限制。
- **自動 pull、自動 push**：自動 push 違反 owner boundary；自動 pull 會在 Owner 不知情時改動工作目錄。把 WIP 自動推到 `wip/<機器名>` 也排除，理由同上。
- **stash 和殘留的 worktree** 不算 Drift，等真的在這上面吃過虧再加。
- **開 shell 時檢查、系統排程定時檢查**：只做 SessionStart 和手動的 `drift`。
- **`/drift` skill**：要在 Claude 裡用，就叫 agent 跑 `drift` 指令。
- **改動任何 shell profile 或系統 PATH**：`setup.sh` 只印 TODO。

## Further Notes

- 依照 kit 的工作流程，功能 branch 不 push、在本機 merge，所以進行中的 worktree branch 都會被報成「沒有 upstream」。這是正確的提示：那份工作確實只在這台機器上。SessionStart 對這種情況只提示、不擋。
- 在 Windows 上，hook 由 Claude Code 透過 shell 執行 `node`，指令寫法照 Guard 現有的註冊方式。
