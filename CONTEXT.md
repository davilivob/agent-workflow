# kit

The owner's agent workflow: the rules, templates and skills every project and device shares.

## Language

**Owner**:
The one person who decides designs, reviews specs, and alone runs `git push`, production writes and SSH.
_Avoid_: user, maintainer

**Template**:
A file in `templates/` that `/init-workflow` copies into a repo; `workflow.md` is carried verbatim under a `Template: <sha>` line.

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
A change to the kit brought back from another repo, where it was tried first. It is the input to a kit grill, never a decision; a session outside the kit writes a Proposal instead of editing the kit.
_Avoid_: feedback, suggestion, issue

**Inbox**:
Where Proposals wait in the kit until a grill takes them up or the owner drops them. The only part of the kit a session outside it may write.
_Avoid_: queue, backlog
