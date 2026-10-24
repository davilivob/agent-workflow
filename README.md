# kit

The owner's agent workflow, shared by every project and device:

- `templates/` — the workflow docs `/sync-workflow` writes into a repo. `templates/workflow.md` is the single source; each repo carries it verbatim under a `Template: <sha>` line.
- `skills/` — skills linked into `~/.claude/skills/` by `setup.sh`.
- `hooks/guard.cjs` — the Guard, a PreToolUse hook `setup.sh` installs in `~/.claude/settings.json`; it backs the push, commit and brainstorming rules, and keeps sessions outside the kit from editing it.
- `hooks/drift.cjs` — the Drift check. As a SessionStart hook `setup.sh` installs, it fetches and reports Drift or Unknown in the session's repo and in the kit, says when the repo's `workflow.md` is older than the kit's template, and after `/clear` sets the Session title to `[<Device code>] Cleared`; as `drift.cjs --prompt`, a UserPromptSubmit hook `setup.sh` also installs, it reminds the agent at every prompt to update the Session title when the Phase or topic changes; as the `drift` command (`bin/`, put on PATH by hand), it fetches and reports every repo under the roots listed in `~/.claude/drift-roots`, except Retired repos: a `!<path>` line there retires that directory and every repo under it, which `drift` only counts. It also lists each repo whose `workflow.md` is older than the kit's template, counted apart from Drift, so you can see where `/sync-workflow` is due. Run `drift` before leaving a device. `drift --watch` prints, as JSON, the Request watch's candidate list: each repo whose `project.md` says `Request watch: <this Device code>`, with its skip reason or its open issues marked candidate and handled.
- `setup.sh` — installs all of the above on a device, and sets `language` in `~/.claude/settings.json` (unless already set) so `global.md`'s reply-language rule sits in the system prompt and does not fade over a long session.
- `global.md` — rules for every session, imported from `~/.claude/CLAUDE.md`.

## New device

```bash
git clone <kit remote url> ~/.claude/kit && sh ~/.claude/kit/setup.sh
```

On Windows, run it in Git Bash. Re-run `setup.sh` after every `git pull`; it is safe to repeat. It prints a `TODO:` line for anything it cannot install itself.

## Request watch

The [Request watch](CONTEXT.md) is `/request-watch` run hourly with nobody at the machine: it triages new Requests in every repo that names this device, applies the owner's as-written ones to local `main` (never pushing), and sends one push notification about the rest.

Create it once on each watching device, in the Claude desktop app → Scheduled → new task:

- prompt `/request-watch`, hourly;
- working folder `~/.claude/kit` (the Guard denies edits to the kit from any other folder);
- permission mode **Auto**: the default mode pauses on approvals, and nobody is there to give them.

Then press **Run now** once while at the machine, to approve any tools it asks for.

A repo opts in with `Request watch: <Device code>` under `## Sync` in its `docs/agents/project.md` (`/sync-workflow` writes `studio`); `off`, or no line, opts it out.
