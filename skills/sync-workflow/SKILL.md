---
name: sync-workflow
description: Set up this repo's agent workflow from ~/.claude/kit, or sync its workflow.md with the kit's template.
disable-model-invocation: true
---

In a repo on the **template**, `docs/agents/workflow.md` is `~/.claude/kit/templates/workflow.md` byte for byte under one first line, `Template: <kit sha>`; everything particular to the repo lives in `docs/agents/project.md`.

**Target**: the path given as the argument, else `git rev-parse --show-toplevel` of the current directory. Not a git repo → stop and say so. Run everything from the target's root; paths below are relative to it.

## 1. Preflight

1. `git -C ~/.claude/kit status --porcelain` prints nothing. Otherwise stop: the kit has uncommitted work, so no sha describes what you would copy.
2. `git -C ~/.claude/kit branch --show-current` prints `main`. Otherwise stop: the installed kit must be on `main`, or a sha from another branch would not exist on other devices.
3. If `git -C ~/.claude/kit remote` prints a name, run `git -C ~/.claude/kit pull --ff-only`. On failure stop and show the owner the output.
4. Run `sh ~/.claude/kit/setup.sh --check`. If any line it prints mentions graphify, stop and ask the owner to run `sh ~/.claude/kit/setup.sh`: it installs global tools and writes `~/.claude/settings.json`, the owner's machine setup, so it stays theirs. Keep its `TODO:` lines for the report in section 8.
5. If `git -C ~/.claude/kit remote` prints a name and `git -C ~/.claude/kit rev-list --count @{u}..HEAD` prints more than `0`, stop: the kit has commits no other device has, so a sha written now would not exist there. Push the kit per `global.md` (`git -C ~/.claude/kit push`), then re-run.
6. The target: `git branch --show-current` must print `main`; otherwise stop and say which branch it is on — the sync's commit belongs on `main`. If `git remote` prints a name and `main` has an upstream (`git rev-parse --verify -q @{u}`), `git fetch --quiet`, then `git rev-list --left-right --count main...@{u}` (ahead, behind) and `git status --porcelain`:
   - behind only, and the status is empty → `git pull --ff-only`; on failure stop and show the owner the output;
   - ahead and behind, or behind with a non-empty status → one `AskUserQuestion`: deal with it first (stop here) / stop;
   - otherwise go on. Write nothing to any file before this step passes.
7. `KIT_SHA=$(git -C ~/.claude/kit log -1 --format=%H -- templates/workflow.md)`: the last kit commit that changed the template, the same on every device whose kit holds it, and unchanged by any other kit commit.
8. `ORIGIN=$(git remote get-url origin 2>/dev/null)`; empty means no origin. If set, `REMOTE` is its `owner/repo`: `sed -E 's#\.git$##; s#.*[:/]([^/:]+/[^/:]+)$#\1#'` of it (the same as `/send-request`); and if it does not contain `github.com`, keep a note for the report: origin is not on GitHub, so the Claude desktop app, seen from another device, will not give this repo its own group in the sidebar.
9. Pick the **mode**:
   - `docs/agents/workflow.md` exists → **update**: sections 3, 4, 6, 7, 8.
   - None of `CLAUDE.md`, `docs/`, `.scratch/`, `CONTEXT.md` exists → **new**: sections 2, 4, 5, 6, 7, 8.
   - Otherwise → **existing**: sections 2, 4, 5, 6, 7, 8.

Done when: the kit is clean, on `main`, current and not ahead; the target is on `main` and not behind; graphify is on PATH; you have `KIT_SHA`, a mode and `ORIGIN` (empty if none).

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

Ask all four in one `AskUserQuestion`, the detected or suggested answer first and marked recommended. If the owner picks a different stack in question 1, ask questions 2 and 3 again for that stack:

1. Stack — the detected one vs. the others.
2. Verification command — the suggestion (Unity: all three OS lines together) vs. "Other"; with no suggestion (stack `other`, or web without a `test` or `check` script), "None yet" vs. "Other".
3. Worktree — the stack's default vs. the other value.
4. What counts as production (commands only the owner runs: deploys, production writes, SSH) — "None yet" vs. "Other". If a push to `main` deploys automatically, ask for its Deploy paths (the paths whose change triggers it) in a follow-up `AskUserQuestion`, together with "Does it deploy to EC2?" (yes / no) and its Production URL: "Other" lists one or more URLs (the public addresses it serves, comma-separated), or "None".

**EC2**, on yes: read [`ec2.md`](ec2.md) beside this file and do its **Project values** here; its **Write** and **Commit and report** add to those sections.

