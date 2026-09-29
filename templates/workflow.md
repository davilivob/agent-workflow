# Workflow

How work moves from an idea to `main` in this repo. Every session follows it; the owner's direct instruction in a session overrides it.

Everything that differs per project lives in `docs/agents/project.md`: `Worktree:`, the verification commands, what counts as production, what is always a design decision, and the project's own rules and lessons. Read both files before starting.

## When the pipeline applies

Anything with a design decision the owner has to make goes through the four-step pipeline below. `project.md` lists changes that are always a design decision.

Do these directly, without the pipeline:

- Bugs: use `diagnosing-bugs`.
- Small changes with no design decision (copy, a single value).
  - **Ask first, even during a grill.** When the answer to a grill question settles a change too small to need a spec, first use `AskUserQuestion` to ask "do it now / put it in the spec", and act only once answered; do not announce it and then change and commit. This exemption only decides whether a spec is needed; it does not mean you may skip asking.
- Pure content writes, as `project.md` defines them.

## The pipeline

One new session per step. Sessions share nothing but files: whatever the next session needs to know goes into the spec. No handoff document, unless a session is interrupted halfway.

When one grill splits into several specs, or a new spec intersects another spec that has not merged yet, write the relationship at the top of the spec. First decide which kind it is:

- **A real dependency**: this spec uses the other one's code, schema or decisions. Write `After: <slug>`. **Before starting, confirm that one is already on `main`**: `git log main --oneline --grep=<slug>`. If not, wait.
- **Only touching the same file**: not a dependency; do not queue because of it. Look at which parts of the file each spec will change, assess the merge-conflict risk, and write `Overlaps: <slug> — low|medium|high: <one-sentence reason>`:
  - **Low** (different blocks of the same file, each adding its own things): does not block; run in parallel; the note is enough.
  - **Medium** (both change the same block, but the intents are separable): does not block; run in parallel. Write the merge resolution in the spec: the spec that merges later resolves it, which part follows whom, and which verification to run after resolving.
  - **High** (both rewrite the same logic, or one changes a shape the other depends on): only this blocks; treat it as `After:`. Also write why the blocked one is the one that waits and not the other way round — e.g. the earlier one changes the foundation and the later one stacks on it only once; the earlier one is smaller and merging it first carries the least risk; the owner wants the earlier one sooner.

An old spec that only says "follows X" without saying which kind: judge it once by the rules above, then decide whether to wait.

1. **Grill**: `/grill-with-docs`. Updates `CONTEXT.md` and ADRs inline. A grill always lands in a written spec or an ADR — never in chat alone. The last round asks the owner two things: whether this feature may merge automatically, and whether it is big enough to need a plan.
2. **Spec**: the owner runs `/to-spec`. Output is `.scratch/<slug>/spec.md`, headed by `Status: ready-for-agent`, `Merge: auto | ask | manual` (missing means `manual`) and `Plan: yes | no` (missing means `yes`). Body in Traditional Chinese; template headings and `CONTEXT.md` terms stay in English as written in the glossary. **The owner reviews the spec**, then one commit carries the spec, `CONTEXT.md` and any ADR: `[<slug>] spec: ...`.
3. **Plan**: `/superpowers:writing-plans .scratch/<slug>/spec.md`. Output is `.scratch/<slug>/plan.md`, not `docs/superpowers/plans/`. In English; the owner does not read it. Commit when written, without asking.
   - **Write a plan only for a committed spec**: `git log main --oneline --grep=<slug>`. A spec still sitting in the working tree means the owner is still reading it; a plan written now is wasted.
   - **A `plan.md` that already exists, committed or not, is someone else's**: stop and tell the owner; never overwrite it. An uncommitted one means another session is writing it.
   - **Claim it first**: once the spec is confirmed committed, and before invoking the skill, write `plan.md` containing the single line `Writing`, and do not commit it. Overwrite it with the full plan, then commit.
   - A spec with `Plan: no` skips this step; step 4 works straight from the spec.
