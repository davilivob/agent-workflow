Status: done
Merge: auto
Plan: no
Execute: inline
Request: #8
After: remove-request-watch

# request-gitea-tea

## Problem Statement

`CONTEXT.md` 說 Request 是「GitHub or Gitea issue」，`/send-request` 也已經會依 target 的 host 分 `gh`／`tea` 送出；可是收件端的規則 `workflow.md` 只寫了 `gh`：Continue 的 Requests 組、Triage 的 Drop、跨 repo 的 `After:` 都寫死 `gh issue …`。origin 在 Gitea 的 repo（Owner 公司的 repo，例如 `2ENTER/Entropy`）跑 `/next` 時，`gh` 回「none of the git remotes … point to a known GitHub host」，Requests 組只能報 Unknown，可是 `tea` 早已登入、repo 裡就有一張開著的 Request #55。Request 送得出去，收件端卻看不到。Entropy 目前靠自己 `project.md` 的一條 lesson 繞過。

## Solution

`workflow.md` 的 **Requests** 一節定義 **Channel**，作為唯一出處：origin 的 host 不是 `github.com` 的 repo 是 Gitea，issue 指令走 `tea`，用 `tea logins list` 裡 URL 是那個 host 的 login；其他走 `gh`。Requests 組、Drop、跨 repo 的 `After:` 三處都依本 repo 的 Channel 選工具。沒有相符的 `tea` login，就跟 `gh` 失敗一樣是 Unknown，並附上讓 Owner 自己跑的 `tea login add …` 指令。`/send-request` 改為引用這條規則，不再自己寫一份。

## User Stories

1. 身為 Owner，我要 origin 在 Gitea 的 repo 跑 `/next` 時，Requests 組用 `tea` 列出開著的 Request，這樣 Gitea repo 收得到別的 repo 送來的 Request。
2. 身為 Owner，我要 Gitea repo 的 Requests 組每行仍是號碼、開立日期、`From:` 與 `## What` 第一句，這樣兩種 host 的 Continue 長得一樣。
3. 身為 Owner，我要 Gitea repo 的 Requests 組照樣排除本機 `main` 已有 `Fixes #<n>` commit 的 Request、標成 `applied, awaiting push`，這樣兩種 host 的行為一致。
4. 身為 Owner，我要 origin 在 GitHub 的 repo 的 Requests 組結果跟現在完全一樣，這樣既有 repo 不受影響。
5. 身為 Owner，我要 Gitea repo 的 Triage 選 Drop 時，用 `tea` 關掉 issue 並留下我的理由，這樣 Drop 在兩種 host 都能用。
6. 身為 Owner，我要 spec 的 `After: <owner/repo>#<n>` 依本 repo 的 Channel 查那張 Request 的狀態，這樣 Gitea repo 之間的跨 repo 依賴也能解除封鎖。
7. 身為 Owner，我要 `After:` 那張 Request 查不到（`tea` 失敗、沒有 login、找不到）時算 Unknown、列在 Blocked 並註明，絕不當成已關閉，這樣跟 GitHub 的規則一致。
8. 身為 Owner，我要本機沒有 host 相符的 `tea` login 時，Requests 組報 Unknown 並附上 `tea login add --name <host> --url https://<host> --token <token>`，token 由我自己輸入，這樣我不用另外查怎麼登入。
9. 身為 Owner，我要 `tea` 沒裝、離線或沒有權限時，Requests 組是 Unknown、絕不是空的，這樣我不會誤以為沒有 Request。
10. 身為 Owner，我要 Channel 規則只寫在 `workflow.md` 一個地方，`/send-request` 引用它，這樣改規則時不會兩邊不一致。
11. 身為 Owner，我要 `/send-request` 送 Request 的行為不變（依 target 的 host 分 `gh`／`tea`），這樣既有的送出流程不受影響。
12. 身為 Owner，我要登入指引不寫死 `brew install tea`，改成不分平台的「安裝 tea」，這樣在 win 上讀到的指引也正確。
13. 身為 Owner，我要 `CONTEXT.md` 有 **Channel** 詞條，這樣各 repo 的 session 講同一個詞。
14. 身為 Owner，我要 ADR 0001 的 Gitea 修正段落改成「讀取端也已擴到 Gitea」，這樣 ADR 的現況描述正確。
15. 身為 Owner，我要這份 spec 完成並 push 後 Request #8 自動關閉，這樣 Entropy 知道它的 Proposal 已經落地，可以拿掉自己 `project.md` 那條繞路的 lesson。

## Implementation Decisions

