# kit

The owner's agent workflow: the rules, templates and skills every project and device shares.

## Language

**Owner**:
The one person who decides designs, reviews specs, and alone runs production writes and SSH — and `git push` where a project reserves it. An agent pushes only when the owner asks.
_Avoid_: user, maintainer

**Template**:
A file in `templates/` that `/sync-workflow` copies into a repo; `workflow.md` is carried verbatim under a `Template: <sha>` line.

**Guard**:
The hook that mechanically enforces the owner boundary and the commit rules. The written rule stays the single source; the guard is its backstop.
_Avoid_: guardrail, git hook

**Deploy paths**:
In a repo where a push to `main` deploys automatically, the allowlist of paths whose change triggers that deploy; a push touching none of them deploys nothing. Listed in the repo's owner boundary.
_Avoid_: deploy filter, trigger paths, paths-ignore

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

**Retired repo**:
A repo the owner no longer works on from this device, listed so this device's Drift scan skips it. It is counted, never silently hidden; a session opened in it still checks its Drift.
_Avoid_: archived, ignored, old repo

**Silent failure**:
A toolchain or environment failure that reports nothing, or reports something other than its cause, and cost more than half an hour. Recorded per repo so nobody follows the wrong lead twice; unlike a lesson, it says how a tool misleads, not how the agent should work.
_Avoid_: gotcha, landmine, known issue

**Design decision**:
A decision only the owner makes: a choice between alternatives that changes existing behaviour (in a repo of rules or docs, the text itself is the behaviour), or one `project.md` lists as always a design decision. A change the owner already gave in full (copy, a single value, a Proposal applied as written) leaves no decision. A grill asks it as a question.
_Avoid_: product decision, big decision

**Technical decision**:
A decision that changes no existing behaviour. The agent makes it and writes a one-line reason where the work is recorded; the owner may overrule. Deciding it is not leave to act on it.
_Avoid_: implementation detail, minor decision

**Session title**:
The name a session shows in the app's sidebar and in Remote Control: `[<Device code>] <Phase> · <topic>`, the topic being the slug once there is one. The agent sets it once the session's work is known, and again when its Phase changes.
_Avoid_: session name, label

**Device code**:
The short name of the machine a session runs on (`studio`, `mbp`, `win`) — not the device it is watched from. Set once per device; a device without one shows `?`.
_Avoid_: hostname, device name

**Phase**:
What a session is doing now, as its Session title shows it: grill, spec, plan, sdd, inline, debug, triage, review, next or chat. Each pipeline step has its Phase, but a Phase also covers work outside the pipeline.
_Avoid_: step, stage
