Status: ready-for-agent
Merge: ask
Plan: no
Execute: inline
After: cross-device-sync

# deploy-ec2-template

## Problem Statement

Owner 部署到 EC2 的專案（目前是 firehose 和 dvtp-2026）用的是同一套做法：GitHub Actions build arm64 image 推到 GHCR，再用 SSH 上 EC2 跑 `docker compose pull && up -d`。但這套做法只存在於各個 repo 裡，是一份一份複製後各自長歪的：

- secret 名稱不同。
- 只有一個 repo 在 CI 裡跑測試。
- dvtp 依賴 org secrets，而 Owner 的 GitHub 是 Free 方案，private repo 用不了 org secrets，最近一次部署因此失敗。

每開一個新的 EC2 專案，都要再從頭拼一次。

另外，`cross-device-sync` 讓 agent 可以主動發起 push，但 Guard 的權限框只顯示指令本身，看不出這次 push 會不會觸發部署。對一個 push 到 `main` 就部署的 repo，Owner 需要在同意前知道會部署什麼。

## Solution

- kit 提供一份 EC2 部署的 workflow 範本，內容就是 firehose／dvtp 的共同做法。
  - `/sync-workflow` 在 Owner 回答「push 到 `main` 會部署」之後，追問是否部署到 EC2。是的話，填好參數寫進 repo，同時填好 `project.md` 的 Deploy paths，並把要設定的 repo secret 指令交給 Owner。
  - 範本只在第一次寫入。repo 已經有部署 workflow 時不覆寫，只報告和範本的差異。
- agent 發起一個會碰到 Deploy paths 的 push 之前，先用 `AskUserQuestion` 說明這次 push 會部署什麼，Owner 同意後才發 push（之後仍然會跳 Guard 的權限框）。

## User Stories

1. 身為 Owner，我要 `/sync-workflow` 在我說 push 到 `main` 會部署之後，再問是否部署到 EC2，這樣 EC2 專案自動拿到標準的部署設定。
2. 身為 Owner，我要範本預設的做法和 firehose／dvtp 相同：build arm64 image、推到 GHCR、SSH 上 EC2 跑 compose pull／up、curl 確認服務活著、清掉舊 image，這樣我不用重新學一套。
3. 身為 Owner，我要部署只由 Deploy paths 的 allowlist 觸發，也能用 `workflow_dispatch` 手動重跑，這樣只改 spec 或文件不會部署，CI 掛了也能重跑。
4. 身為 Owner，我要同一時間只跑一個部署，這樣連續 push 不會讓兩次部署互相踩到。
5. 身為 Owner，我要範本在 build 之前先跑 `project.md` 的驗證指令，這樣壞掉的 code 不會被部署。
6. 身為 Owner，我要驗證在 Linux runner 上跑不起來的專案可以刪掉那一步，這樣範本不會擋住特殊專案。
7. 身為 Owner，我要 image 名稱用 repo 的 owner 組出來（`ghcr.io/<owner>/<name>`），不寫死 2enter，這樣個人帳號底下的 repo 也能用。
8. 身為 Owner，我要範本統一用 repo secret `SSH_KEY`、`VPS_HOST`、`VPS_USER`、`DEPLOY_PATH`，這樣在 Free 方案的 private repo 也能部署。
9. 身為 Owner，我要 sync 把設定這四個 secret 的指令交給我，由我自己填值執行，這樣 secret 的值永遠不經過 agent。
10. 身為 Owner，我要 sync 問我 image 名稱與 build context、liveness 用的 port、Deploy paths，並同時寫進 workflow 和 `project.md`，這樣兩邊一致。
11. 身為 Owner，我要每個專案在自己的 `project.md` 記下部署的主機和 port，這樣共用同一台主機的專案能看出彼此用了哪些 port。
12. 身為 Owner，我要已經有部署 workflow 的 repo，sync 不覆寫它，只報告和範本的差異，這樣各專案為自己長出來的東西（例如兩個 image、子目錄）不會被抹掉。
13. 身為 Owner，我要 kit 的部署範本更新後，不會在每個專案下次 sync 時被強制套用，這樣不會反覆製造衝突。
14. 身為 Owner，我要 agent 在發起會碰到 Deploy paths 的 push 前，先用 `AskUserQuestion` 列出這次碰到的部署路徑和會部署什麼，這樣我在同意前知道這次會上線。
15. 身為 Owner，我要不碰 Deploy paths 的 push 不多問這一次，只跳 Guard 的權限框，這樣只改文件時不會被多餘的問題打擾。
16. 身為 Owner，我要我在那個 `AskUserQuestion` 拒絕時 agent 不發 push，這樣部署的時機由我決定。
17. 身為 Owner，我要範本不附手動部署腳本，這樣 kit 不必維護一份很少用到的備案。

## Implementation Decisions

