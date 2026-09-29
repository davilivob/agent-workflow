---
name: generate-kit-proposal
description: Find what this repo's workflow does better than the kit and would hold in every project; draft Proposals, then hand them to propose-to-kit.
disable-model-invocation: true
---

The diff half of carrying an experiment back to the kit (`~/.claude/kit`): this skill reads and drafts. It writes nothing in the source repo, and nothing in the kit beyond bringing it up to date. `propose-to-kit` is the apply half: the owner reviews there, and only it writes the kit's `inbox/`.

**Source**: `git rev-parse --show-toplevel` of the current directory. Not a git repo, or the source is the kit itself (`pwd -P` of both match) → stop and say so: in the kit, grill the idea directly.

**Work directory** `W`: `kit-proposals/` under the session's scratchpad directory, else `mktemp -d`.

## 1. Candidates

If `git -C ~/.claude/kit remote` prints a name, `git -C ~/.claude/kit pull --ff-only` first (on failure stop and show the output), so nothing is compared against a stale kit. Then collect every place the source differs from the kit:

1. **`docs/agents/workflow.md`**: classify it as the "5. Update mode" section of `~/.claude/kit/skills/init-workflow/SKILL.md` does, its files in `W` instead of a `mktemp -d`, applying nothing; where that section stops, stop too. Each ahead or conflict hunk is one candidate.
2. **`docs/agents/project.md`**: each entry under "Rules and lessons", and each entry under any other section that reads as a rule. A value (a verification command, `Worktree:`, a production command) is this repo's own: not a candidate.
3. **Repo-local extensions**: each skill under `.claude/skills/`; each `## ` section of `CLAUDE.md` whose heading and body are not both identical to a section of `~/.claude/kit/templates/claude-section.md`, `## graphify` excepted; each hook in `.claude/settings.json` that is not graphify's.

For each candidate note where it lives, and since when: `git log -S'<a distinctive line of it>' --format='%h %ad %s' --date=short --reverse -- <path> | head -1`.

Done when: every item of the three sources is a candidate, a value, or identical to the kit.

## 2. Filter

Judge each candidate against all three:

- **Portable**: it depends on none of this repo's stack, paths or tools; it would hold in a Unity repo and a web repo alike.
- **New**: nothing in the kit's `templates/`, `skills/`, `global.md` or `inbox/` already says it. One that contradicts a kit rule passes as `replaces <that rule>`; one that sharpens a kit rule passes as `merges <that rule>`.
- **A rule, not a value**: one that is really this repo's value for something every repo decides passes as "the `project.md` template gains a field for this" (`Touches: templates/project.md`).

Done when: every candidate passes, with its `Kind:`, or fails with a one-line reason.

## 3. Draft

Draft each passing candidate as a Proposal in the format under "2. Draft" of `~/.claude/kit/skills/propose-to-kit/SKILL.md`, `TODO(owner)` rule included, one file per candidate in `W`, named as that section names inbox files.

Report to the owner: one line per passing candidate (its file and a sentence), then one line per failing candidate with its reason.

Done when: every passing candidate has a draft file.

## 4. Hand over

No passing candidate: stop after the report. Otherwise read `~/.claude/kit/skills/propose-to-kit/SKILL.md` and follow it with the draft files as its input.
