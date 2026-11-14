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
The visible trace that a session is working on a slug: an uncommitted `plan.md` while a plan is being written, a worktree or branch named after the slug while it is executed, a line of the uncommitted `.scratch/batch-run` while a Batch run has it queued.
_Avoid_: lock, reservation

**Route**:
The path a grilled change takes to `main`: **Direct** (no spec; the grill session implements it), **Inline** (a spec; a new session implements it itself), or **SDD** (a spec, with or without a plan; subagents implement it).
_Avoid_: path, track, mode

**Batch run**:
One session conducting every spec a repo has ready, once the owner has confirmed the list: specs the run judges safe to run together are planned and executed side by side, each on its own branch, and merged into `main` one at a time; the rest wait their turn. It asks nothing more until the end: a spec it cannot finish stays on its branch while the rest go on. Started with `/drain`.
_Avoid_: drain (that is the command), sweep, queue, autopilot

**Probe report**:
What an unattended probe of a running project leaves behind — `/soak-tune` tuning its parameters under long or heavy load, `/ux-probe` working through its interface as a user would: observations with their evidence, and ranked recommendations. Never a decision: whatever the owner wants to adopt from it goes through a grill like any other change.
_Avoid_: audit, findings, spec

**Rule audit**:
A pass over a repo's own rule layer — never the files the kit carries in — for content in the wrong file, duplicates that disagree or will silently go stale, rules handing the owner work they never asked for, and rules a tool or hook already enforces. It ends in a table the session marks keep, trim or delete itself and applies at once, so the owner overrules any mark by a revert; at most four rows it cannot settle are asked instead. Started with `/rule-audit`; the session-open report reminds the owner when one is due.
_Avoid_: probe, review, cleanup

**Request**:
A GitHub or Gitea issue one repo files in another, asking it to change something. It waits there until the owner, after a Triage, applies, drops or grills it. A spec that needs it done first names it in `After:`.
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
A verification step that runs only on one operating system. A change that needs it merges once everything else has passed; the step stays open on its spec until a device on that OS runs it, whichever device wrote the change.
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

**Knowledge base**:
The one repo where the owner gathers knowledge that is no repo's own, named per device in `~/.claude/knowledge_base.conf`; the kit never names it. A session elsewhere reads it when a problem is no repo's own, and writes into it only Notes, into its inbox; the Knowledge base's own sessions sort what arrives.
_Avoid_: notebook, my-friend; a repo's own docs are `CONTEXT.md` or `project.md`, not its knowledge base

**Note**:
One piece of knowledge that is useful outside the repo where it was learned, written into the Knowledge base's inbox and committed there.
_Avoid_: lesson (that is a repo's own), memo, inbox entry

**Design decision**:
A decision only the owner makes: a choice between alternatives that changes existing behaviour (in a repo of rules or docs, the text itself is the behaviour), or one `project.md` lists as always a design decision. A change the owner already gave in full (copy, a single value, a Proposal applied as written) leaves no decision. A grill asks it as a question.
_Avoid_: product decision, big decision

**Technical decision**:
A decision that changes no existing behaviour. The agent makes it and writes a one-line reason where the work is recorded; the owner may overrule. Deciding it is not leave to act on it.
_Avoid_: implementation detail, minor decision

**Session title**:
The name a session shows in the app's sidebar and in Remote Control: `[<Device code>] <Phase> · <topic>`, the topic being the slug once there is one. The agent sets it as `global.md` says.
_Avoid_: session name, label

**Context size**:
How many tokens a session's last model call was sent, measured from its transcript. Counted in absolute tokens, not as a share of the context window, which a hook cannot see.
_Avoid_: context usage, context percentage

**Compact proposal**:
The agent offering the owner, at a natural break, either a ready-to-run `/compact` with written instructions, or `/clear` when everything the work needs is already in files. Prompted when the Context size first crosses its threshold, and again at each further step; only the owner runs either command.
_Avoid_: auto-compact (that is Claude Code's own, near the window's limit), compact reminder

**Device code**:
The short name of the machine a session runs on (`studio`, `mbp`, `win`) — not the device it is watched from. Set once per device; a device without one shows `?`.
_Avoid_: hostname, device name

**Phase**:
What a session is doing now, as its Session title shows it: one of the values `global.md` lists. Each pipeline step has its Phase, but a Phase also covers work outside the pipeline.
_Avoid_: step, stage
