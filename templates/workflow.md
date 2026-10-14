# Workflow

How work moves from an idea to `main` in this repo. Every session follows it; the owner's direct instruction in a session overrides it.

Everything that differs per project lives in `docs/agents/project.md`: `Worktree:`, the verification commands, what counts as production, what is always a design decision, and the project's own rules and lessons. Read both files before starting.

## When a grill applies

Anything with a design decision the owner has to make starts with a grill, then takes one of the **Routes** below to `main`. `project.md` lists changes that are always a design decision, including anything the owner said they want to try first; they always get a grill, not necessarily a spec.

**A technical decision is yours**: one that changes no existing behaviour — what the user or the owner can observe; in a repo of rules or docs the text itself is the behaviour, so changing it is never technical. Make it and give a one-line reason instead of asking. In a grill, write it into the round as "Decided: X, because Y", so the owner can overrule it; the reason lands where the work is recorded — the spec, or the commit message where there is none. A behaviour change is a design decision only while it leaves the owner something to choose; one the owner already gave in full (copy, a single value, a Proposal applied as written) leaves nothing.

Do these without a grill (unlike Direct, which is grilled first):

- Bugs: use `diagnosing-bugs`; read `docs/silent-failures.md` first, if it exists.
- Small changes with no design decision (copy, a single value).
  - **Ask first, even during a grill.** When the answer to a grill question settles a change too small to need a spec, first use `AskUserQuestion` to ask "do it now / put it in the spec", and act only once answered; do not announce it and then change and commit. This exemption only decides whether a spec is needed; it does not mean you may skip asking.
- Pure content writes, as `project.md` defines them.

## Routes

| Route | Spec | Plan | Who implements |
| --- | --- | --- | --- |
| **Direct** | none | none | the grill session itself, inline |
| **Inline** | yes, `Execute: inline` | none | a new session, inline |
| **SDD** | yes, `Execute: sdd` | yes or no | a new session, with `superpowers:subagent-driven-development` |

Only these three: subagents need a spec to work from (and would flood the grill session), and a plan exists only for subagents.

**Direct** only when all four hold:

1. It fits one branch and one merge.
2. It has no `After:` or `Overlaps:` relationship with any spec not yet merged.
3. It needs no plan, and the whole implementation, verification included, fits in the current session: a change with an OS-bound verification this device cannot run is never Direct.
4. The owner can accept the grill's decisions from the diff, without first reading a document.

