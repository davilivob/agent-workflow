---
name: init-workflow
description: Set up this repo's agent workflow from ~/.claude/kit, or sync its workflow.md with the kit's template.
disable-model-invocation: true
---

In a repo on the **template**, `docs/agents/workflow.md` is `~/.claude/kit/templates/workflow.md` byte for byte under one first line, `Template: <kit sha>`; everything particular to the repo lives in `docs/agents/project.md`.

**Target**: the path given as the argument, else `git rev-parse --show-toplevel` of the current directory. Not a git repo → stop and say so. Run everything from the target's root; paths below are relative to it.

## 1. Preflight

1. `git -C ~/.claude/kit status --porcelain` prints nothing. Otherwise stop: the kit has uncommitted work, so no sha describes what you would copy.
2. If `git -C ~/.claude/kit remote` prints a name, run `git -C ~/.claude/kit pull --ff-only`. On failure stop and show the owner the output.
3. `command -v graphify` succeeds. Otherwise stop and ask the owner to run `sh ~/.claude/kit/setup.sh`.
4. `KIT_SHA=$(git -C ~/.claude/kit rev-parse HEAD)`.
5. Pick the **mode**:
   - `docs/agents/workflow.md` exists → **update**: sections 5, 4, 6.
   - None of `CLAUDE.md`, `docs/`, `.scratch/`, `CONTEXT.md` exists → **new**: sections 2, 3, 4, 6.
   - Otherwise → **existing**: sections 2, 3, 4, 6.

Done when: the kit is clean and current, graphify is on PATH, and you have a mode.

## 2. Project values (new, existing)

Detect the **stack** from the repo root; the first match wins:

| Stack | Signal | Suggested verification command | Worktree |
| --- | --- | --- | --- |
| Unity | `ProjectSettings/` and `Assets/` | Unity batch-mode EditMode tests, one line per OS (below) | `no` |
| Rust | `Cargo.toml` | `cargo test` | `yes` |
| web | `package.json` or `.claude/launch.json` | the package manager (`bun.lock`/`bun.lockb` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm) running the `test` script, else the `check` script, from `package.json` | `yes` |
| other | none of these | none — ask | `yes` |

Unity, with `<v>` from `m_EditorVersion:` in `ProjectSettings/ProjectVersion.txt`:

- macOS: `/Applications/Unity/Hub/Editor/<v>/Unity.app/Contents/MacOS/Unity -batchmode -nographics -projectPath . -runTests -testPlatform EditMode -testResults test-results.xml -logFile -`
- Windows: `"C:\Program Files\Unity\Hub\Editor\<v>\Editor\Unity.exe" -batchmode -nographics -projectPath . -runTests -testPlatform EditMode -testResults test-results.xml -logFile -`
- Linux: `~/Unity/Hub/Editor/<v>/Editor/Unity -batchmode -nographics -projectPath . -runTests -testPlatform EditMode -testResults test-results.xml -logFile -`

Ask all four in one `AskUserQuestion`, the detected or suggested answer first and marked recommended:

1. Stack — the detected one vs. the others.
2. Verification command — the suggestion (Unity: all three OS lines together) vs. "Other".
3. Worktree — the stack's default vs. the other value.
4. What counts as production (commands only the owner runs: deploys, production writes, SSH) — "None yet" vs. "Other".

Done when: you have a stack, a verification command, `yes|no` for Worktree, and a production list or "none yet".

## 3. Write (new, existing)

Build each file's intended content:

| Repo file | Content |
| --- | --- |
| `docs/agents/workflow.md` | `Template: $KIT_SHA` line, then `templates/workflow.md` |
| `docs/agents/project.md` | `templates/project.md` with its three placeholder lines replaced: `{{VERIFY}}` → the command in backticks (Unity: a bullet per OS), `{{WORKTREE}}` → `Worktree: yes` or `Worktree: no`, `{{PRODUCTION}}` → one bullet per command, or `- None yet.`. Every other line, including the `- None yet.` sections, stays as the template has it for the owner to fill later. Web stack: `templates/dev-server.md` appended |
| `docs/agents/issue-tracker.md`, `triage-labels.md`, `domain.md` | the same-named template, verbatim |
| `CLAUDE.md` | each `## ` section of `templates/claude-section.md`: replaces the repo's section with the same heading, else is appended; every other line of the repo's `CLAUDE.md` stays |

Copy `workflow.md` with the shell so it stays byte-exact:

```bash
{ printf 'Template: %s\n' "$KIT_SHA"; cat ~/.claude/kit/templates/workflow.md; } > docs/agents/workflow.md
```