- **新範本**：EC2 部署的 GitHub Actions workflow，放在 kit 的範本目錄。
  - **參數**：image 名稱與 build context（可以不只一組）、Deploy paths、liveness port、要在 CI 裡跑的驗證指令。
  - **內容**：
    - 觸發：push 到 `main` 並帶 `paths` allowlist，加上 `workflow_dispatch`；job 只在 `refs/heads/main` 上跑；`concurrency` 一次一個。
    - build：在 `ubuntu-24.04-arm` 上跑，`packages: write`；用 `GITHUB_TOKEN` 登入 GHCR；buildx；arm64；tag 是短 sha 和 `latest`；provenance 和 sbom 關掉；用 GHA cache。
    - image 名稱：`ghcr.io/${{ github.repository_owner }}/<name>`。
    - 部署：ssh-agent 載入 `SSH_KEY`，`ssh-keyscan` 主機；scp `compose.yaml` 到 `DEPLOY_PATH`；SSH 執行 compose pull、up -d；對 liveness port 做有重試的 curl；最後 `docker image prune -f`。
    - 驗證步驟在 build 之前，註明跑不起來的專案可以刪掉它。
    - 範本內註明：新增會被 COPY 進 image 的路徑時，要同時加進 `paths` 和 `project.md`，和 `workflow.md` 的 Deploy paths 規則一致。
- **secret**：repo 層級的 `SSH_KEY`、`VPS_HOST`、`VPS_USER`、`DEPLOY_PATH`，名稱照 firehose。原因是 Owner 的 GitHub 是 Free 方案，private repo 用不了 org secrets，而 firehose 已經用這套成功部署。sync 交給 Owner 每個 secret 一行 `gh secret set <NAME> -R <owner/repo>`，值由 Owner 互動式輸入。這些 secret 列入 `project.md` 的 Owner boundary。
- **`/sync-workflow`**：
  - Owner 回答 push 到 `main` 會部署之後，用 `AskUserQuestion` 追問「部署到 EC2 嗎？」。
  - 是：
    - repo 沒有任何 `.github/workflows` 裡的部署 workflow：再問一次參數，寫入 workflow；`project.md` 填入 Deploy paths、主機、port 與 secret；交出 secret 指令。
    - 已經有部署 workflow：不寫入，報告它和範本的差異，交給 Owner 決定要不要手動對齊。
  - 範本不帶 `Template:` 之類的版本行，之後的 sync 也不再碰它。
- **`project.md` 範本**：Owner boundary 的部署項目，多記主機與 port 兩個欄位（只在有部署時出現）。
- **部署前的提問（`workflow.md` 的 Deploy paths 段落）**：
  - agent 發起 `main` 的 push 之前，比對這次要推的 commit 改到的檔案和 `project.md` 的 Deploy paths。有交集時，先用 `AskUserQuestion` 列出碰到的部署路徑和會部署的服務，Owner 同意才發 push；拒絕就不 push，並在回報裡說明 `main` 還有沒 push 的 commit。
  - 沒有交集就照 `cross-device-sync` 的 push 規則直接發起。
  - Guard 不解析 Deploy paths，它照舊對 push 回傳 `ask`。
- 不附手動部署腳本。

## Testing Decisions

- 好的測試只看外部行為：sync 後 repo 裡出現的檔案和 `project.md` 的內容，以及 agent 在 push 前問了什麼。
- **範本本身**：
  - 用 YAML parser 確認範本填入參數後是合法 YAML。
  - 若 `actionlint` 可用就再跑一次，不可用時在證據裡說明。
  - 範本不在 kit 的 CI 裡實際部署。
- **`/sync-workflow`**：在 scratchpad 的 throwaway repo 手動跑三種情況，保留輸出：
  - 新 repo、選 EC2 → 寫入 workflow、`project.md`，交出四行 secret 指令
  - 已有部署 workflow 的 repo → 不覆寫、只報差異
  - 選「不是 EC2」→ 不寫 workflow
- **部署前的提問**：屬於文字規則。在 scratchpad 的 repo 設好 Deploy paths，做一個碰到它的 commit 和一個不碰的 commit，各走一次 push 流程，確認前者先問、後者不問（push 到 scratchpad 內的 bare repo）。
- 驗證指令照 `project.md`：`sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`。

## Out of Scope

- 修正 dvtp-2026 目前的部署失敗。它的 repo 只有 `DEPLOY_PATH` 這一個 secret，其餘依賴用不了的 org secrets；要補設 secret（Owner 的事），並把 workflow 的 secret 名稱改成這套。這在 dvtp-2026 自己的 repo 處理。
- 把 firehose 和 dvtp 的既有 workflow 強制改成範本的樣子。
- 主機端的設定：`.env`、Nginx Proxy Manager、security group、docker 安裝。這些是 Owner 的。
- 中央的 port 登記表。
- 非 EC2 的部署目標，以及 GitLab。
- 手動部署腳本。

## Further Notes

- `After: cross-device-sync`：部署前的提問建立在那裡放寬後的 push 規則上。
- GitHub Free 方案的 private repo 每月有 Actions 分鐘數上限，arm64 runner 也算在內。firehose 目前在 Free 方案的 private repo 上用 `ubuntu-24.04-arm` 成功部署，所以範本照用。
