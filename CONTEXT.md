# kit

The owner's agent workflow: the rules, templates and skills every project and device shares.

## Language

**Owner**:
The one person who decides designs, reviews specs, and alone runs `git push`, production writes and SSH.
_Avoid_: user, maintainer

**Template**:
A file in `templates/` that `/sync-workflow` copies into a repo; `workflow.md` is carried verbatim under a `Template: <sha>` line.

**Guard**:
The hook that mechanically enforces the owner boundary and the commit rules. The written rule stays the single source; the guard is its backstop.
_Avoid_: guardrail, git hook

**Claim**:
The visible trace that a session is working on a slug: an uncommitted `plan.md` while a plan is being written, a worktree or branch named after the slug while it is executed.
_Avoid_: lock, reservation

**Route**:
The path a grilled change takes to `main`: **Direct** (no spec; the grill session implements it), **Inline** (a spec; a new session implements it itself), or **SDD** (a spec, with or without a plan; subagents implement it).
_Avoid_: path, track, mode

**Proposal**:
A change to the kit brought back from another repo, where it was tried first. It is the input to a Triage in the kit, never a decision; a session outside the kit writes a Proposal instead of editing the kit.
_Avoid_: feedback, suggestion, issue

**Inbox**:
Where Proposals wait in the kit until the owner, after a Triage, applies, drops or grills them. The only part of the kit a session outside it may write.
_Avoid_: queue, backlog

**Triage**:
The first look at a Proposal the owner picks from the Inbox: what it says, why, what it would touch, and a recommended verdict — apply, drop, or grill. The owner decides; triage only recommends.
_Avoid_: review, screening

**Drift**:
A local repo differing from its remote: behind, ahead, uncommitted changes, or a branch with no upstream.
_Avoid_: out of sync, unsynced

**Unknown**:
The state when Drift cannot be checked (the remote could not be reached). Never the same as no Drift.
_Avoid_: synced, clean

**Silent failure**:
A toolchain or environment failure that reports nothing, or reports something other than its cause, and cost more than half an hour. Recorded per repo so nobody follows the wrong lead twice; unlike a lesson, it says how a tool misleads, not how the agent should work.
_Avoid_: gotcha, landmine, known issue