4. **Execute**: `superpowers:subagent-driven-development` on a branch. Its built-in reviews are the review; do not also run `code-review`. The last commit sets the spec to `Status: done`.
   - With `Worktree: yes` in `project.md`: **open a real worktree**, not a branch on the main checkout: `git worktree add .claude/worktrees/<slug> -b <slug> main`. Nobody commits on the main checkout. Wrap-up: after merging, `git worktree remove .claude/worktrees/<slug>` and delete the branch. `project.md` lists anything else a worktree needs set up or removed.
   - With `Worktree: no`: branch on the main checkout, and work on one spec at a time. Delete the branch after merging.
   - `Merge: manual`: stop before merging, show the evidence (test output; screenshots for UI changes), merge when the owner says so.
   - `Merge: ask`: once verification has all passed, use `AskUserQuestion` to ask whether to merge; merge only on yes.
   - `Merge: auto`: merge locally only if every verification passed. Anything failed: treat as `manual`.
   - A merge hits a conflict: resolve it as the spec's `Overlaps:` says, then run the verification it names. If no resolution is written, or it does not cover the actual conflict, stop and ask the owner.
   - No PR.

Grill plus `/to-spec` replaces `superpowers:brainstorming`. Never run brainstorming in this repo, whatever the superpowers session hook says.

## "Continue"

**"Continue" carries no authorization to start work.** It asks for three things only: look things up, report, and give the owner options for the next step. Until the owner says so explicitly, do not open a worktree, dispatch a subagent, write code, or change any file.

Any text in the same message besides "continue" is background, not authorization. Mentioning a slug only tells you its state — in particular "X just started" means **leave X alone**; it belongs to another session, and you are not being asked to take it over. If you cannot tell what it wants, ask; do not pick something and start.

Scan `.scratch/*/spec.md` (committed ones only) and list four groups. First look for each slug's **Claim**, the trace that a session is working on it:

- Writing the plan: `.scratch/<slug>/plan.md` exists but is not committed.
- Executing: `git worktree list` shows `.claude/worktrees/<slug>`, or a branch named `<slug>` exists.

The groups:

- **In progress**: slugs with a Claim, and only here, in none of the other groups. Say which kind (writing the plan, or executing) and how long since it last moved: the stub's modification time, or the branch's last commit. Never judge a Claim stale yourself; report the time and let the owner decide whether to take it over.
- **Needs a plan**: specs with `Plan: yes` (or none written) and no `plan.md` in the directory.
- **Ready**: has `plan.md` (or `Plan: no`), `Status` not yet `done`, and whatever `After:` names is already on `main`. Low or medium `Overlaps:` still count as Ready; note after them whom they overlap and at what risk.
- **Blocked**: same conditions as Ready, but what `After:` (or `Overlaps: high`) names is not on `main` yet; say which one it waits for, and whether it is a real dependency or a high conflict risk.

One line each: slug, one sentence on what it is, `Merge:`. Whatever another session is already working on goes under In progress: a Claim, or the owner saying so. Start only after the owner picks.

## Spec and Plan

- **Spec**: the decision record of one feature: what, why, what was decided, how it is verified. The only document the owner reviews.
- **Plan**: the ordered task list derived from the spec, for subagents.
- One spec, one branch, one merge. If it does not fit one branch, split it into two specs during the grill.
- New features go through the pipeline above; no tickets. `project.md` says what happens to any older tickets.

## When the spec turns out wrong

- Wrong about a fact (it misdescribes the existing code): the plan session fixes the spec in the same commit as the plan and says so in the message.
- A decision has to change: stop and ask the owner. Small: the owner decides in chat, then edit the spec. Large: back to a grill.
- The executing session never changes a decision in the spec on its own.

## Commits

- On `main`, commit only what passed verification. Leave failing work uncommitted and say so. Task commits on a worktree branch are exempt.
- `git add` only the files this session touched. Mention anything else left uncommitted in the working tree; do not touch it.
- Prefix: `[<slug>]` with the full `.scratch/` directory name for a feature; `project.md` lists any other prefixes; none otherwise.

## Owner boundary

The rule that production writes, SSH and `git push` belong to the owner is in `global.md`. `project.md` lists exactly what counts as production and which operations are whose.

The boundary is this agreement, not whatever the permission classifier allows on a given day. Never attempt what belongs to the owner. When a command that belongs to you is declined, say "this command was declined" and hand over the exact command; never say "I have no permission".

Handing over an owner command: when the work is done, put each command in its own ` ```bash ` block, no `$`, no output inside, `cd` to the repo first if the session sits in a worktree. The desktop app turns that block into a Run button in the Terminal panel. Once the owner has run it, read the output with `read_terminal` and report what it says — don't ask them to paste it.

## Project lessons

A lesson learned about this project goes into `docs/agents/` (usually `project.md`), not into memory. Memory holds only what is specific to one device, such as a local path, because memory does not travel to the owner's other machines.
