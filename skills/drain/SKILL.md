---
name: drain
description: Start a Batch run, which works through every spec this repo has ready after one confirmation and optionally pushes at the end.
disable-model-invocation: true
---

A **Batch run** (`CONTEXT.md`) works through this repo's specs in one conducting session. It asks once, in section 2, and nothing more until the end. Read `docs/agents/workflow.md` and `docs/agents/project.md` first. Set the Session title's Phase to `batch`.

## 1. List

Do the lookups of `workflow.md` **Continue** for this repo: Claims, then the groups.

- In the run: **Ready** and **Needs a plan**. A **Blocked** spec whose blocker is itself in the run joins once that one merges.
- Left out, each with its reason: In progress, specs not committed, every other Blocked spec, Awaiting OS-bound verification, Requests.
- What `After:` or `Overlaps: high` names is on `main` only if its spec there is `done` or awaiting OS-bound verification: `git log --grep=<slug>` alone also finds its `[<slug>] spec:` commit, and nobody is watching to catch that here.
- Order: what `After:` and `Overlaps: high` require first, the rest by slug.

Done when: every spec under `.scratch/` that is not `done` is either in the order or left out with a reason.

## 2. Confirm

Write the list first: the order; one sentence per spec; how each `Merge:` will be handled (`auto` and `ask` merge, `manual` stays on its branch with its evidence, and whatever depends on it is skipped); what is left out and why; the In progress slugs. Then one `AskUserQuestion`:

- Start or stop. This is the only moment the owner can name an In progress slug to take over: it joins the order, continuing on its existing branch.
- Push at the end, by the repo's Push policy and Deploy paths:
  - Deploy paths named: don't push; push only if no Deploy path is touched (the default); push even if one is touched. Under `Push: auto`, that last option says it deploys to production with nobody confirming.
  - No Deploy paths: push or don't.
  - `Push: owner`: not asked; the command is handed over at the end.

The owner's answer is the sentence `workflow.md` **Say where the authorization came from** quotes. If the owner picks stop, change nothing.

From here on, no `AskUserQuestion` and no waiting on the owner: whatever would need the owner goes into the final message. `Push: auto`'s push after each commit does not apply either; section 4 pushes once.

Done when: the owner answered, and the authorization line is written.

## 3. Run

One spec at a time, in order. After each merge, redo the lookups of section 1 and add what the merge unblocked; never an In progress slug. A spec that depends on a failed, skipped or `manual` one is skipped, with that reason. Rely on git, not on memory: there is no state file, and a re-run or a compaction reads the same branches and specs.

1. **Plan**, for Needs a plan: a subagent does `workflow.md` step 3, its Claim and commit rules included.
2. **Execute**: a subagent does `workflow.md` step 4 up to, and not including, the merge, on `<slug>`'s worktree or branch: `Execute: sdd` with `superpowers:subagent-driven-development`, `Execute: inline` by implementing and then running `code-review`. It writes any Awaiting OS-bound verification line. Tell it: never ask, never merge, never push; commit its progress on the branch; a fact the spec gets wrong is corrected on the branch and is no failure; if the spec's decisions must change, or it cannot start the subagents `sdd` needs (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`), stop there; and return only the result, the commands awaiting and any failure reason.
3. **Verify**: a subagent's report is not evidence. Run the Verification of `project.md` yourself on the branch, each command but the awaiting ones.
4. **Merge**: `manual`: leave the branch and keep the output as evidence. `auto` or `ask`: first note whether it will fast-forward (`git merge-base --is-ancestor main <slug>`), then merge in `main`'s checkout and do step 4's wrap-up. A conflict: as `workflow.md` step 4 says, except that where it would stop and ask, `git merge --abort` and treat it as failed.
5. **`main` broken**: a merge that did not fast-forward gets the Verification again on `main`, the awaiting commands aside. It fails: stop the whole run; no rollback, no push; go to section 4's notification and final message.

**Failed** means a subagent could not finish its step, a verification did not pass, a merge could not be done, or the spec's decisions must change. The spec stops alone: commit any progress on its branch, add one line to its `## Comments` there, `- Batch run failed: <reason>`, set `Status` back if it says `done`, and commit. With `Worktree: no`, `git switch main`. No merge. The branch left behind is a Claim, so the next `/drain` lists it as In progress. With no branch yet, the reason goes in the final message only.

Done when: every spec in the order is merged, waiting as `manual`, failed or skipped, or `main` broke.

## 4. Finish

Load `PushNotification` (`ToolSearch` with `select:PushNotification`). Right before the push, or at the end when nothing will be pushed, send one line: how many merged, how many failed, whether it pushes. Send another only if the push or a Deploy check fails. If it cannot be loaded or sent, say so in the final message.

**Push** as chosen in section 2, once, in `main`'s checkout, under the Push policy, the Rebase rule and the Guard:

- Compare the files with the Deploy paths as `workflow.md` says, but do not ask. "Only if no Deploy path is touched" and one is: do not push; the final message lists the matching files and the Deploy paths they match.
- `Push: owner`: hand the command over.
- Where the Rebase rule would ask: do not push, and say why.
- After a push: the Deploy check and Production check, as `workflow.md` says.

**The final message**, last: each spec's result (merged; `manual` with its evidence; failed or skipped with the reason); the Awaiting OS-bound verification list, and whether what was pushed includes a change still awaiting one; the push result; the commit list and push line of `global.md`. A Compact proposal, if one is due, goes here and nowhere earlier in the run.

Done when: the push, if any, has concluded with its checks, and the final message covers every spec from section 1.
