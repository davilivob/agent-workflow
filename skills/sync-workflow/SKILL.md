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
4. Run `sh ~/.claude/kit/setup.sh --check`. If any line it prints mentions graphify, stop and ask the owner to run `sh ~/.claude/kit/setup.sh`. Keep its `TODO:` lines for the report in section 6.
5. If `git -C ~/.claude/kit remote` prints a name and `git -C ~/.claude/kit rev-list --count @{u}..HEAD` prints more than `0`, stop: the kit has commits no other device has, so a sha written now would not exist there. Offer to push the kit per `global.md` (`git -C ~/.claude/kit push`), then re-run.
6. The target: `git branch --show-current` must print `main`; otherwise stop and say which branch it is on — the sync's commit belongs on `main`. If `git remote` prints a name and `main` has an upstream (`git rev-parse --verify -q @{u}`), `git fetch --quiet`, then `git rev-list --left-right --count main...@{u}` (ahead, behind) and `git status --porcelain`:
   - behind only, and the status is empty → `git pull --ff-only`; on failure stop and show the owner the output;
   - ahead and behind, or behind with a non-empty status → one `AskUserQuestion`: deal with it first (stop here) / stop;
   - otherwise go on. Write nothing to any file before this step passes.
7. `KIT_SHA=$(git -C ~/.claude/kit log -1 --format=%H -- templates/workflow.md)`: the last kit commit that changed the template, the same on every device whose kit holds it, and unchanged by any other kit commit.
8. `ORIGIN=$(git remote get-url origin 2>/dev/null)`; empty means no origin. If set, `REMOTE` is its `owner/repo`: `sed -E 's#\.git$##; s#.*[:/]([^/:]+/[^/:]+)$#\1#'` of it (the same as `/file-request`); and if it does not contain `github.com`, keep a note for the report: origin is not on GitHub, so the Claude desktop app, seen from another device, will not give this repo its own group in the sidebar.
9. Pick the **mode**:
   - `docs/agents/workflow.md` exists → **update**: sections 5, 7, 4, 8, 6.
   - None of `CLAUDE.md`, `docs/`, `.scratch/`, `CONTEXT.md` exists → **new**: sections 2, 7, 3, 4, 8, 6.
   - Otherwise → **existing**: sections 2, 7, 3, 4, 8, 6.

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
4. What counts as production (commands only the owner runs: deploys, production writes, SSH) — "None yet" vs. "Other". If a push to `main` deploys automatically, ask for its Deploy paths (the paths whose change triggers it) in a follow-up `AskUserQuestion`, together with "Does it deploy to EC2?" (yes / no).

**EC2**, on yes. `DEPLOY_WF` is `.github/workflows/deploy.yml` if it exists, else the first workflow that builds an image or runs compose (`grep -lE 'docker/build-push-action|docker compose|docker-compose' .github/workflows/* 2>/dev/null | head -n 1`); empty means none.

- `DEPLOY_WF` empty: one more `AskUserQuestion` for the template's parameters: each image's name and build context (default: the repo's directory name and `.`; "Other" lists several, one `<name> <context>` per line — names lowercase, as GHCR wants), the liveness port, and the host (a name the owner recognises it by, e.g. the EC2 instance's; not its address — that goes into the `VPS_HOST` secret). The workflow ships `compose.yaml` on every deploy, so the Deploy paths take `compose.yaml` and `.github/workflows/deploy.yml` too: add whichever is missing and say so. Section 3 writes the workflow.
- `DEPLOY_WF` set: never overwrite it. Ask only the liveness port and the host, for `project.md`, and keep `diff -u ~/.claude/kit/templates/deploy-ec2.yml "$DEPLOY_WF"` for the report: the owner decides whether to align it by hand. The repo's own growth (two images, a subdirectory) stays.

The template carries no `Template:` line, and no later run of this skill compares or rewrites the written workflow: it is the repo's from then on.

