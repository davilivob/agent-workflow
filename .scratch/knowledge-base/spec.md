Status: ready-for-agent
Merge: ask
Plan: no
Execute: inline
Request: #5

# knowledge-base

## Problem Statement

Owner 在某個 repo 的 session 裡常會學到和那個 repo 無關、之後還用得上的知識。例：2026-10-28 在 folding-status 排除 Raspberry Pi（`fs-search`）連不回 iPhone 熱點、藍牙鍵盤配對失敗。kit 沒有規則說這類知識該記在哪、怎麼記，那次是 Owner 臨時要求，agent 自己讀 my-friend 的規則，寫進它的 `00_Inbox/` 並 commit（`davilivob/my-friend@44d7e62`），途中還踩到兩個坑：push 被拒後要 rebase，新檔要先 `git add` 才能 `git commit <path>`。

反方向也一樣：寫下來的知識，下次在別的 repo 排錯時沒有規則叫 agent 去找，等於沒寫。

另外，那次 folding-status 的 session 能用 Edit/Write 改 my-friend 的任何檔案，沒有任何東西擋。

kit 是 public 的，Owner 的 knowledge base（my-friend）是 private 的；kit 要保留給其他人用的可能，規則和程式裡不能寫死 my-friend。

## Solution

kit 定義一個 **Knowledge base**：唯一一個收「不屬於任何 repo 的知識」的 repo。kit 不寫它的名字，每台裝置用 `~/.claude/knowledge_base.conf` 指定它（Owner 的叫 my-friend）。

- **寫**：一則一則的 **Note**，只寫進 Knowledge base 的 inbox。agent 判斷剛學到的東西離開這個 repo 也用得上時，用一行提議；Owner 說「記一下」也算。Owner 同意才寫。格式、檔名、commit 訊息照 Knowledge base 自己的 `CLAUDE.md`；commit 與 push 照它自己的 Sync。
- **讀**：排查不屬於這個 repo 的問題（裝置、網路、帳號、OS），或 Owner 叫你去查時，在 Knowledge base 裡搜尋，只讀。
- **Guard**：別的 repo 的 session 用 Edit/Write 寫進 Knowledge base 時，只放行 inbox 裡的檔案。
- 沒設定 conf 的裝置：不寫、不讀、Guard 不擋；要寫 Note 時告訴 Owner 缺什麼，並把 Note 內文貼在對話裡。

## User Stories