- **new**: write them all.
- **existing**: first show the owner, per file, `create`, `unchanged` or a `diff -u` of current vs. intended, plus the graphify changes of section 4 that will apply. Then one `AskUserQuestion`: write all / decide per file / cancel. Write only what was approved.

Done when: every approved file is written, and `tail -n +2 docs/agents/workflow.md | diff - ~/.claude/kit/templates/workflow.md` prints nothing.

## 4. graphify (every mode)

`graphify claude install` owns its `## graphify` section in `CLAUDE.md` and its hook in `.claude/settings.json`: leave both exactly as it wrote them, outside every comparison.

1. If `CLAUDE.md` has a `## graphify` line **and** `.claude/settings.json` mentions `graphify`, it is installed: skip to 3.
2. Otherwise run `graphify claude install`, then `graphify update .` for the first graph (AST only, no API cost).
3. If `.gitignore` has no `graphify-out/` line, append one.

Done when: `CLAUDE.md` has `## graphify`, `.claude/settings.json` mentions `graphify`, and `.gitignore` has `graphify-out/`.

## 5. Update mode

Work in `W=$(mktemp -d)`:

```bash
git -C ~/.claude/kit show HEAD:templates/workflow.md > "$W/tmpl.md"
```

- First line is `Template: <40 hex>` → that is `BASE`; `tail -n +2 docs/agents/workflow.md > "$W/repo.md"`; `git -C ~/.claude/kit show $BASE:templates/workflow.md > "$W/base.md"`.
- No `Template:` line → there is no base; `cp docs/agents/workflow.md "$W/repo.md"`.

Classify — the first matching row wins:

| Case | Result | Items |
| --- | --- | --- |
| `repo.md` = `tmpl.md` | **in sync** | none; if the `Template:` line is missing or not `$KIT_SHA`, set it and commit (section 6) |
| no base | **unknown** | each hunk of `diff -u tmpl.md repo.md` is a **conflict** |
| `repo.md` = `base.md` | **behind** | each hunk of `diff -u base.md tmpl.md` |
| `tmpl.md` = `base.md` | **ahead** | each hunk of `diff -u base.md repo.md` |
| otherwise | **diverged** | hunks of `diff -u base.md repo.md` (ahead) and `diff -u base.md tmpl.md` (behind); two hunks whose `base.md` line ranges overlap are one **conflict** (`git merge-file -p --diff3 repo.md base.md tmpl.md` shows them as markers) |

Tell the owner which case it is, then decide every item:

- Only behind items, or only ahead items, and no conflict: list them all, one `AskUserQuestion`: apply all / decide each / cancel.
- Otherwise: `AskUserQuestion` per item (up to four per call), showing the text:
  - behind: apply the template's version / skip.
  - ahead: propose to the template / revert to the template's version / keep as is.
  - conflict: both versions side by side; take the repo's and propose it to the template / take the template's / keep as is.

Every item proposed to the template says whether it **replaces** an existing rule, **merges** with one (name it), or **adds** a new one, and gives the template's line count before → after (`wc -l`).

Apply, in this order:

1. Proposals: edit `~/.claude/kit/templates/workflow.md`, then `git -C ~/.claude/kit commit templates/workflow.md -m "<repo name>: <one line per rule>"`. `KIT_SHA` becomes the new `HEAD`.
2. Template-side items: edit the repo's `docs/agents/workflow.md`.
3. Set the first line to `Template: $KIT_SHA` (insert it if missing).

`project.md` is never compared.

Done when: every item has a decision, and `tail -n +2 docs/agents/workflow.md | diff - ~/.claude/kit/templates/workflow.md` shows only the items kept as is — list those for the owner; they will be reported as ahead next time.

## 6. Commit and report

- Commit in the target repo only the paths this run wrote: `git commit <paths> -m "Set up agent workflow from kit <short sha>"` (new, existing) or `-m "Sync workflow.md with kit <short sha>"` (update).
- Check the pipeline's dependencies and list the missing ones, with `sh ~/.claude/kit/setup.sh` as the fix; the owner installs them, not you. Present means: `~/.claude/skills/grill-with-docs` and `~/.claude/skills/to-spec` exist, and `~/.claude/plugins/installed_plugins.json` contains `"superpowers@`.
- If the kit got a commit and `git -C ~/.claude/kit remote` prints a name, hand over the push in its own `bash` block:

  ```bash
  git -C ~/.claude/kit push
  ```

Report: the mode, every file written, every commit (hash and message, up front), missing dependencies.