Done when: you have a stack, a verification command or "none yet", `yes|no` for Worktree, and a production list (with the Deploy paths, if a push deploys, and for EC2 the host, port and either the template's parameters or `DEPLOY_WF`) or "none yet".

## 3. Write (new, existing)

Build each file's intended content:

| Repo file | Content |
| --- | --- |
| `docs/agents/workflow.md` | `Template: $KIT_SHA` line, then `templates/workflow.md` |
| `docs/agents/project.md` | `templates/project.md` with its four placeholder lines replaced: `{{VERIFY}}` → the command in backticks (Unity: a bullet per OS; "None yet": `- None yet.`), `{{WORKTREE}}` → `Worktree: yes` or `Worktree: no`, `{{PRODUCTION}}` → one bullet per command (a push that deploys reads "`git push` of `main` touching <Deploy paths> — deploys to production"; for EC2 the ending is instead "— deploys to EC2, host <host>, port <port>", and, when section 3 writes the workflow, a bullet follows: "Repo secrets `SSH_KEY`, `VPS_HOST`, `VPS_USER`, `DEPLOY_PATH` — their values are set by the owner (`gh secret set`)"), or `- None yet.`, `{{REMOTE}}` → the `Remote:` line from section 7. Every other line, including the `- None yet.` sections, stays as the template has it for the owner to fill later. Web stack: `templates/dev-server.md` appended |
| `docs/agents/issue-tracker.md`, `domain.md` | the same-named template, verbatim |
| `.github/workflows/deploy.yml` | EC2 with `DEPLOY_WF` empty only: `templates/deploy-ec2.yml` with `{{DEPLOY_PATHS}}` → one `      - <path>` line per Deploy path, quoted when it starts with `!` or `*`; `{{VERIFY_STEPS}}` → steps indented like the others that set up the stack's toolchain on the runner, install, and run the verification command (e.g. `oven-sh/setup-bun@v2`, `bun install --frozen-lockfile`, the command), each with `working-directory:` when the project sits in a subdirectory, or, when there is none or it cannot run on a Linux runner (Unity, an OS-bound command), these placeholder lines and the comment above them removed; the `Build and push {{IMAGE}}` step (not the comment above it) repeated once per image, `{{IMAGE}}` → its name, `{{CONTEXT}}` → its context; `{{PORT}}` → the liveness port. No `{{UPPERCASE}}` placeholder may remain (`grep -E '\{\{[A-Z_]+\}\}'` prints nothing; `${{ ... }}` is GitHub's own) |
| `CLAUDE.md` | each `## ` section of `templates/claude-section.md`: replaces the repo's section with the same heading, else is appended; every other line of the repo's `CLAUDE.md` stays |

Copy `workflow.md` with the shell so it stays byte-exact:

```bash
{ printf 'Template: %s\n' "$KIT_SHA"; cat ~/.claude/kit/templates/workflow.md; } > docs/agents/workflow.md
```

- **new**: write them all.
- **existing**: first show the owner, per file, `create`, `unchanged` or a `diff -u` of current vs. intended, flagging any target file that already has uncommitted changes (`git status --porcelain <path>`): section 6 commits them together with this run's. Add the graphify changes of section 4 that will apply as an item of their own. Then one `AskUserQuestion`: write all / decide per item / cancel. Write only what was approved. Declining the graphify item skips section 4. Cancel stops the run: write nothing, section 4 included.

Done when: every approved file is written, and `tail -n +2 docs/agents/workflow.md | diff --strip-trailing-cr - ~/.claude/kit/templates/workflow.md` prints nothing.

## 4. graphify (every mode; skipped if the owner declined it in section 3)

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

## 5. Update mode

Work in `W=$(mktemp -d)`:

```bash
git -C ~/.claude/kit show HEAD:templates/workflow.md | tr -d '\r' > "$W/tmpl.md"
```

Every file in `$W` is stripped of `\r`: on Windows `core.autocrlf` makes the working tree CRLF while `git show` gives LF.

- First line is `Template: <40 hex>` → that is `BASE`, read CR-free: `BASE=$(head -n 1 docs/agents/workflow.md | tr -d '\r' | sed -n 's/^Template: \([0-9a-f]\{40\}\)$/\1/p')`; if `git -C ~/.claude/kit cat-file -e "$BASE^{commit}"` fails, stop: the commit is not in the local kit (another device made it and has not pushed), so tell the owner to push the kit from that device, then re-run; `tail -n +2 docs/agents/workflow.md | tr -d '\r' > "$W/repo.md"`; `git -C ~/.claude/kit show "${BASE}:templates/workflow.md" | tr -d '\r' > "$W/base.md"`.
- No `Template:` line → there is no base; `tr -d '\r' < docs/agents/workflow.md > "$W/repo.md"`.

Classify — the first matching row wins:

