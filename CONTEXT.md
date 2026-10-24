# kit

The owner's agent workflow: the rules, templates and skills every project and device shares.

## Language

**Owner**:
The one person who decides designs, reviews specs, and alone runs production writes and SSH — and `git push` where the project's Push policy is `owner`. Elsewhere an agent may push; under `ask` every push waits for the owner's consent at the Guard's prompt.
_Avoid_: user, maintainer

**Template**:
A file in `templates/` that `/sync-workflow` copies into a repo; `workflow.md` is carried verbatim under a `Template: <sha>` line naming the last kit commit that changed it.

**Guard**:
The hook that mechanically enforces the owner boundary and the commit rules. The written rule stays the single source; the guard is its backstop.
_Avoid_: guardrail, git hook

**Deploy paths**:
In a repo where a push to `main` deploys automatically, the allowlist of paths whose change triggers that deploy; a push touching none of them deploys nothing. Listed in the repo's owner boundary.
_Avoid_: deploy filter, trigger paths, paths-ignore

**Production URL**:
The public address a deployed project serves, named in its owner-boundary entry. A project with one gets a Production check after each deploy; one without gets none.
_Avoid_: site URL, live link

**Deploy check**:
Watching the deploy runs a push triggered until they conclude: success, failure, or Unknown when they cannot be seen through. Only for a push the agent made.
_Avoid_: CI check, post-deploy check

**Production check**:
Looking at the Production URL after a Deploy check succeeds, as a visitor would and with reads only: the page loads, the console is clean, and a visible change shows. Distinct from the Deploy check, because a deploy can succeed while production stays broken.
_Avoid_: smoke test, post-deploy check

**Claim**:
The visible trace that a session is working on a slug: an uncommitted `plan.md` while a plan is being written, a worktree or branch named after the slug while it is executed.
_Avoid_: lock, reservation

**Route**:
The path a grilled change takes to `main`: **Direct** (no spec; the grill session implements it), **Inline** (a spec; a new session implements it itself), or **SDD** (a spec, with or without a plan; subagents implement it).
_Avoid_: path, track, mode

**Request**:
A GitHub issue one repo files in another, asking it to change something. It waits there until the owner, after a Triage, applies, drops or grills it. A spec that needs it done first names it in `After:`.
_Avoid_: issue (that is a local ticket under a spec), ticket, dispatch

**Proposal**:
A Request to the kit, brought back from another repo where it was tried first. A session outside the kit files a Proposal instead of editing the kit.
_Avoid_: feedback, suggestion, inbox

**Triage**:
The first look at a Request: what it says, why, what it would touch, and a verdict — apply, drop, or grill. For a Request the owner picks, triage only recommends and the owner decides. An unattended triage applies on its own only a Request the owner filed that leaves nothing to choose (applied as written); everything else waits for the owner.
_Avoid_: review, screening

**Request watch**:
The scheduled, unattended check one device runs for new Requests in the repos that name it: it triages each, applies the ones the owner filed as written, and tells the owner about the rest. A repo names its watching device in `project.md`, so no Request is applied twice.
_Avoid_: auto-apply, bot, monitor, auto-triage

**OS-bound verification**:
A verification step that runs only on one operating system. A change that needs it is verified and merged from a device on that OS, whichever device wrote it.
_Avoid_: platform test, Windows test

**Drift**:
A local repo differing from its remote: behind, ahead, uncommitted changes, or a branch with no upstream.
_Avoid_: out of sync, unsynced

**Push policy**:
What a repo declares about agent pushes, one value for every device: `owner` (every push is the owner's), `ask` (the default: the Guard asks at every push) or `auto` (a push of `main` goes out right after its commit, without the Guard asking). Force, delete, tag, mirror and refspec pushes are the owner's under all three.
_Avoid_: push mode, auto-push

**Pull policy**:
What a repo declares about bringing `main` up to date with its remote, one value for every device: `ff` (the default: fast-forward only) or `rebase` (`main` diverged from its remote, or its push rejected, is rebased onto it, unless that is unsafe).
_Avoid_: sync method, pull mode

**Unknown**:
The state when something cannot be checked: Drift (the remote could not be reached), a Request's state, a Deploy check that timed out. Never the same as a pass.
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
The name a session shows in the app's sidebar and in Remote Control: `[<Device code>] <Phase> · <topic>`, the topic being the slug once there is one. The agent sets it once the session's work is known, and again when its Phase or topic changes; right after `/clear`, until then, it is `[<Device code>] Cleared`.
_Avoid_: session name, label

**Device code**:
The short name of the machine a session runs on (`studio`, `mbp`, `win`) — not the device it is watched from. Set once per device; a device without one shows `?`.
_Avoid_: hostname, device name

**Phase**:
What a session is doing now, as its Session title shows it: grill, spec, plan, sdd, inline, debug, triage, review, next or chat. Each pipeline step has its Phase, but a Phase also covers work outside the pipeline.
_Avoid_: step, stage
