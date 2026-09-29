---
name: generate-kit-proposal
description: Find what this repo's workflow does better than the kit and would hold in every project; draft Proposals, then hand them to propose-to-kit.
disable-model-invocation: true
---

The diff half of carrying an experiment back to the kit (`~/.claude/kit`): this skill reads and drafts, and writes nothing in either repo. `propose-to-kit` is the apply half: the owner reviews there, and only it writes the kit's `inbox/`.

**Source**: `git rev-parse --show-toplevel` of the current directory. Not a git repo, or the source resolves to the kit itself (`pwd -P` under `cd ~/.claude/kit && pwd -P`) → stop and say so: in the kit, grill the idea directly.

## 1. Candidates

Collect every place the source differs from the kit:

1. **`docs/agents/workflow.md`**: its ahead and conflict items against `~/.claude/kit/templates/workflow.md`, computed as section 5 of `~/.claude/kit/skills/init-workflow/SKILL.md` does (read-only: classify, apply nothing). Each hunk is one candidate.
2. **`docs/agents/project.md`**: each entry under "Rules and lessons", and each entry under any other section that reads as a rule rather than a value of this repo.
3. **Repo-local extensions**: each skill under `.claude/skills/`; each `CLAUDE.md` section that is neither in `~/.claude/kit/templates/claude-section.md` nor `## graphify`; each hook in `.claude/settings.json` that is not graphify's.

For each candidate note where it lives and, from `git log --format='%h %ad %s' --date=short -- <path>`, since when it has been there.

Done when: every item of the three sources is a candidate, or noted as identical to the kit.

## 2. Filter

Judge each candidate against all four:

- **Portable**: it depends on none of this repo's stack, paths or tools; it would hold in a Unity repo and a web repo alike.
- **New**: nothing in the kit's `templates/`, `skills/`, `global.md` or `inbox/` already says it. One that contradicts a kit rule passes as `replaces <that rule>`.
- **Settled**: it has been in use, not just written; a candidate from the last few days is flagged as young, not dropped.
- **A rule, not a value**: one that is really this repo's value for something every repo decides becomes "the `project.md` template gains a field for this" instead.

Done when: every candidate passes or fails with a one-line reason.

## 3. Draft

Draft each passing candidate as a Proposal in the format of section 1 of `~/.claude/kit/skills/propose-to-kit/SKILL.md`, one file per candidate, in `kit-proposals/` under the session's scratchpad directory.

Report to the owner: one line per passing candidate (the draft's file and a sentence), then one line per failing candidate with its reason.

Done when: every passing candidate has a draft file.

## 4. Hand over

No passing candidate: stop after the report. Otherwise read `~/.claude/kit/skills/propose-to-kit/SKILL.md` and follow it with the draft files as its input.
