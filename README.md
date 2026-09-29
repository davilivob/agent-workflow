# kit

The owner's agent workflow, shared by every project and device:

- `templates/` — the workflow docs `/sync-workflow` writes into a repo. `templates/workflow.md` is the single source; each repo carries it verbatim under a `Template: <sha>` line.
- `skills/` — skills linked into `~/.claude/skills/` by `setup.sh`.
- `hooks/guard.cjs` — the Guard, a PreToolUse hook `setup.sh` installs in `~/.claude/settings.json`; it backs the push, commit and brainstorming rules, and keeps sessions outside the kit to its `inbox/`.
- `global.md` — rules for every session, imported from `~/.claude/CLAUDE.md`.

## New device

```bash
git clone <kit remote url> ~/.claude/kit && sh ~/.claude/kit/setup.sh
```

On Windows, run it in Git Bash. Re-run `setup.sh` after every `git pull`; it is safe to repeat. It prints a `TODO:` line for anything it cannot install itself.