Done when: you have a stack, a verification command or "none yet", `yes|no` for Worktree, and a production list (with the Deploy paths and Production URLs or "None", if a push deploys, and for EC2 the host, port and either the template's parameters or `DEPLOY_WF`) or "none yet".

## 3. Update mode

Classify as [`classify.md`](classify.md) says, with `W=$(mktemp -d)`. In sync with no `Template:` line: set it to `Template: $KIT_SHA`; section 8 commits it.

Tell the owner which case it is, then decide every item:

- Only behind items, or only ahead items, and no conflict: list them all, one `AskUserQuestion`: apply all / decide each / cancel.
- Otherwise: `AskUserQuestion` per item (up to four per call), showing the text:
  - behind: apply the template's version / skip.
  - ahead: revert to the template's version / keep as is.
  - conflict: both versions side by side; take the template's / keep as is.

This run never changes the kit. An ahead or conflict item worth carrying back is kept as is, and `/generate-kit-proposal` carries it back as a Proposal.

Apply:

1. Template-side items: edit the repo's `docs/agents/workflow.md`.
2. If step 1 changed anything, or the first line is not a `Template:` line, set the first line to `Template: $KIT_SHA` (insert it if missing). Otherwise leave the first line alone.

`project.md` is not compared with any template; section 4 reads its `Remote:` line and adds one if it is missing, and the steps below may add `## Sync` and a Production URL, or delete a `Request watch:` line.

**Sync**: if `docs/agents/project.md` has no `## Sync` heading, add the template's `## Sync` section, heading, text and the defaults `Push: ask` and `Pull: ff`, placed as in `templates/project.md`: right before `## Rules and lessons`, or at the end when there is none. Ask nothing; section 8 commits it. A `## Sync` already there is neither read nor changed, except for the line below.

**Request watch**: the Request watch is gone. If `## Sync` has a line starting `Request watch:`, delete that line, and delete from its text the sentence that starts `` `Request watch:` is the Device code`` (the older template's). Ask nothing; section 8 commits it.

**Production URL**: if an owner-boundary entry of `docs/agents/project.md` contains `deploys to` but not `Production URL` (which `no Production URL` contains too), ask one `AskUserQuestion` for that entry: "Other" lists one or more URLs, comma-separated, or "None". Append `, Production URL <url>, <url>` or `, no Production URL` to the entry's end; section 8 commits it, and the report shows the entry. An entry that already has either is not asked about.

Done when: every item has a decision, `docs/agents/project.md` has `## Sync` and no `Request watch:` line, every entry that deploys has a Production URL or `no Production URL`, and `tail -n +2 docs/agents/workflow.md | diff --strip-trailing-cr - ~/.claude/kit/templates/workflow.md` shows only the items kept as is — list those for the owner; they will be reported as ahead next time, and `/generate-kit-proposal` is how one reaches the kit.

## 4. Remote (every mode)

Decide the `Remote:` value; the first matching row wins:

- **update** and `docs/agents/project.md` has a `Remote:` line: `Remote: none (local only)` → nothing. Otherwise, if it is not `REMOTE` (no origin, or another one), a reminder for the report; a value without an owner matches on the part after the `/`. This section ends here.
- `REMOTE` is set → `Remote: $REMOTE`; ask nothing.
- Otherwise ask the question below.

The question is one `AskUserQuestion` of its own (a call holds at most four questions, and section 2 uses them). First `ACCOUNT=$(gh api user --jq .login 2>/dev/null)`; empty means no `gh`, or not logged in. The name is the directory name of the target root. Show the account (or "unknown") and the name:

- Create a private GitHub repo (recommended).
- Create a public GitHub repo.
- Local only → `Remote: none (local only)`; no later run asks again.

"Other" is a different name for a private repo.

On create:

- `Remote: $ACCOUNT/<name>`, or `Remote: <name>` when `ACCOUNT` is empty. It is written before the repo exists, so until the owner runs the command, update mode reports the mismatch.
- `ACCOUNT` empty → the report gets `TODO: install gh (https://cli.github.com) and run: gh auth login`.
- Warn the owner, never block — the first push uploads the whole history:
  - tracked files that may hold secrets: `git ls-files | grep -iE '\.env|secret|key|\.pem'`;
  - tracked files over 100 MB, which GitHub refuses without Git LFS: `git ls-files -z | xargs -0 du -m | awk '$1 > 100'`.
- Section 8 hands over `gh repo create <name> --private --source . --remote origin --push` (`--public` if chosen) in its own `bash` block. That command and the push belong to the owner.

Write: new and existing fill `{{REMOTE}}` in section 5. Update, when the line was missing: add it to `docs/agents/project.md` under a `## Remote` heading, placed as in `templates/project.md`.

Done when: the `Remote:` value is decided and written, or (update) the existing line is checked against `REMOTE`.

## 5. Write (new, existing)

Build each file's intended content:

| Repo file | Content |
| --- | --- |
| `docs/agents/workflow.md` | `Template: $KIT_SHA` line, then `templates/workflow.md` |
| `docs/agents/project.md` | `templates/project.md` with its four placeholder lines replaced: `{{VERIFY}}` → the command in backticks (Unity: a bullet per OS; "None yet": `- None yet.`), `{{WORKTREE}}` → `Worktree: yes` or `Worktree: no`, `{{PRODUCTION}}` → one bullet per command (a push that deploys reads "`git push` of `main` touching <Deploy paths> — deploys to production"; for EC2 the ending is instead "— deploys to EC2, host <host>, port <port>"; either ending then takes ", Production URL <url>, <url>" or, for "None", ", no Production URL"; and, when `ec2.md` writes the workflow, a bullet follows: "Repo secrets `SSH_KEY`, `VPS_HOST`, `VPS_USER`, `DEPLOY_PATH` — their values are set by the owner (`gh secret set`)"), or `- None yet.`, `{{REMOTE}}` → the `Remote:` line from section 4. Every other line, including the `- None yet.` sections and `## Sync` with its defaults `Push: ask` and `Pull: ff` (ask nothing about them), stays as the template has it for the owner to fill later. Web stack: `templates/dev-server.md` appended |
| `docs/agents/issue-tracker.md`, `domain.md` | the same-named template, verbatim |
| `CLAUDE.md` | each `## ` section of `templates/claude-section.md`: replaces the repo's section with the same heading, else is appended; every other line of the repo's `CLAUDE.md` stays |

EC2 with `DEPLOY_WF` empty: one more file, as `ec2.md`'s **Write** says.

Copy `workflow.md` with the shell so it stays byte-exact:

```bash
{ printf 'Template: %s\n' "$KIT_SHA"; cat ~/.claude/kit/templates/workflow.md; } > docs/agents/workflow.md
```

- **new**: write them all.
- **existing**: first show the owner, per file, `create`, `unchanged` or a `diff -u` of current vs. intended, flagging any target file that already has uncommitted changes (`git status --porcelain <path>`): section 8 commits them together with this run's. Add the graphify changes of section 6 that will apply as an item of their own. Then one `AskUserQuestion`: write all / decide per item / cancel. Write only what was approved. Declining the graphify item skips section 6. Cancel stops the run: write nothing, section 6 included.

Done when: every approved file is written, and `tail -n +2 docs/agents/workflow.md | diff --strip-trailing-cr - ~/.claude/kit/templates/workflow.md` prints nothing.

## 6. graphify (every mode; skipped if the owner declined it in section 5)

`graphify claude install` owns its `## graphify` section in `CLAUDE.md` and its hook in `.claude/settings.json`: leave both exactly as it wrote them, outside every comparison.

1. If `CLAUDE.md` has a `## graphify` line **and** `.claude/settings.json` mentions `graphify`, it is installed: skip to 3.
2. Otherwise run `graphify claude install`, then `graphify update .` for the first graph (AST only, no API cost). If it is installed but `graphify-out/graph.json` is missing (fresh clone; it is gitignored), run `graphify update .` alone.
   Right after `graphify claude install`: it writes graphify's absolute path into `.claude/settings.json` (e.g. `/Users/<name>/.local/bin/graphify hook-guard search`), which differs per device and would make each device's sync a different commit. Rewrite the home-directory prefix to `$HOME`, as the kit's own hooks are written:

   ```bash
   node -e '
   const fs = require("fs"), os = require("os");
   const f = ".claude/settings.json", s = JSON.parse(fs.readFileSync(f, "utf8"));
   const homes = [os.homedir(), os.homedir().replace(/\\/g, "/")];
   for (const e of Object.values(s.hooks ?? {}).flat()) for (const h of e.hooks ?? []) {
     const m = /^(.*?graphify(?:\.exe)?)((?: .*)?)$/.exec(h.command ?? "");
     const home = m && homes.find((p) => m[1].startsWith(p));
     if (home) h.command = `"$HOME${m[1].slice(home.length).replace(/\\/g, "/")}"${m[2]}`;
     if (h.command) h.command = h.command.replace(/graphify\.exe(?=["\x27 ]|$)/, "graphify"); // Git Bash finds graphify.exe for graphify; macOS has no .exe
   }
   fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");'
   ```

   A graphify command that still names an absolute path afterwards (graphify outside the home directory) is left as it is; note it in the report.
3. If `.gitignore` has no `graphify-out/` line, append one.

Done when: `CLAUDE.md` has `## graphify`, `.claude/settings.json` mentions `graphify`, and `.gitignore` has `graphify-out/`.

## 7. Line endings (every mode)

Without `.gitattributes`, line endings follow each device's `core.autocrlf`, and one Windows device set wrong commits CRLF: every line differs from the Mac's. Make sure `.gitattributes` holds these four lines, appending only the missing ones (create the file if needed; every other line stays):

```
* text=auto eol=lf
*.bat eol=crlf
*.cmd eol=crlf
*.ps1 eol=crlf
```

```bash
touch .gitattributes
for l in '* text=auto eol=lf' '*.bat eol=crlf' '*.cmd eol=crlf' '*.ps1 eol=crlf'; do
  grep -qxF -- "$l" .gitattributes || { [ -s .gitattributes ] && [ -n "$(tail -c 1 .gitattributes)" ] && echo >> .gitattributes; echo "$l" >> .gitattributes; }
done
```

`.gitattributes` goes into section 8's commit if this wrote to it.

Then find the tracked files the new attributes would renormalize — those committed with CRLF:

```bash
RENORM=$(git -c core.quotePath=false ls-files --eol | awk '($1 == "i/crlf" || $1 == "i/mixed") && substr($0, 1, index($0, "\t")) !~ /-text|binary/ { sub(/^[^\t]*\t/, ""); print }')
```

`core.quotePath=false` keeps non-ASCII paths unquoted, so the commands below can open them. Rows whose attr field says `-text` or `binary` are skipped: the owner already marked those files to keep their line endings.

If `RENORM` is empty, this section ends. Otherwise, after section 8's commit, check those files for uncommitted changes:

```bash
printf '%s\n' "$RENORM" | tr '\n' '\0' | xargs -0 git -c core.quotePath=false status --porcelain --
```

If it prints anything, do not renormalize: tell the owner which files have uncommitted changes, and that renormalizing waits until they are committed or reverted (a later `/sync-workflow` offers it again). This section ends.

Otherwise list the files and ask one `AskUserQuestion`: renormalize them in a commit of their own (recommended) / leave them. On yes — `git add --renormalize` plus `git commit <paths>` does not work (a path commit re-reads the working tree, and keeps CRLF because the committed blob has it), so strip the working copies instead:

```bash
printf '%s\n' "$RENORM" | tr '\n' '\0' | xargs -0 perl -pi -e 's/\r$//' &&
printf '%s\n' "$RENORM" | tr '\n' '\0' | xargs -0 git commit -m "Normalize line endings per .gitattributes" -- &&
printf '%s\n' "$RENORM" | while IFS= read -r f; do rm -f "$f"; git checkout -- "$f"; done
```

The three commands are chained with `&&`: if the strip or the commit fails, stop and show the owner the output; never re-check the files out then. The last line re-checks them out, so `*.bat`, `*.cmd` and `*.ps1` get CRLF back in the working tree. Report this commit with section 8's.

Done when: `.gitattributes` holds the four lines, and either `RENORM` was empty, a RENORM file had uncommitted changes (and the owner was told), the owner declined, or `git ls-files --eol` shows no `i/crlf` or `i/mixed` left.

## 8. Commit and report

- Commit in the target repo only the paths this run wrote, minus any the repo ignores (`git check-ignore -q <path>`; `git add` refuses them — name them in the report as local only): `git add <paths> && git commit <paths> -m "Set up agent workflow from kit <short sha>"` (new, existing) or `git add <paths> && git commit <paths> -m "Sync workflow.md with kit <short sha>"` (update; `, add Remote: to project.md` appended when section 4 wrote it, `, add Production URL to project.md` when section 3 did, `, add Sync to project.md` when section 3 added `## Sync`, `, remove Request watch from project.md` when section 3 deleted that line).
- Nothing written (in sync, `.gitattributes` complete, no `Remote:`, `## Sync` or Production URL added, no `Request watch:` deleted): no commit, and say so.
- After the commit (and section 7's, if any), push the target as `global.md`'s Push policy says: the sooner it is on the remote, the shorter the time another device can sync on top of a stale base.
- EC2: the **Commit and report** of `ec2.md`.
- List the pipeline's missing dependencies: relay verbatim the `TODO:` lines `setup.sh --check` printed in the preflight, and section 4's `gh` one; each carries its own fix. The owner runs them, not you: they install or remove global tools, the owner's machine setup.

Report: the mode, every file written, every commit (hash and message, up front), missing dependencies, and the remote: the `Remote:` value, any warning, mismatch or non-GitHub note, and the `gh repo create` command if one is handed over.
