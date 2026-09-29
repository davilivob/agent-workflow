---
name: propose-to-kit
description: Write Proposals for the kit into its Inbox, after the owner reviews each one.
disable-model-invocation: true
---

A **Proposal** is a change to the kit (`~/.claude/kit`) brought back from the repo where it was tried first. It is the input to a later kit grill, never a decision: this skill writes Proposals into the kit's `inbox/` and touches nothing else in the kit.

**Input**: draft files from `generate-kit-proposal`, or the owner's own words (one idea, in chat or as the argument).

## 1. Kit

1. `git -C ~/.claude/kit branch --show-current` prints `main`, else stop and tell the owner.
2. If `git -C ~/.claude/kit remote` prints a name, `git -C ~/.claude/kit pull --ff-only`; on failure stop and show the output. This comes first so the duplicate check below reads every Proposal already pushed from other devices.

## 2. Draft

Turn each idea into one Proposal: one idea per file, so each is adopted or dropped on its own. A draft from `generate-kit-proposal` is already in this shape; check it against the format and fix what is off.

Source names, from the source repo's `git remote get-url origin`: **owner/repo** is `sed -E 's#\.git$##; s#.*[:/]([^/:]+/[^/:]+)$#\1#'` of it, **repo** the part after the `/`. No remote: both are the directory name of `git rev-parse --show-toplevel`.

File name: `<YYYY-MM-DD>-<repo>-<slug>.md`, `<slug>` a few kebab-case words.

```
Source: <owner/repo> @ <short sha of the source repo's HEAD>
Date: <YYYY-MM-DD>
Kind: adds | replaces <the kit rule, quoted or named> | merges <the kit rule it sharpens>
Touches: <the kit files it would change>

## What

<the rule, skill or hook as it stands in the source repo, quoted verbatim, with its path>

## Why

<what it solved there, how it was used, and since when>

## Generality

<why it passes each test under "2. Filter" in ~/.claude/kit/skills/generate-kit-proposal/SKILL.md>
```

- Body in Traditional Chinese; the headings above and `CONTEXT.md` terms stay in English.
- **Why** holds only what the source repo shows (commit messages, the text, `git log -S'<text>'` for since when) or what the owner said. Anything else is a `TODO(owner): <the question>` line, never a guess.
- **Touches**: the kit file whose rule changes; a lesson from a repo's `project.md` usually lands in `templates/workflow.md`, and one that is really a per-repo value in `templates/project.md` as a new field.
- **Duplicate**: read every file in `~/.claude/kit/inbox/` (none yet is fine). A draft that says what one of them says is marked `duplicate of <file>`.

Done when: every idea is one draft with every field filled or marked `TODO(owner)`.

## 3. Review

Show the owner each draft in full, then `AskUserQuestion` per draft (up to four per call):

- A plain draft: **take** / **edit** / **drop**.
- A draft with `TODO(owner)` lines: ask those questions; the answers replace them. Then as a plain draft.
- A duplicate: show the existing Proposal beside it; **add its Why to that file** (under the existing `## Why`, prefixed by this Source line) / **drop**.

Edit: apply the owner's change, show it again, ask again.

Done when: every draft is taken, added to an existing Proposal, or dropped.

## 4. Write and commit

1. `mkdir -p ~/.claude/kit/inbox`, then write each taken draft there, and each addition into its file. A new file whose name is taken: append `-2`, `-3`.
2. Commit only those files, whatever else sits in the kit's working tree (another kit session may be working there):

   ```bash
   git -C ~/.claude/kit add inbox/<files> && git -C ~/.claude/kit commit inbox/<files> -F - <<'EOF'
   [inbox] <repo>: <n> Proposal(s)

   - <file>: <one line>
   EOF
   ```

Report the commit (hash and message) first. If the kit has a remote, hand over the push in its own `bash` block:

```bash
git -C ~/.claude/kit push
```
