Source: dvtp-2026 @ 9d059c0
Date: 2026-10-03
Kind: adds
Touches: skills/sync-workflow/SKILL.md, templates/project.md

## What

`/sync-workflow` 要負責檢查 GitHub repo，沒有的話要協助建立。這條規則在來源 repo 裡還沒有成文，是 owner 在對話中提出的：

> 幫我把 github repo 的設立與檢查也加進 /sync-workflow 裡，並提及可能造成的影響

建議的做法：

- **section 1 Preflight** 加一步：讀 `git remote get-url origin`，記下是否指向 `github.com`。
- **section 2 Project values** 的 `AskUserQuestion` 加第 5 題「GitHub remote」，選項如下：
  - 已有 remote：直接顯示 `owner/repo`，不用問。
  - 沒有 remote：「建立 private repo（推薦）」/「建立 public repo」/「維持只在本機」。
- **`templates/project.md`** 加一個欄位 `Remote: <owner/repo>` 或 `Remote: none (local only)`。選了「只在本機」的 repo，之後的 update 模式就不再問。
- **section 6 Report** 時，如果 owner 選了建立，就把下面這行指令放進自己的 `bash` block 交給 owner，不由 agent 執行：
  `gh repo create <name> --private --source . --remote origin --push`
  依照 `global.md` 的規則，`git push` 和對外寫入歸 owner。
- **update 模式**：如果 `project.md` 寫的是 `Remote: <owner/repo>`，但實際上沒有 remote 或 remote 指向別處，就在 report 裡提醒 owner。

## Why

- Claude App 從遠端裝置看 Code tab 側欄、並用 Folder 分組時，只有接上 GitHub repo 的專案才會有自己的區塊，其他全部擠進 Other。這是 owner 在 2026-10-03 對照 Host 和遠端兩台裝置的側欄後確認的。當時 firehose、rpi-video-player、dvtp-2026 都沒有 remote，在遠端全部歸到 Other。
- 本 repo（dvtp-2026）本身就是例子：`git remote get-url origin` 回傳 `No such remote 'origin'`，`/sync-workflow` 跑完也沒提醒這件事。
- `/propose-to-kit` 的 Source 欄位本來就是從 `origin` 推出 `owner/repo`。沒有 remote 時只能退回目錄名稱，來源就比較難追。

## Generality

- **Portable**：每個 git repo 都可以有或沒有 GitHub remote，跟 stack、路徑無關。Unity 和 web 專案都適用。
- **New**：kit 的 `templates/`、`skills/`、`global.md` 都沒有檢查 remote 的步驟，只有「`git push` 歸 owner」這條規則。這個提案沿用那條規則，沒有改動它。`inbox/` 目前是空的，所以不是 duplicate。
- **A rule, not a value**：「每個 repo 都要決定有沒有 remote」是規則，放在 skill 裡。各 repo 的答案（哪個 `owner/repo`，或只在本機）是值，放進 `templates/project.md` 的新欄位。

## 可能造成的影響

- **外洩風險**：第一次推上 GitHub 時，**整段 git 歷史**都會上傳，不只是目前的檔案。如果歷史裡有 `.env`、金鑰或客戶資料，就算之後刪掉也已經公開了。所以建立之前，skill 應該先列出已被追蹤的可疑檔案給 owner 看（例如 `git ls-files | grep -iE '\.env|secret|key|\.pem'`），預設也應該是 private。
- **大檔**：Unity 專案（或任何有大型素材的 repo）在 GitHub 上單一檔案超過 100 MB 會被拒絕推送，需要先設定 Git LFS。這一步可能讓第一次推送失敗。
- **依賴 `gh`**：要多一個 `gh` CLI 依賴，而且需要已登入（`gh auth status`）。`setup.sh --check` 應該把它列進 `TODO:` 行，否則在沒有 `gh` 的裝置上這一步會卡住。
- **不想上雲的 repo**：私人或客戶專案可能刻意只放在本機。「維持只在本機」必須是一等選項，並寫進 `project.md`，否則每次 sync 都會再問一次，很煩。
- **remote 換了以後**：`/propose-to-kit` 的 Source 會從目錄名變成 `owner/repo`，新舊 Proposal 的命名會不一致（影響不大）。
- **每次 sync 都會多一題要回答**：new 和 existing 模式多問一題；update 模式只在不一致時才出聲。
- **帳號**：建在 `gh` 目前登入的帳號底下，不寫死。建立前在 `AskUserQuestion` 顯示 `gh auth status` 的帳號，讓 owner 確認（owner 2026-10-03 決定）。
