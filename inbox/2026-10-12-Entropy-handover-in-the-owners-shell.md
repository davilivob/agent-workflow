Source: 2ENTER/Entropy @ 3f11546
Date: 2026-10-12
Kind: replaces templates/workflow.md「Handing over an owner command: when the work is done, put each command in its own ` ```bash ` block, no `$`, no output inside …」
Touches: templates/workflow.md

## What

`docs/agents/project.md`「Rules and lessons」,原文:

> - **A command handed to the owner is written for the shell it will run in**, not for
>   Claude's own Bash tool. Read the Terminal panel with `read_terminal` first: on the Windows
>   desktop it is PowerShell 7, sitting at the repo root. So Windows paths (`E:\Unity\Entropy`)
>   or none at all, PowerShell syntax (`Remove-Item -Recurse -Force`), and a ` ```powershell `
>   block -- never Git Bash paths (`/e/...`) or bash-only flags (`rm -rf`), whatever
>   `workflow.md` says about ` ```bash `. (2026-10-07: two handed-over commands in a row failed
>   in the owner's terminal because they were Git Bash.)

建議把 kit 那句改成:

> Handing over an owner command: when the work is done, read the Terminal panel with `read_terminal` first to see which shell the owner's terminal runs, and write each command for that shell, not for your own Bash tool: its paths, its syntax, and a fenced block tagged with its name (` ```bash `, ` ```powershell `). One command per block, no prompt, no output inside, `cd` to the repo first if the session sits in a worktree. …(其後不變)

## Why

2026-10-07,Windows 桌機上連續兩條交給 owner 的指令,在他的 terminal 裡失敗:Claude 自己的 Bash 工具是 Git Bash,寫出來的是 `/e/...` 路徑和 `rm -rf`,而 owner 的 Terminal panel 是 PowerShell 7。當天寫成這條(`1be8dc7`「[handover-shell] lesson: hand the owner commands for the shell they run in」)。規則裡明說它壓過 `workflow.md` 的 ` ```bash `——也就是 kit 現在的文字在 Windows 上會直接導致這個錯誤。

kit 原文選 ` ```bash ` 的理由是 Run 按鈕。owner(2026-10-12):` ```powershell ` block 一樣有 Run 按鈕,所以改標籤不會失去這個功能。

## Generality

- **Portable**:跟 Unity 無關;任何 owner 用 Windows 桌機的 repo 都會遇到——agent 的 Bash 工具是 Git Bash,owner 的 terminal 不是。
- **New**:kit 只有「一律 ` ```bash `」,與這條衝突,所以是 `replaces`。`inbox/` 沒有相關提案。
- **A rule, not a value**:哪個 shell 是**每台機器**的事,不是每個 repo 的事,所以不做成 `project.md` 的欄位,而是交出指令前用 `read_terminal` 現場看。
