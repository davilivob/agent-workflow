# Project

The values `workflow.md` refers to, and every rule that holds only in the kit.

## Verification

Verification command:

`sh tests/setup.test.sh && node tests/guard.test.cjs` — then, for a change to a skill or a template, run the skill by hand in a throwaway repo under the session's scratchpad and keep its output as evidence.

## Worktree

Worktree: yes

`~/.claude/kit` is the installed copy every session on this device reads, and it stays on `main`. Every change is made in a worktree: `git worktree add .claude/worktrees/<slug> -b <slug> main`. The one exception is the Inbox (below): Proposals and their drops are committed straight on `main`.

## Worktree setup and removal

- None yet.

## Always a design decision

- None yet.

## Pure content writes

- None yet.

## Other commit prefixes

- `[inbox] <source repo>: <one line per Proposal>` adds Proposals; `[inbox] drop <file>: <reason>` removes one the owner dropped.

## Older tickets

- None yet.

## Owner boundary

Production in this repo — these commands belong to the owner:

- `git push` (it publishes the template to every device).

## Rules and lessons

### Inbox

A session outside the kit changes the kit only by writing a Proposal into `inbox/`, through `/propose-to-kit` (or `/generate-kit-proposal`, which ends in it). The Guard denies any other edit to the kit from outside it.

- **Continue** (`/next`) in the kit lists a fifth group, **Inbox**: one line per file in `inbox/`, with its date and source repo (both in the file name) and one sentence from its `## What`.
- A Proposal is taken up by a grill: `/grill-with-docs inbox/<file>`. The commit that lands that grill (the spec commit, or Direct's `context:` commit) deletes the file and names it in its message.
- A Proposal the owner drops: delete the file, `[inbox] drop <file>: <reason>`.
- `inbox/` holds only Proposals nobody has taken up yet; nothing records a status.
- An `[inbox]` commit changes no behaviour of the kit, so it runs no verification.
