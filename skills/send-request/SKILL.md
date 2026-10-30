---
name: send-request
description: File a Request — a GitHub issue in another repo asking it to change something, or a Proposal to the kit — after the owner reviews each one.
disable-model-invocation: true
---

A **Request** is a GitHub issue one repo files in another, asking it to change something; a **Proposal** is a Request to the kit (`~/.claude/kit`), brought back from the repo where it was tried first. The target repo's Triage decides what happens to it (the **Requests** section of `workflow.md`). This skill drafts, shows the owner, and sends only what the owner agreed to; it changes no file in either repo.

**Input**: the target (`owner/repo`, or `kit`) and what to ask, in the owner's words (in chat or as the argument), or draft files from `generate-kit-proposal` (target: the kit).

## 1. Repos

Owner/repo of a checkout: `git -C <dir> remote get-url origin | sed -E 's#\.git$##; s#.*[:/]([^/:]+/[^/:]+)$#\1#'`.

1. **Target**: the owner/repo given; `kit` means the kit's origin. No origin for the kit: stop and say so.
2. `gh repo view <target> --json nameWithOwner`. On failure (`gh` not installed, not logged in, offline, no access) stop and show the output; never fall back to another channel.
3. **From**: the source repo's owner/repo (no origin: the directory name of `git rev-parse --show-toplevel`) and `git rev-parse --short HEAD`.
4. Target and From are the same repo: stop and say so; work there directly.

## 2. Draft

One idea per Request, so each is applied or dropped on its own. A draft from `generate-kit-proposal` is already in this shape; check it against the format and fix what is off.

Title: one line saying what the target should change. Body:

```
From: <owner/repo> @ <short sha>

## What

<what the target should change>

## Why

<what the source repo ran into, and why it needs this from the target>

## Touches

<the target's files or areas it would change, as far as the source can tell>

## Tried

<kit only: the rule, skill or hook as it stands in the source repo, quoted verbatim with its path; how it was used there, since when, and how it went>
```

- `## Tried` only when the target is the kit; leave it out otherwise.
- Body in Traditional Chinese; the headings and `CONTEXT.md` terms stay in English. The title in the reply language.
- **Why** and **Tried** hold only what the source repo shows (commit messages, the text, `git log -S'<text>'` for since when) or what the owner said. Anything else is a `TODO(owner): <the question>` line, never a guess.
- **Touches**, for the kit: a lesson from a repo's `project.md` usually lands in `templates/workflow.md`, and one that is really a per-repo value in `templates/project.md` as a new field.
- **Duplicate**: `gh issue list -R <target> --state open --limit 200 --json number,title,body`. A draft that asks what one of them asks is marked `duplicate of #<n>`.

Done when: every idea is one draft with every field filled or marked `TODO(owner)`.

## 3. Review

Show the owner each draft in full — title and body exactly as they would be sent — then `AskUserQuestion` per draft (up to four per call):

- A plain draft: **send** / **edit** / **drop**.
- A draft with `TODO(owner)` lines: ask those questions in chat, as open questions; the answers replace them. Then as a plain draft.
- A duplicate: show the existing Request beside it; **comment its Why on #<n>** (prefixed by its `From:` line) / **drop**.

Edit: apply the owner's change, show it again, ask again. Nothing is sent without a send or comment answer to that exact text.

Done when: every draft is sent, commented, or dropped.

## 4. Send

Write each body to a file under the session's scratchpad directory, then:

- send: `gh issue create -R <target> --title '<title>' --body-file <file>`
- comment: `gh issue comment <n> -R <target> --body-file <file>`

Report each URL `gh` prints. A spec in the source repo that waits on it can now say `After: <target>#<n>`.