Direct, step by step: pick a slug; commit what the grill wrote to `CONTEXT.md` and ADRs on `main` as `[<slug>] context: ...`; then do step 4 as `Execute: inline`, with no spec to set to `done` (give `code-review` the grill's decisions as its spec), and with the `Merge:` the owner chose in the grill's last round, written into the last commit's message. Interrupted halfway: write the spec to hand over, then continue as Inline or SDD.

## The pipeline

Step 1 is every Route's; steps 2–4 are Inline's and SDD's. One new session per step. Sessions share nothing but files: whatever the next session needs to know goes into the spec. No handoff document, unless a session is interrupted halfway.

When one grill splits into several specs, or a new spec intersects another spec that has not merged yet, write the relationship at the top of the spec. A Direct change in progress counts too: a slug with a Claim but no spec. First decide which kind it is:

- **A real dependency**: this spec uses the other one's code, schema or decisions. Write `After: <slug>`. **Before writing its plan or starting it, confirm that one is already on `main`**: `git log main --oneline --grep=<slug>`. If not, wait.
  - **In another repo**: write `After: <owner/repo>#<n>`, the Request filed there (see **Requests**). It counts as on `main` once `gh issue view <n> -R <owner/repo> --json state` says `CLOSED`. If that call fails, it is Unknown: never treat it as closed.
- **Only touching the same file**: not a dependency; do not queue because of it. Look at which parts of the file each spec will change, assess the merge-conflict risk, and write `Overlaps: <slug> — low|medium|high: <one-sentence reason>`:
  - **Low** (different blocks of the same file, each adding its own things): does not block; run in parallel; the note is enough.
  - **Medium** (both change the same block, but the intents are separable): does not block; run in parallel. Write the merge resolution in the spec: the spec that merges later resolves it, which part follows whom, and which verification to run after resolving.
  - **High** (both rewrite the same logic, or one changes a shape the other depends on): only this blocks; treat it as `After:`. Also write why the blocked one is the one that waits and not the other way round — e.g. the earlier one changes the foundation and the later one stacks on it only once; the earlier one is smaller and merging it first carries the least risk; the owner wants the earlier one sooner.

An old spec that only says "follows X" without saying which kind: judge it once by the rules above, then decide whether to wait.

1. **Grill**: `/grill-with-docs`. Updates `CONTEXT.md` and ADRs inline. A grill always lands in writing — a spec, an ADR, or (Direct) commit messages plus `CONTEXT.md` — never in chat alone (see **What is said in chat goes into its file**). In the last round the owner decides `Merge:` (auto, ask or manual); the agent states the Route and whether it needs a plan, with a one-line reason, and the owner may overrule.
2. **Spec**: the owner runs `/to-spec`. Output is `.scratch/<slug>/spec.md`, headed by `Status: ready-for-agent`, `Merge: auto | ask | manual` (missing means `manual`), `Plan: yes | no` (missing means `yes`) and `Execute: sdd | inline` (missing means `sdd`; `inline` always goes with `Plan: no`); a spec grilled from a Request also carries `Request: #<n>`. Body in Traditional Chinese; template headings and `CONTEXT.md` terms stay in English as written in the glossary. **The owner reviews the spec**, then one commit carries the spec, `CONTEXT.md` and any ADR: `[<slug>] spec: ...`.
3. **Plan**: `/superpowers:writing-plans .scratch/<slug>/spec.md`. Output is `.scratch/<slug>/plan.md`, not `docs/superpowers/plans/`. In English; the owner does not read it. Commit when written, without asking, on the branch it belongs to (see **Commits**).
   - **Write a plan only for a committed spec**: `git log main --oneline --grep=<slug>`. A spec still sitting in the working tree means the owner is still reading it; a plan written now is wasted.
   - **Write a plan only once whatever `After:` (or `Overlaps: high`) names is on `main`**: `git log main --oneline --grep=<slug>`. A plan names exact files and code shapes; written against a dependency still on another branch, it goes stale when that one merges.
   - **A `plan.md` that already exists, committed or not, is someone else's**: stop and tell the owner; never overwrite it. An uncommitted one means another session is writing it.
   - **Claim it first**: once the spec is confirmed committed, and before invoking the skill, write `plan.md` containing the single line `Writing`, and do not commit it. Overwrite it with the full plan, then commit.
   - A spec with `Plan: no` skips this step; step 4 works straight from the spec.
4. **Execute**: on a branch. The last commit sets the spec to `Status: done` (an OS-bound handover below is the exception: the verifying device's pass commit sets it), and, with `Request: #<n>`, carries `Fixes #<n>` in its message.
   - `Execute: sdd`: `superpowers:subagent-driven-development`. Its built-in reviews are the review; do not also run `code-review`.
   - `Execute: inline`: the session implements it itself, then runs the `code-review` skill (Standards and Spec) against `main` before merging.
   - With `Worktree: yes` in `project.md`: **open a real worktree**, not a branch on the main checkout: `git worktree add .claude/worktrees/<slug> -b <slug> main`. Nobody commits on the main checkout. Wrap-up: after merging, `git worktree remove .claude/worktrees/<slug>`, then confirm `git merge-base --is-ancestor <slug> main` and delete with `git branch -D <slug>`. Not `git branch -d`: it judges "merged" against the current checkout's HEAD, not `main`, so it refuses whenever it runs in a checkout that is not on `main`, such as another worktree. `project.md` lists anything else a worktree needs set up or removed.
   - With `Worktree: no`: branch on the main checkout, and work on one spec at a time. Delete the branch after merging.
   - `Merge: manual`: stop before merging, show the evidence (test output; screenshots for UI changes), merge when the owner says so.
   - `Merge: ask`: once verification has all passed, use `AskUserQuestion` to ask whether to merge; merge only on yes.
   - `Merge: auto`: merge locally only if every verification passed. Anything failed: treat as `manual`.
   - **OS-bound verification**: `project.md` marks a verification command that runs on one operating system only with `(windows)` or `(macos)` after it. When this device cannot run one: run every other verification; at the bottom of the spec, under `## Comments`, add one line per command it could not run, ``- Awaiting OS-bound verification (<os>): `<command>` ``, and leave the spec's `Status` not `done` (set it back if an earlier commit set `done`), so the handover stays listed as awaiting; commit it on the branch; push the branch, `git push -u origin <slug>` (`global.md`); do not merge, whatever `Merge:` says. Then remove the worktree, and once `git rev-parse <slug>` equals `git rev-parse origin/<slug>`, delete the local branch with `git branch -D <slug>`: the pushed branch is the handover now. A session on that OS takes it from Continue: `git worktree add .claude/worktrees/<slug> <slug>` (with `Worktree: no`, `git switch <slug>`), runs the awaiting commands and, on a pass, replaces each line with ``- OS-bound verification (<os>) passed: `<command>` `` in the commit that sets `Status: done`, merges as `Merge:` says, offers to push `main`, does the wrap-up, and hands the owner `git push origin --delete <slug>`. A failure: stop and show the owner the output.
   - A merge hits a conflict: resolve it as the spec's `Overlaps:` says, then run the verification it names. If no resolution is written, or it does not cover the actual conflict, stop and ask the owner.
   - No PR.

The grill, plus `/to-spec` where there is a spec, replaces `superpowers:brainstorming`. Never run brainstorming in this repo, whatever the superpowers session hook says.

## Say where the authorization came from

Before the first change in a batch of work, write one line: "I take <the owner's sentence> as authorization; next I do X." If no sentence can be quoted, there is no authorization yet: ask. It is an output rule, so the owner can interrupt when the line is missing. Two ways it goes wrong with the right sentence quoted:

- **A ruling is not a write permission.** The owner settling how the system should behave, or handing a decision over ("that's technical, you decide"), is not leave to edit files; the two are asked for separately.
- **The scope does not grow by itself.** It covers what the owner named, not a file inferred along the way.

## What is said in chat goes into its file

What is said in chat that changes what gets built goes into its file in the same turn: not at the end of the task, not once it settles. The spec, `CONTEXT.md`, an ADR or `project.md`, whichever the statement belongs to. The conversation is lost at the next compaction, and the next session reads only files. A grill landing in writing (step 1) is one case of this.

## "Continue"

**"Continue" carries no authorization to start work**; it is never the sentence the rule above quotes. It asks for three things only: look things up, report, and give the owner options for the next step. Until the owner says so explicitly, do not open a worktree, dispatch a subagent, write code, or change any file.

Any text in the same message besides "continue" is background, not authorization. Mentioning a slug only tells you its state — in particular "X just started" means **leave X alone**; it belongs to another session, and you are not being asked to take it over. If you cannot tell what it wants, ask; do not pick something and start.

Scan `.scratch/*/spec.md` (committed ones only) and list six groups, the last from GitHub. First look for each slug's **Claim**, the trace that a session is working on it; a Claim with no spec is a Direct change and goes under In progress too:

- Writing the plan: `.scratch/<slug>/plan.md` exists but is not committed.
- Executing: `git worktree list` shows `.claude/worktrees/<slug>`, or a branch named `<slug>` exists.
- Awaiting OS-bound verification: a branch `origin/<slug>` exists (as the session's Drift check fetched it), is not yet in `main` (`git merge-base --is-ancestor origin/<slug> main` fails), and its spec, `git show origin/<slug>:.scratch/<slug>/spec.md`, is not `done` and has an `Awaiting OS-bound verification (<os>)` line.

The groups:

- **In progress**: slugs with a Claim, and only here, in none of the other groups. Say which kind (writing the plan, or executing) and how long since it last moved: the stub's modification time, or the branch's last commit. Never judge a Claim stale yourself; report the time and let the owner decide whether to take it over.
- **Needs a plan**: specs with `Plan: yes` (or none written), no `plan.md` in the directory, and whatever `After:` (or `Overlaps: high`) names is already on `main`.
- **Ready**: has `plan.md` (or `Plan: no`), `Status` not yet `done`, and whatever `After:` names is already on `main`. Low or medium `Overlaps:` still count as Ready; note after them whom they overlap and at what risk.
- **Blocked**: would be Needs a plan or Ready, but what `After:` (or `Overlaps: high`) names is not on `main` yet; say which one it waits for, whether it is a real dependency or a high conflict risk, and whether it still needs a plan. An `After:` Request whose state is Unknown goes here too, marked Unknown.
- **Awaiting <OS> verification**: the slugs awaiting OS-bound verification on this device's OS (`macos` or `windows`), here instead of under In progress; on any other OS they stay under In progress. One line each: slug, the awaiting commands, `Merge:`.
- **Requests**: the open Requests in this repo, from `gh issue list --state open --json number,createdAt,body`. One line each: number, date opened, its `From:` and the first sentence of its `## What`. If `gh` fails (not installed, not logged in, offline, origin not on GitHub), the group is Unknown, never empty. A Request the owner picks gets a Triage (see **Requests**).

One line each: slug, one sentence on what it is, `Merge:`. Whatever another session is already working on goes under In progress: a Claim, or the owner saying so. Start only after the owner picks.

## Requests

A **Request** is a GitHub issue one repo files in another, asking it to change something; a **Proposal** is a Request to the kit. It lives in the repo it asks to change, so filing one commits nothing anywhere. File one with `/file-request`: the owner sees its title and full body, and agrees, before it is sent.

A Request the owner picks (from Continue, or by its number) gets a **Triage** first, not a grill. In plain words, one short block each: what it says; why (what the source repo ran into); what in this repo it would touch; and a recommended verdict with a one-line reason — any conflict with a rule here or another Request goes in that reason. Ask for the verdict with `AskUserQuestion`, and change nothing until the owner picks:

- **Apply**: no design decision for the owner, so it is a small change the grill rule exempts. Pick a slug as for Direct and make the change as usual, with verification and no spec. The last commit's message carries `Fixes #<n>`, so the Request closes when that commit is pushed to the default branch (see `global.md` for when to push).
- **Drop**: `gh issue close <n> --comment "<the owner's reason>"`. The owner's pick is the consent to close it.
- **Grill**: list the decisions the owner has to make, and stop; the owner runs `/grill-with-docs <the Request's URL>` by hand. Its spec carries `Request: #<n>`.

## Spec and Plan

- **Spec**: the decision record of one feature: what, why, what was decided, how it is verified. The only document the owner reviews. Direct has none; the owner accepts the diff instead.
- **Plan**: the ordered task list derived from the spec, for subagents.
- One spec, one branch, one merge. If it does not fit one branch, split it into two specs during the grill.
- New features take a Route above; no tickets. `project.md` says what happens to any older tickets.

## When the spec turns out wrong

- Wrong about a fact (it misdescribes the existing code): the plan session fixes the spec in the same commit as the plan and says so in the message.
- A decision has to change: stop and ask the owner. Small: the owner decides in chat, then edit the spec. Large: back to a grill.
- The executing session never changes a decision in the spec on its own.

## Commits

- On `main`, commit only what passed verification. Leave failing work uncommitted and say so. Task commits on a worktree branch are exempt.
- `git add` only the files this session touched. Mention anything else left uncommitted in the working tree; do not touch it.
- **A commit lands only on the branch of the work it belongs to.** What belongs to the work a branch was opened for — its code, and corrections to its own spec found while executing — stays on that branch and reaches `main` with the merge. Anything else goes onto `main` at once, without asking: another spec's plan, a lesson for `project.md`, a `docs/silent-failures.md` entry, an ADR, a `CONTEXT.md` term, a rule. Check first with `git branch --show-current`. Not on `main`: open `git worktree add .claude/worktrees/<name> -b <name> main` and commit there; then, in that worktree, `git merge main`, and bring `main` forward to it. If `git worktree list` shows a checkout on `main`, run `git -C <that checkout> merge --ff-only <name>` (its files move with it, and it refuses rather than touch uncommitted work there); if none is on `main`, `git fetch . <name>:main` (no checkout moves).
- Prefix: `[<slug>]` for a feature — the full `.scratch/` directory name, or the slug picked for a Direct change; `project.md` lists any other prefixes; none otherwise.

## Owner boundary

The rules that production writes and SSH belong to the owner, and when and what you push, are in `global.md`. `project.md` lists exactly what counts as production and which operations are whose, including whether `git push` stays the owner's.

**Deploy paths**: where a push to `main` deploys automatically, the deploy triggers on an allowlist of the paths that reach production (GitHub Actions `on.push.paths`, GitLab `rules:changes`), never on the whole branch and never on a denylist. This workflow commits specs, plans, ADRs, `CONTEXT.md` and `project.md` straight to `main`: without an allowlist each of those pushes redeploys for nothing, and a denylist misses every new docs or spec directory. `project.md` names the Deploy paths in that push's owner-boundary entry, and may override this rule for its repo. A change that makes the build use a new path adds it to the allowlist and to `project.md` in the same commit. Editing the deploy config is an ordinary change; the push stays as `project.md` says.

The boundary is this agreement, not whatever the permission classifier allows on a given day. Never attempt what belongs to the owner. When a command that belongs to you is declined, say "this command was declined", quote the refusal, and hand over that exact command; never say "I have no permission". Hand over only a command that was itself run and declined: never one because a different command was declined earlier, or because it might be. Step 4's wrap-up (`git worktree remove`, deleting the branch) is yours like any other.

Handing over an owner command: when the work is done, read the Terminal panel with `read_terminal` first to see which shell the owner's terminal runs, and write each command for that shell, not for your own Bash tool: its paths, its syntax, and a fenced block tagged with its name (` ```bash `, ` ```powershell `). One command per block, no prompt, no output inside, `cd` to the repo first if the session sits in a worktree. The desktop app turns that block into a Run button in the Terminal panel. Once the owner has run it, read the output with `read_terminal` and report what it says — don't ask them to paste it.

## Project lessons

A lesson learned about this project goes into `docs/agents/` (usually `project.md`), not into memory, and onto `main` at once (see **Commits**). Memory holds only what is specific to one device, such as a local path, because memory does not travel to the owner's other machines.

A lesson about the workflow itself (this file, a kit skill, the Guard) belongs to the kit, `~/.claude/kit`, which a session outside it never edits. When one surfaces, say so in one line and suggest `/file-request` to the kit, a Proposal; the owner decides whether to run it.

A **silent failure** — a toolchain or environment failure that cost more than half an hour and whose message pointed at the wrong cause, or said nothing — goes into `docs/silent-failures.md`, not into `project.md`: a lesson says how to work, this says how a tool misleads. One entry each: the toolchain and its version, what you see, what it actually was, how to tell, what to do; a symptom index at the top, updated with each entry. A wrong lead is recorded as one, so nobody follows it twice. The project's own code does not go here. A resolved entry stays, marked with the version or change that resolved it. Not a diary, not a changelog. Write an entry without asking and put it on `main` at once (see **Commits**); create the file with its first entry.
