Source: 2ENTER/Entropy @ 84d3397
Date: 2026-10-07
Kind: merges templates/workflow.md step 4 收尾「after merging, `git worktree remove .claude/worktrees/<slug>` and delete the branch」
Touches: templates/workflow.md

## What

現行 `templates/workflow.md` 第 4 步(Worktree: yes):

> Wrap-up: after merging, `git worktree remove .claude/worktrees/<slug>` and delete the branch.

只說「delete the branch」,沒說用哪條指令、在哪個 checkout 跑。建議改成:

> Wrap-up: after merging, `git worktree remove .claude/worktrees/<slug>`, then confirm `git merge-base --is-ancestor <slug> main` and delete with `git branch -D <slug>`. Not `git branch -d`: it judges "merged" against the checkout's current branch, not `main`, so it refuses whenever the main checkout sits on another spec's branch — which is the normal state once specs run in worktrees.

## Why

2026-10-07,Entropy 第一次照 `Worktree: yes` 跑一份 spec(old-era-docs)。
merge 進 `main` 是在 worktree 裡做的;主 checkout 那時停在另一份還在執行的 spec 的 branch(room-states)。
收尾跑 `git branch -d old-era-docs`,git 回 `error: the branch 'old-era-docs' is not fully merged`——
但 `git branch --merged main` 列得出它,`git merge-base --is-ancestor old-era-docs origin/main` 也成立。
`-d` 比對的是目前 checkout 的 HEAD(room-states),不是 `main`。
接著試 `git branch -d old-era-docs --merged main`,git 直接印 usage(`--merged` 只能列、不能刪)。
最後用 `git branch -D` 才刪掉。owner 為了一條收尾指令來回三次。

## Generality

- Portable:純 git 行為,和 stack 無關;任何開了 worktree、主 checkout 不在 `main` 的 repo 都會撞到。
- New:kit 只寫「delete the branch」,沒有指令、沒有這個陷阱;inbox 裡唯一一份(github-remote-check)講的是別的事。
- A rule, not a value:刪 branch 前先驗證已 merge、再用 `-D`,是每個 repo 都一樣的收尾程序,不是某個 repo 的設定值。
