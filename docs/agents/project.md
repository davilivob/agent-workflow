# Project

The values `workflow.md` refers to, and every rule that holds only in the kit.

## Verification

Verification command:

`sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs` — then, for a change to a skill or a template, run the skill by hand in a throwaway repo under the session's scratchpad and keep its output as evidence.

## Worktree

Worktree: yes

`~/.claude/kit` is the installed copy every session on this device reads, and it stays on `main`. Every change is made in a worktree: `git worktree add .claude/worktrees/<slug> -b <slug> main`.

## Worktree setup and removal

- None yet.

## Always a design decision

- None yet.

## Pure content writes

- None yet.

## Other commit prefixes

- None yet.

## Older tickets

- None yet.

## Owner boundary

Production in this repo — these commands belong to the owner:

- None.

## Sync

Push: ask
Pull: ff
Request watch: studio

## Rules and lessons

- None yet.
