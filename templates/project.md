# Project

The values `workflow.md` refers to, and every rule that holds only in this repo. `workflow.md` stays identical to the template; change this file instead.

## Verification

Verification command:

{{VERIFY}}

A command that runs on one operating system only ends in `(windows)` or `(macos)`: an OS-bound verification, handed over as `workflow.md` step 4 says.

## Worktree

{{WORKTREE}}

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

A push that deploys to a host also names the host and port, so projects sharing a host can see which ports are taken. A push that deploys ends with its Production URLs (`, Production URL <url>`, several comma-separated) or `, no Production URL`: a URL gets a Production check after each deploy.

{{PRODUCTION}}

## Remote

{{REMOTE}}

## Sync

`Push:` is `owner`, `ask` or `auto`; `Pull:` is `ff` or `rebase`. `global.md` says what each does; every device follows the same values. `Request watch:` is the Device code of the one device whose Request watch applies this repo's Requests, or `off`; no line means `off`.

Push: ask
Pull: ff
Request watch: studio

## Rules and lessons

- None yet.