| Case | Result | Items |
| --- | --- | --- |
| `repo.md` = `tmpl.md` | **in sync** | none. A missing `Template:` line is set to `$KIT_SHA` (section 6 commits it); any other `Template:` line stays as it is, old format included — rewriting it would be a commit with no content, which two devices make differently |
| no base | **unknown** | each hunk of `diff -u tmpl.md repo.md` is a **conflict** |
| `repo.md` = `base.md` | **behind** | each hunk of `diff -u base.md tmpl.md` |
| `tmpl.md` = `base.md` | **ahead** | each hunk of `diff -u base.md repo.md` |
| otherwise | **diverged** | hunks of `diff -U0 base.md repo.md` (ahead) and `diff -U0 base.md tmpl.md` (behind); two hunks whose `base.md` line ranges overlap are one **conflict** (`-U0` keeps context lines out of the ranges; `git merge-file -p --diff3 repo.md base.md tmpl.md` shows them as markers) |

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

`project.md` is never compared; section 7 reads its `Remote:` line, and adds one if it is missing.

Done when: every item has a decision, and `tail -n +2 docs/agents/workflow.md | diff --strip-trailing-cr - ~/.claude/kit/templates/workflow.md` shows only the items kept as is — list those for the owner; they will be reported as ahead next time, and `/generate-kit-proposal` is how one reaches the kit.

## 6. Commit and report

- Commit in the target repo only the paths this run wrote, minus any the repo ignores (`git check-ignore -q <path>`; `git add` refuses them — name them in the report as local only): `git add <paths> && git commit <paths> -m "Set up agent workflow from kit <short sha>"` (new, existing) or `git add <paths> && git commit <paths> -m "Sync workflow.md with kit <short sha>"` (update; `, add Remote: to project.md` appended when section 7 wrote it).
- Nothing written (in sync, `.gitattributes` complete): no commit, and say so.
- After the commit (and section 8's, if any), offer to push the target per `global.md`: the sooner it is on the remote, the shorter the time another device can sync on top of a stale base.
- EC2 with the workflow written: hand over the four repo secrets, each command in its own `bash` block, with `<repo>` the `Remote:` value. The owner runs them and types each value; a secret's value never passes through you. `SSH_KEY` is multi-line, so it reads the key file the owner names:
  - `gh secret set SSH_KEY -R <repo> < ~/.ssh/<key file>`
  - `gh secret set VPS_HOST -R <repo>`
  - `gh secret set VPS_USER -R <repo>`
  - `gh secret set DEPLOY_PATH -R <repo>`

  Then say that the repo's `compose.yaml`, copied to the host on every deploy, must name its images `ghcr.io/<owner, lowercase>/<name>:latest`, and that the host needs the `DEPLOY_PATH` directory and its own `.env` there, both the owner's. With `DEPLOY_WF` set, give the kept diff instead, and no secret commands.
- List the pipeline's missing dependencies: relay verbatim the `TODO:` lines `setup.sh --check` printed in the preflight, and section 7's `gh` one; each carries its own fix. The owner runs them, not you.

Report: the mode, every file written, every commit (hash and message, up front), missing dependencies, and the remote: the `Remote:` value, any warning, mismatch or non-GitHub note, and the `gh repo create` command if one is handed over.

## 7. Remote (every mode)

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
- Section 6 hands over `gh repo create <name> --private --source . --remote origin --push` (`--public` if chosen) in its own `bash` block. That command and the push belong to the owner.

Write: new and existing fill `{{REMOTE}}` in section 3. Update, when the line was missing: add it to `docs/agents/project.md` under a `## Remote` heading, placed as in `templates/project.md`.

Done when: the `Remote:` value is decided and written, or (update) the existing line is checked against `REMOTE`.

## 8. Line endings (every mode)

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

`.gitattributes` goes into section 6's commit if this wrote to it.

Then find the tracked files the new attributes would renormalize — those committed with CRLF:

```bash
RENORM=$(git -c core.quotePath=false ls-files --eol | awk '($1 == "i/crlf" || $1 == "i/mixed") && substr($0, 1, index($0, "\t")) !~ /-text|binary/ { sub(/^[^\t]*\t/, ""); print }')
```

`core.quotePath=false` keeps non-ASCII paths unquoted, so the commands below can open them. Rows whose attr field says `-text` or `binary` are skipped: the owner already marked those files to keep their line endings.

If `RENORM` is empty, this section ends. Otherwise, after section 6's commit, check those files for uncommitted changes:

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

The three commands are chained with `&&`: if the strip or the commit fails, stop and show the owner the output; never re-check the files out then. The last line re-checks them out, so `*.bat`, `*.cmd` and `*.ps1` get CRLF back in the working tree. Report this commit with section 6's.

Done when: `.gitattributes` holds the four lines, and either `RENORM` was empty, a RENORM file had uncommitted changes (and the owner was told), the owner declined, or `git ls-files --eol` shows no `i/crlf` or `i/mixed` left.