1. 身為 Owner，我希望 agent 剛學到離開這個 repo 也用得上的東西時，用一行話提議寫一則 Note，這樣我不必自己記得要說。
2. 身為 Owner，我希望說一句「記一下」就能讓 agent 寫一則 Note，這樣記下知識只花我一句話。
3. 身為 Owner，我希望我同意之前什麼都不寫進 Knowledge base，這樣裡面只有我選擇留下的東西。
4. 身為 Owner，我希望每則 Note 開頭寫來源 repo、commit 和日期，這樣歸位的人知道它從哪裡來。
5. 身為 Owner，我希望 Note 的檔名、格式、commit 訊息照我的 Knowledge base 自己的 `CLAUDE.md`，這樣我改 Knowledge base 的慣例時不必改 kit。
6. 身為 Owner，我希望 Note 照 Knowledge base 自己的 Push policy 與 Pull policy commit、push，這樣它到達其他裝置的方式和我在那邊寫的完全一樣。
7. 身為 Owner，我希望 agent 對新 Note 先 `git add` 再 `git commit <path>`，這樣 commit 不會因為檔案未追蹤而失敗。
8. 身為 Owner，我希望 Knowledge base 有其他未 commit 的改動時，Note 的 commit 只含那一個檔案，這樣別處的 session 不會把我做到一半的東西 commit 掉。
9. 身為 Owner，我希望 repo 自己的 lesson 留在它的 `project.md`、Silent failure 留在它的 `docs/silent-failures.md`、workflow 的經驗走 Proposal，這樣 Knowledge base 只收不屬於任何 repo 的東西。
10. 身為 Owner，我希望離開來源 repo 也用得上的 Silent failure 兩邊都寫，這樣那個 repo 下次排錯讀得到，我的 Knowledge base 也有。
11. 身為 Owner，我希望 agent 排查不屬於這個 repo 的問題時去搜 Knowledge base，這樣上次寫下的這次找得到。
12. 身為 Owner，我希望我叫 agent 去查時它就搜 Knowledge base，這樣我一句話就能指它去那裡。
13. 身為 Owner，我希望讀 Knowledge base 只讀不寫，這樣查東西永遠不會改到它。
14. 身為 Owner，我希望 agent 照 Knowledge base 的 `CLAUDE.md` 說的位置去找，這樣 kit 不必知道它的結構。
15. 身為 Owner，我希望 kit 的規則和程式都不出現 my-friend，這樣 public 的 kit 還能給有自己 knowledge base 的其他人用。
16. 身為使用 kit 的其他人，我希望用一個設定檔指向我自己的 knowledge base，這樣不改 kit 就有一樣的行為。
17. 身為 Owner，我希望設定檔記這台裝置的 checkout 路徑和 inbox 資料夾，這樣同一個 repo 在不同裝置放不同位置也找得到。
18. 身為 Owner，我希望 kit 忽略設定檔裡它沒定義的 key，這樣我的 Knowledge base 能把自己的設定（my-friend 的 `drive=`）放在同一個檔。
19. 身為 Owner，我希望沒有設定檔的裝置告訴我缺什麼，並把 Note 內文貼在對話裡，這樣知識不會在那台丟掉。
20. 身為 Owner，我希望 `setup.sh` 在 TODO 裡列出缺少的 `~/.claude/knowledge_base.conf`，這樣新裝置設定得完整。
21. 身為 Owner，我希望 Knowledge base 以外的 session 用 Edit、Write、NotebookEdit 寫進 Knowledge base 中 inbox 以外的檔案時，Guard 擋下，這樣別的 repo 的 session 改不到我 Knowledge base 的其他部分。
22. 身為 Owner，我希望 Knowledge base 自己的 session（含它的 worktree）改任何檔案 Guard 都放行，這樣 Guard 不會妨礙我在那邊工作。
23. 身為 Owner，我希望讀取 Knowledge base 時 Guard 放行，這樣搜尋永遠不會被擋。
24. 身為 Owner，我希望設定檔不存在或讀不到時 Guard 什麼都不擋，這樣沒有 Knowledge base 的裝置照舊運作。
25. 身為 Owner，我希望 Guard 的 deny 訊息說明從別處只能以 Note 寫進 inbox，這樣 agent 知道該改做什麼，而不是重試。
26. 身為 Owner，我希望 `workflow.md` 的 bug 規則在 `docs/silent-failures.md` 旁邊也列 Knowledge base，這樣每個 repo 跑 `/sync-workflow` 後排錯前兩個都會讀。
27. 身為 Owner，我希望 my-friend 自己的 setup 改讀新設定檔，是透過在 my-friend 開的 Request 完成，這樣這次 kit 的改動不直接動 my-friend。

## Implementation Decisions