- **Channel 定義放在 `workflow.md` 的 Requests 一節**，作為唯一出處：本 repo origin 的 host 不是 `github.com` → Gitea，走 `tea`，login 取 `tea logins list` 中 URL 是該 host 者，`<owner>/<repo>` 取自 origin；其他 → GitHub，走 `gh`。只用該 Channel，失敗時不退回另一個。
- **三處指令依 Channel**：
  - Continue 的 Requests 組：GitHub 照舊 `gh issue list --state open --json number,createdAt,body`；Gitea 用 `tea issues list`（帶 repo、login、`--state open`、JSON 輸出、號碼／建立時間／body 欄位；Entropy 的 lesson 已實測過一版）。`tea` 的欄位名稱與 `gh` 不同（號碼、建立時間），讀的是同樣的三項。
  - Triage 的 Drop：Gitea 用 `tea` 關閉 issue 並留下 Owner 的理由（比照 `/send-request` 的 Gitea 重複件處理，以 `tea comment` 加留言再關閉，或 `tea` 單一指令能同時做到者）。
  - 跨 repo 的 `After: <owner/repo>#<n>`：**一律以本 repo origin 的 Channel 查**（Owner 決定：目前沒有 GitHub 與 Gitea 之間互相依賴的情況）。Gitea 用 `tea` 查該 issue 的 state，關閉才算在 `main`；查不到就是 Unknown。
- **沒有相符 login**：Unknown，並附上「安裝 tea」與 `tea login add --name <host> --url https://<host> --token <token>`；token 由 Owner 輸入，`--insecure` 只在 Owner 說憑證不受信任時加。不寫死 `brew install tea`（Decided：kit 在 win 與 mac 都用）。
- Requests 組 Unknown 的原因清單從「origin not on GitHub」改為涵蓋兩種 Channel 的失敗（CLI 沒裝、沒登入／沒有相符 login、離線、沒有權限）。
- **`/send-request` 第 1 節的 Channel** 改為引用 `workflow.md` 的 Channel 規則；它特有的部分（target 是另一個 repo、確認存取的指令、From 等）留在原處。Gitea target 的判斷依 target 的 host，這點不變。
- `CONTEXT.md` 新增 **Channel** 詞條（放在 Request 相關詞條附近）：一個 repo 的 issue 經由哪個 CLI 讀寫——origin 在 `github.com` 是 `gh`，在其他 host（自架 Gitea）是 `tea`；_Avoid_: forge, provider, backend。
- ADR 0001 的「Amendment 2026-11-14: Gitea targets」改寫：讀取端（Continue 的 Requests 組、Drop、跨 repo 的 `After:`）也依 Channel 走 `tea`；Deploy check 的 `gh run …` 仍只支援 GitHub Actions。
- Deploy check 不動。

## Testing Decisions

- 沒有程式碼改動，seam 是照新規則手動跑一遍，只看外部結果（列出的 Request、Unknown 的訊息）。
- Verification command：`sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs` 照樣通過。
- 手動驗證（在 session 的 scratchpad，只讀）：
  1. 一次性 clone `https://gitea.2enter.art/2ENTER/Entropy`，照新的 Requests 組規則跑：應列出 #55（本機有 `tea` 且已登入 `gitea.2enter.art`）。
  2. 一次性 repo，origin 設成一個不存在 login 的 Gitea host：Requests 組應是 Unknown，並附上 `tea login add …` 指令。
  3. kit 本身（GitHub）跑 Requests 組：結果跟改動前一樣。
  4. Drop 不實際關 issue，只檢查 `workflow.md` 裡 Gitea 的 Drop 指令文字與 `tea` 的 help 一致。
  5. 跨 repo `After:`：用 `tea` 查 Entropy 某張已關閉與一張開著的 issue 的 state，確認讀得出關閉與否。
- 保留各步輸出作為證據。

## Out of Scope

- Request watch：已由 `remove-request-watch` 移除，本 spec 不處理。
- Deploy check 的 Gitea Actions 支援（`gh run …` 的對應）：另案。
- GitHub repo 依賴 Gitea Request（或反之）的 `After:`：不支援，`After:` 一律用本 repo 的 Channel。
- 移除 Entropy `project.md` 的繞路 lesson：那是 Entropy 自己的事，Request 關閉後由它處理。

## Further Notes

- 來源：Request #8，From `2ENTER/Entropy @ 8c7bb2e`，2026-11-14。
- 2026-11-14 grill 的決定：`After:` 用本 repo origin 的 host（不帶 host 前綴）；Channel 以 `workflow.md` 為唯一出處；沒有 login 時附登入指令；Request watch 不擴充而是另案刪除。
- 最後一個 commit 設 `Status: done` 並帶 `Fixes #8`。
- 手動驗證證據（2026-11-14，tea 0.16.0）：1. Entropy clone 照 Requests 組規則列出 `55 2026-11-14T07:53:23Z From: davilivob/my-friend @ 90461be`；2. origin `https://gitea.nowhere.example/a/b.git` 沒有相符 login → Unknown，附 `tea login add --name gitea.nowhere.example --url https://gitea.nowhere.example --token <token>`；3. kit（GitHub）`gh issue list` 照舊列出 #8；4. `tea comments <n> [<body>]` 與 `tea issues close <n>` 跟 help 一致；5. `tea issues 52|55 -r 2ENTER/Entropy -l gitea.2enter.art --comments=false -o json` 的 `state` 分別是 `closed`、`open`。
