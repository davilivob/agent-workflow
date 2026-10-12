# kit

The owner's agent workflow, shared by every project and device:

- `templates/` — the workflow docs `/sync-workflow` writes into a repo. `templates/workflow.md` is the single source; each repo carries it verbatim under a `Template: <sha>` line.
- `skills/` — skills linked into `~/.claude/skills/` by `setup.sh`.
- `hooks/guard.cjs` — the Guard, a PreToolUse hook `setup.sh` installs in `~/.claude/settings.json`; it backs the push, commit and brainstorming rules, and keeps sessions outside the kit to its `inbox/`.
- `hooks/drift.cjs` — the Drift check. As a SessionStart hook `setup.sh` installs, it fetches and reports Drift or Unknown in the session's repo; as the `drift` command (`bin/`, put on PATH by hand), it fetches and reports every repo under the roots listed in `~/.claude/drift-roots`. Run `drift` before leaving a device.
- `setup.sh` — installs all of the above on a device, and sets `language` in `~/.claude/settings.json` (unless already set) so `global.md`'s reply-language rule sits in the system prompt and does not fade over a long session.
- `global.md` — rules for every session, imported from `~/.claude/CLAUDE.md`.

## New device

```bash
git clone <kit remote url> ~/.claude/kit && sh ~/.claude/kit/setup.sh
```

On Windows, run it in Git Bash. Re-run `setup.sh` after every `git pull`; it is safe to repeat. It prints a `TODO:` line for anything it cannot install itself.