- **名詞**：`CONTEXT.md` 的 **Knowledge base** 與 **Note**（grill 中已寫入）。kit 不出現 my-friend；只有本 spec 的 Problem Statement 當作歷史提到它。
- **設定檔**：`~/.claude/knowledge_base.conf`，每行 `key=value`，和 my-friend 現有的 `my-friend.conf` 同一個格式。kit 只定義兩個 key：`repo=`（這台裝置的 checkout，絕對路徑）與 `inbox=`（inbox 資料夾，相對於 `repo=`）。Guard 需要 `inbox=`，因為它讀不了 Knowledge base 的 `CLAUDE.md`。其餘 key 屬於 Knowledge base，kit 不讀也不寫。缺任一個 key、或 `repo=` 不是資料夾，就當作沒設定。
- **規則放在 `global.md`**，一條，不另做 skill。內容：何時提議 Note（含「記一下」）；什麼進 Knowledge base、什麼留在 repo（lesson／Silent failure／Proposal，加上兩邊都寫的那一種）；怎麼寫（格式與 commit 訊息照 Knowledge base 的 `CLAUDE.md`；開頭寫來源 `<owner/repo> @ <short sha>` 與日期；先 `git add` 再 `git commit <file>`；Push 與 Pull 照 Knowledge base 自己 `project.md` 的 policy）；何時讀；沒設定時怎麼辦。
- **`templates/workflow.md`**：「When a grill applies」底下 Bugs 那行，在 `docs/silent-failures.md` 旁加上 Knowledge base，只在問題可能不屬於這個 repo 時搜。這會更新 Template，各 repo 跑 `/sync-workflow` 取得。
- **Guard**：新增一個對 Edit、Write、NotebookEdit 的 deny，寫法比照現有「kit 外的 session 不改 kit」：session 的 cwd 不在 `repo=` 底下（和 kit 檢查一樣用 realpath 解析）、目標在 `repo=` 底下、且目標不在 `repo=`/`inbox=` 底下 → deny，訊息說明從別處只能以 Note 寫進 inbox。設定檔不存在或讀不到 → 不做決定。Bash 寫入不檢查，和 kit 檢查同一個上限，用 `ponytail:` 註解寫明。
- **`setup.sh`**：缺 `~/.claude/knowledge_base.conf` 時列一行 TODO，比照 Device code 那行；`--check` 會回報。不替使用者建立檔案。
- **`README.md`**：New device 步驟加一行設定檔。
- **my-friend**：本 spec 不碰。merge 後由這個 session 提議 `/file-request` 給 my-friend：`setup.mjs` 改讀 `~/.claude/knowledge_base.conf` 取代 `my-friend.conf`，檔案補上 `inbox=00_Inbox`。各裝置改名之前，那邊的 session 找不到設定，照上面的方式處理。
- **Route**：grill 時判為 Direct，Owner 改走 spec。`Execute: inline`、`Plan: no`，在 worktree `.claude/worktrees/knowledge-base` 實作；最後一個 commit 設 `Status: done` 並帶 `Fixes #5`。

## Testing Decisions

- 只測外部行為：給定的工具呼叫與設定下 Guard 的決定，以及 `setup.sh --check` 的回報。不測 Guard 內部。
- **Guard**（`tests/guard.test.cjs`，前例：「Edit outside the kit」那幾個 case）：temp HOME 放一個 `knowledge_base.conf`，指向一個有 inbox 資料夾的 temp repo：
  - 外部 session，Edit／Write／NotebookEdit 寫進 inbox → none；
  - 外部 session，Write 寫到 Knowledge base 中 inbox 以外的檔案 → deny；
  - Knowledge base 內的 session（以及它底下的 worktree），同樣目標 → none；
  - 外部 session，Edit 一個只和 `repo=` 共用前綴的路徑（`<repo>-other/…`）→ none；
  - 沒有設定檔，或設定檔缺 `inbox=` → none。
- **setup**（`tests/setup.test.sh`，前例：空 device 檔的 TODO case）：沒有設定檔時 `--check` 印出它的 TODO 並 exit 1；有設定檔時沒有這行 TODO。
- **文字規則**（`global.md`、`workflow.md`），照 `project.md`：在 session 的 scratchpad 開一個拋棄式 repo，配一個 temp Knowledge base 和設定檔，手動跑：對 session 說「記一下」，它在 inbox 寫一則帶來源行的 Note、只 commit 那個檔；Guard 擋下寫到 inbox 以外的動作。輸出留作證據。
- `project.md` 的完整驗證指令必須通過。

## Out of Scope

- 改 my-friend（`setup.mjs`、它的 conf、它的 `CLAUDE.md`）：merge 後在那邊開 Request。
- 擋 Bash 寫入 Knowledge base。
- 多個 Knowledge base，或每則 Note 指定不同目的地。
- 索引、摘要、或 session 開始時自動讀 Knowledge base。
- 把 Note 從 inbox 歸位：由 Knowledge base 自己的 session 做。
- 這台 `~/.claude/drift-roots` 裡過時的 `daily/my-friend`：Owner 自己修。

## Further Notes

- my-friend 的 `docs/grills/2026-10-24-kit-proposals.md` 延後了兩個 kit Proposal：`global.md` 指向設定檔（等到有 repo 需要讀 my-friend）、Guard 保護它（等到看見別處的 session 寫進它，用通用版、kit 不寫 my-friend）。本 spec 以那份 grill 要求的通用形式兩個都交付；落地後 my-friend `待辦.md` 那一行可以刪。
