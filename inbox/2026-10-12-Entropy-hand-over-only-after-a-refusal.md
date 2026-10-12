Source: 2ENTER/Entropy @ 3f11546
Date: 2026-10-12
Kind: merges templates/workflow.md「When a command that belongs to you is declined, say "this command was declined" and hand over the exact command; never say "I have no permission".」
Touches: templates/workflow.md

## What

`docs/agents/project.md`「Rules and lessons」,原文:

> - **Wrap-up is Claude's, not the owner's.** `git worktree remove` and deleting the branch
>   after a merge are part of `workflow.md` step 4, and the owner boundary above lists only
>   `git push`. Run them; hand one over only after it was actually run and refused, quoting the
>   refusal. Never hand one over because a different command was refused earlier, or because
>   of a guess that it might be. (2026-10-07: both were handed over unasked after an unrelated
>   `git rm` had been refused, and the branch deletion then cost the owner three rounds.)

建議把 kit 那句改成:

> When a command that belongs to you is declined, say "this command was declined", quote the refusal, and hand over that exact command; never say "I have no permission". Hand over only a command that was itself run and declined: never one because a different command was declined earlier, or because it might be. Step 4's wrap-up (`git worktree remove`, deleting the branch) is yours like any other.

## Why

2026-10-07,一份 spec merge 完之後,一條不相干的 `git rm` 被拒;Claude 就把收尾的 `git worktree remove` 和刪 branch 兩條都交給 owner,沒先自己跑。那條刪 branch 的指令後來花了 owner 三輪才處理掉。當天寫成這條(`a34a2a3`「project.md: wrap-up after a merge is Claude's, not the owner's」)。

同一天、同一次收尾還有另一個問題——`git branch -d` 在非 `main` 的 checkout 裡誤判沒 merge——那個已經以 `inbox/2026-10-07-Entropy-delete-merged-branch-from-anywhere.md` 進了 kit(`821c084`)。兩者不重複:那份講**用哪條指令**,這份講**什麼時候才輪到 owner**。

## Generality

- **Portable**:不依賴任何 stack;只要 agent 會被 permission classifier 拒絕某些指令,就會有「拒一條、交出一批」的傾向。
- **New**:kit 有「被拒就交出那一條」,但沒寫「**只有**被拒的那一條」,也沒寫收尾歸 agent。這份是把現有規則講精確,所以是 `merges`。
- **A rule, not a value**:哪些指令歸 owner 本來就由 `project.md` 的 Owner boundary 列;這條不新增值。
