---
name: propose-to-kit
description: Write Proposals for the kit into its Inbox, after the owner reviews each one.
disable-model-invocation: true
---

A **Proposal** is a change to the kit (`~/.claude/kit`) brought back from the repo where it was tried first. It is the input to a later kit grill, never a decision: this skill writes Proposals into the kit's `inbox/` and touches nothing else in the kit. The Guard denies any other edit to the kit from outside it.

**Input**: draft files from `generate-kit-proposal`, or the owner's own words (one idea, in chat or as the argument).

## 1. Draft

Turn each idea into one Proposal: one idea per file, so each is adopted or dropped on its own. A draft from `generate-kit-proposal` is already in this shape; check it against the format and fix what is off.

File name: `inbox/<YYYY-MM-DD>-<source>-<slug>.md`, with `<source>` the source repo's name (the last part of `git remote get-url origin` without `.git`, else the directory name of `git rev-parse --show-toplevel`) and `<slug>` a few kebab-case words.

```
Source: <owner/repo from the remote, else the directory name> @ <short sha of the source repo's HEAD>
Date: <YYYY-MM-DD>
Kind: adds | replaces <the kit rule, quoted or named> | merges <the kit rule>
Touches: <the kit files it would change>

## What

<the rule, skill or hook as it stands in the source repo, quoted verbatim, with its path>

## Why

<what it solved there, how it was used, and for how long>

## Generality

<why it holds in every project: no dependence on the source repo's stack, paths or tools; not already in the kit or its inbox/; and, if it could be a value, which `project.md` field the template should gain instead>
```

Body in Traditional Chinese; the headings above and `CONTEXT.md` terms stay in English. Read the kit's `templates/`, `skills/`, `global.md` and `inbox/` before filling `Kind:` and `Generality`: a Proposal that duplicates one already in `inbox/` merges into that one's review instead of becoming a second file.

Done when: every idea is one draft that fills every field.

## 2. Review

Show the owner each draft in full, then `AskUserQuestion` per draft (up to four per call): **take** / **edit** / **drop**. Edit: apply the owner's change, show it again, ask again.

Done when: every draft is taken or dropped.

## 3. Write and commit

1. `git -C ~/.claude/kit branch --show-current` prints `main`, else stop and tell the owner.
2. If `git -C ~/.claude/kit remote` prints a name, `git -C ~/.claude/kit pull --ff-only`; on failure stop and show the output.
3. Write each taken draft to `~/.claude/kit/inbox/`. A file already there with the same name: pick another slug.
4. Commit only those files, whatever else sits in the kit's working tree (another kit session may be working there):

   ```bash
   git -C ~/.claude/kit add inbox/<files> && git -C ~/.claude/kit commit inbox/<files> -m "[inbox] <source>: <one line per Proposal>"
   ```

Report the commit (hash and message) first, then hand over the push in its own `bash` block:

```bash
git -C ~/.claude/kit push
```
