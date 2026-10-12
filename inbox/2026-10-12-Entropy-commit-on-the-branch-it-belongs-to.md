Source: 2ENTER/Entropy @ 3f11546
Date: 2026-10-12
Kind: merges templates/workflow.md step 3 **Plan**「… Commit when written, without asking.」and「A lesson learned about this project goes into `docs/agents/` (usually `project.md`), not into memory.」
Touches: templates/workflow.md

## What

來源 repo 現有的是這條通則的一個特例,`docs/agents/project.md`「Rules and lessons」,原文:

> - **A plan is written on `main`, or in a worktree of its own.** Before `workflow.md` step 3,
>   check the branch of the checkout the session is in (`git branch --show-current`). Anything
>   but `main` means another spec's branch is there: without asking, open
>   `git worktree add .claude/worktrees/<slug> -b <slug> main`, claim and write the plan in it,
>   and commit it on that branch. Then, still without asking, put it on `main` at once: in the
>   worktree `git merge main`, then `git fetch . <slug>:main` (a fast-forward; no checkout
>   moves). Until then `main` has no `plan.md`, and "Continue" lists the spec as needing a
>   plan — the next session would write it again. A spec with `Worktree: no` still executes on
>   the main checkout: its executing session first runs `git worktree remove .claude/worktrees/<slug>`
>   (the branch stays) and checks the branch out there. (owner, 2026-10-07)

建議 kit 收的是通則,放進 `templates/workflow.md`(step 4 之前,或獨立一小節):

> **A commit lands only on the branch of the work it belongs to.** What belongs to the work a branch was opened for — its code, and corrections to its own spec found while executing — stays on that branch and reaches `main` with the merge. Anything else goes onto `main` at once, without asking: another spec's plan, a lesson for `project.md`, an ADR, a `CONTEXT.md` term, a rule. Check first with `git branch --show-current`. Not on `main`: open `git worktree add .claude/worktrees/<name> -b <name> main` and commit there; then, in that worktree, `git merge main`, and bring `main` forward to it. If `git worktree list` shows a checkout on `main`, run `git -C <that checkout> merge --ff-only <name>` (its files move with it, and it refuses rather than touch uncommitted work there); if none is on `main`, `git fetch . <name>:main` (no checkout moves).

並在兩處指回它:step 3 Plan 的「Commit when written」,與「A lesson learned about this project goes into `docs/agents/`」。

把 `main` 往前推的兩種情況,是 owner 2026-10-12 選定的(實測 git 2.56):

- Entropy 原本的 `git fetch . <name>:main` 只在**沒有** checkout 站在 `main` 上時成立。有的話 git 拒絕:`fatal: refusing to fetch into branch 'refs/heads/main' checked out at …`。
- 那時改在站著 `main` 的 checkout 裡跑 `git merge --ff-only <name>`:`main` 與那個 checkout 的檔案一起前進,`git status` 乾淨。沒選的做法是「到主 checkout 直接 `git commit <paths>`」——那會把別人在同一檔裡未 commit 的改動一起 commit 進去。

## Why

owner 的原話(2026-10-12):「我覺得任何決策都應該在 main 上面做,在一個為了單一工作而開的 branch 或 worktree 裡 commit 其他工作的內容,本身就是很奇怪且容易出錯的事情」。

一個 commit 落在哪條 branch,就決定了它什麼時候進 `main`、會不會被丟掉。寄放在別的工作的 branch 上,會:

- **晚進 `main`**:要等那份工作 merge;在那之前「Continue」和其他 session 讀 `main` 都看不到它,於是重做。
- **跟著被丟**:那份工作被放棄、branch 被刪,寄放的決策一起消失。
- **混進別人的 diff**:review 和 merge 衝突都牽到它。

Entropy 先碰到的是 plan 那一例。2026-10-07 分兩次寫成:`73edc03`「project.md: a plan is written on main, or in a worktree of its own」,`11fe388`「project.md: a plan written off main goes onto main at once」(commit message:「Otherwise main has no plan.md and "Continue" lists the spec as needing one. A fast-forward with git fetch . <slug>:main moves no checkout.」)。起因是 `Worktree: no`:這個 repo 動到 Unity 專案的 spec 必須在主 checkout 執行,主 checkout 就離開了 `main`,停在那份 spec 的 branch 上;在那裡寫的 plan 會落在別人的 branch。

kit 目前也有對應的空缺:「A lesson learned … goes into `docs/agents/`」沒說 commit 在哪條 branch。

## Generality

- **Portable**:不依賴任何 stack;只要 repo 會在非 `main` 的 branch 上工作(不論 `Worktree: yes` 或 `no`),就會遇到「手邊的 branch 不是這件事的 branch」。
- **New**:kit 的 step 3、step 4、Project lessons 都沒講 commit 落在哪條 branch。kit 剛併入的 plan-waits-for-after(`d80307b`)講的是 plan 要等 `After:` 的依賴上 `main`,不同件事。把兩處現有規則講精確,所以是 `merges`。
- **A rule, not a value**:沒有 repo 特定的值;`.claude/worktrees/` 本來就是 kit 的路徑。
