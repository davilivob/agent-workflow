Source: 2enter/firehose @ 34a9318
Date: 2026-10-13
Kind: adds
Touches: templates/workflow.md（Owner boundary 一節）、templates/project.md（Owner boundary 的 `{{PRODUCTION}}` 說明）

## What

firehose 的 push 自動部署只在 push 改到會進 production 的路徑時觸發，用白名單（`paths:`），不用黑名單（`paths-ignore:`）。

`.github/workflows/deploy.yml`：

```yaml
on:
  push:
    branches: [main]
    # only what reaches production; sdk/, specs and docs don't redeploy. A new COPY in a Dockerfile must be added here
    paths:
      - server/**
      - web/**
      - chromedriver/**
      - Dockerfile
      - compose.yaml
      - .github/workflows/deploy.yml
  workflow_dispatch:
```

`docs/agents/project.md` 的 Owner boundary：

> - `git push` of `main` touching `server/`, `web/`, `chromedriver/`, `Dockerfile`, `compose.yaml` or the workflow itself — **deploys to production** (anything else, such as `sdk/`, does not; `workflow_dispatch` deploys on demand): …

建議 kit 的寫法：在 `templates/workflow.md` 的 Owner boundary 加一條——「push 會自動部署的 repo，觸發條件是一份**會進 production 的路徑白名單**，不是整個 branch：kit 的流程會把 spec、plan、ADR、`CONTEXT.md`、`project.md` 直接 commit 到 `main`，沒有白名單時每次 push 都會白白重新部署一次。白名單列在 `project.md` 的 Owner boundary；建置開始用到新路徑時，同一個 commit 要把它加進白名單。」`templates/project.md` 的 `{{PRODUCTION}}` 說明補一句：push 會部署時，寫出觸發的路徑。

## Why

- 2026-10-13 firehose 比照 2enter.art 設了 push 自動部署（`f1f5437`、`ec95062`）。之後擁有者推一個只含 `[panel-redesign] plan` 的 push（`cd32bdb`），也跑了一次完整部署。
- 同一個 repo 裡還有 `sdk/`（Rust crate 與 TS package，用 git 依賴安裝）。擁有者的要求：「讓自動部署只發生在 firehose 本身的修改，單純 sdk 的更新不造成 re-deploy」。
- 選白名單而不選黑名單：新增的非部署路徑（下一個 spec 目錄、新的 docs）預設就不會觸發部署；代價是建置用到新路徑時要記得補上，所以在 workflow 裡留了一行提醒。
- 從 `34a9318`（2026-10-13）開始；寫這份 Proposal 時還沒在 GitHub 上實際看到一次「只改 sdk 不觸發」。

## Generality

- **Portable**：跟技術棧和 CI 都無關：GitHub Actions 用 `on.push.paths`，GitLab 用 `rules:changes`，其他 CI 也有對應寫法。不做自動部署的 repo（例如 Unity）這條不適用，也不會被它影響，因為它的前提是「push 會部署」。
- **New**：kit 的 `templates/`、`skills/`、`global.md` 都沒有提到部署觸發條件；`templates/workflow.md` 的 Owner boundary 只講 push 和 production 寫入歸誰。`inbox/` 裡唯一的 Proposal（`2026-10-12-dvtp-2026-setup-check-reports-hooks.md`）講的是 `setup.sh --check`，不重複。
- **A rule, not a value**：規則（觸發條件是白名單，因為 kit 流程把文件直接 commit 到 `main`）是通用的；路徑清單本身是每個 repo 的值，所以寫進 `project.md` 的 Owner boundary，不寫進 kit。
