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
- `.scratch/batch-run` already in `main`'s checkout: another Batch run's Claim, live or crashed. Its slugs are In progress. Report the file's modification time; never judge it stale yourself.
- **Groups**: read each spec in the run and put it under **Together** or **Alone**. It is Alone (it waits its turn and runs by itself), with a one-sentence reason, when any of these holds:
  - it has `Overlaps: medium` with another spec in the run;
  - it changes tests, verification tooling or build config themselves;
  - its verification competes for a shared resource: a fixed port, one local database, one simulator;
  - it is large enough alone to take a great deal of tokens or machine resources;
  - anything else in it you judge risky to run alongside others; say what.

  `After:` and `Overlaps: high` already make a spec wait (the order above) and are not reasons here. With `Worktree: no` there are no groups: one checkout means one spec at a time.

Done when: every spec under `.scratch/` that is not `done` is either in the order or left out with a reason, and, with `Worktree: yes`, every spec in the order is Together or Alone.

## 2. Confirm

Write the list first: the order, in its two groups, Together and Alone, each Alone spec with its reason (with `Worktree: no`, say instead that the run goes one spec at a time because the repo has one checkout); one sentence per spec; how each `Merge:` will be handled (`auto` and `ask` merge, `manual` stays on its branch with its evidence, and whatever depends on it is skipped); what is left out and why; the In progress slugs. A `Context size:` line past 200k already in this conversation: say the run would end before its first spec (section 3's Context limit) and that a `/clear` or `/compact` first avoids it. Then one `AskUserQuestion`:

- Start or stop. This is the only moment the owner can name an In progress slug to take over: it joins the order, continuing on its existing branch.
- Regrouping goes through Other in the same question: the owner moves specs between Together and Alone in words, and that answer wins over your grouping.
- With a `.scratch/batch-run` already there, start means taking over that run as well; say so in the option. Without that, never overwrite the file.
- Push at the end, by the repo's Push policy and Deploy paths:
  - Deploy paths named: don't push; push only if no Deploy path is touched (the default); push even if one is touched. Under `Push: auto`, that last option says it deploys to production with nobody confirming.
  - No Deploy paths: push or don't.
  - `Push: owner`: not asked; the command is handed over at the end.

The owner's answer is the sentence `workflow.md` **Say where the authorization came from** quotes. If the owner picks stop, change nothing.

On start, write the order to `.scratch/batch-run` in `main`'s checkout, one slug per line. Never commit it. It is the run's Claim: another session's `/next` lists those slugs as In progress instead of offering them. Rewrite it whenever the order changes in section 3.

From here on, no `AskUserQuestion` and no waiting on the owner: whatever would need the owner goes into the final message. `Push: auto`'s push after each commit does not apply either; section 4 pushes once.

Done when: the owner answered, the authorization line is written, and, on start, `.scratch/batch-run` lists the order.

## 3. Run

**Slots**: at most 3 specs in flight. A spec holds a slot from the start of its plan (or its execution, with no plan) until it is merged, left as `manual`, failed or skipped. Whenever a slot frees, fill it straight away with the next spec in the order that can start: a Together spec while no Alone one runs; an Alone spec only once nothing else is in flight, and while it runs nothing new starts. A spec waiting for its verification or merge still holds its slot. With `Worktree: no`, one slot: one spec at a time, as before.

After each merge, redo the lookups of section 1 and add what the merge unblocked; never an In progress slug. This run's own `.scratch/batch-run` lines are not In progress to it. A spec that depends on a failed, skipped or `manual` one is skipped, with that reason. Rely on git, not on memory: `.scratch/batch-run` is a Claim, not a state file, and a re-run or a compaction reads the same branches and specs. The groups are not stored: after a compaction, judge them again from the specs, keeping any regrouping the owner gave in section 2 that is still in view.

Subagents run in the background; you are woken as each finishes and take only its summary. Every git operation that lands on `main`, and opening each worktree and branch, is yours, one at a time, so that no two writers race on `main` or git's locks.

1. **Plan**, for Needs a plan: a background subagent does `workflow.md` step 3, its Claim rule included, except that it leaves the finished `plan.md` uncommitted and hands back; you commit it on `main` at once, as step 3 says, so the uncommitted file is a Claim only while it is being written.
2. **Execute**: open `<slug>`'s worktree yourself (`Worktree: no`: its branch), then a background subagent does `workflow.md` step 4 up to, and not including, the merge, there: `Execute: sdd` with `superpowers:subagent-driven-development`, `Execute: inline` by implementing and then running `code-review`. It writes any Awaiting OS-bound verification line. Tell it: work only in that worktree; never ask, never merge, never push; commit its progress on the branch; a fact the spec gets wrong is corrected on the branch and is no failure; if the spec's decisions must change, or it cannot start the subagents `sdd` needs (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`), stop there; and return only the result, the commands awaiting and any failure reason.
3. **Verify**, one branch at a time, as part of the merge sequence below, never two side by side: a subagent's report is not evidence. Run the Verification of `project.md` yourself on the branch, each command but the awaiting ones.
4. **Merge**, one at a time, in the order the specs finish; a spec that another's `After:` names merges first. `manual`: leave the branch and keep the output as evidence. `auto` or `ask`: first note whether it will fast-forward (`git merge-base --is-ancestor main <slug>`), then merge in `main`'s checkout and do step 4's wrap-up. A conflict (`Overlaps:` low or medium): the spec merging later resolves it as `workflow.md` step 4 says, except that where it would stop and ask, `git merge --abort` and treat it as failed.
5. **`main` broken**: a merge that did not fast-forward gets the Verification again on `main`, the awaiting commands aside. It fails: no more merges and no new specs; no rollback, no push. Specs in flight finish on their own branches; do not merge them, and do not write their `Batch run failed` line: each branch is a Claim, and the next `/drain` lists it as In progress. Once they have all handed back, go to section 4's notification and final message.

**Failed** means a subagent could not finish its step, a verification did not pass, a merge could not be done, or the spec's decisions must change. The spec stops alone, and the others in flight carry on: commit any progress on its branch, add one line to its `## Comments` there, `- Batch run failed: <reason>`, set `Status` back if it says `done`, and commit. With `Worktree: no`, `git switch main`. No merge. The branch left behind is a Claim, so the next `/drain` lists it as In progress. With no branch yet, the reason goes in the final message only.

**Context limit**: whenever a slot frees, after the lookups if a merge freed it and before starting the next spec, look for a `Context size:` line in this conversation saying past 200k or more (the Context size hook injects one after a Bash call; a 150k line changes nothing here). If there is one, start no more specs: every spec not started is **Left for the next run**, which is not failed, skips nothing and leaves no line anywhere. Every spec in flight finishes and merges as usual first; never cut one short for this. Then the run goes to section 4. `main` broken still wins.

Done when: every spec in the order is merged, waiting as `manual`, failed, skipped or Left for the next run, or `main` broke and every spec in flight has handed back.

## 4. Finish

Delete `.scratch/batch-run` first: the run takes no more specs, and a failed spec's branch is its own Claim. Every way out of section 3 comes through here, `main` broken included.

Load `PushNotification` (`ToolSearch` with `select:PushNotification`). Right before the push, or at the end when nothing will be pushed, send one line: how many merged, how many failed, whether it pushes, and, after the Context limit, how many are left and that it needs a `/clear` or `/compact`. Send another only if the push or a Deploy check fails. If it cannot be loaded or sent, say so in the final message.

**Push** as chosen in section 2, once, in `main`'s checkout, under the Push policy, the Rebase rule and the Guard:

- Compare the files with the Deploy paths as `workflow.md` says, but do not ask. "Only if no Deploy path is touched" and one is: do not push; the final message lists the matching files and the Deploy paths they match.
- `Push: owner`: hand the command over.
- Where the Rebase rule would ask: do not push, and say why.
- After a push: the Deploy check and Production check, as `workflow.md` says.

**The final message**, last: each spec's result (merged; `manual` with its evidence; failed or skipped with the reason; Left for the next run; after `main` broke, where each spec in flight stopped on its branch); which specs ran side by side; the Awaiting OS-bound verification list, and whether what was pushed includes a change still awaiting one; the push result; the commit list and push line of `global.md`. A Compact proposal, if one is due, goes here and nowhere earlier in the run. After the Context limit one is always due and ends the message, as `global.md` says, naming `/drain` as what to run after it for the specs left.

Done when: the push, if any, has concluded with its checks, and the final message covers every spec from section 1.
