# Request watch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One device, hourly and unattended, triages new Requests in every repo whose `project.md` names it, applies the owner's as-written ones to local `main`, and notifies the owner about everything else.

**Architecture:** A deterministic `drift --watch` entry point in `hooks/drift.cjs` (reusing its repo scan, Retired repos, `inspect()` and `project.md` reader) prints a JSON candidate list. A new `disable-model-invocation` skill, `/request-watch`, run by a Desktop scheduled task, reads that list, triages, applies through the normal Apply path, records results in a per-device state file, and sends one push notification. `project.md` gains `Request watch:`; `/sync-workflow` writes it; `workflow.md` documents the watch.

**Tech Stack:** Node (no dependencies), git, `gh`, Markdown skills.

**Spec:** `.scratch/request-watch/spec.md`

## Global Constraints

- Work in the worktree `.claude/worktrees/request-watch` on branch `request-watch` (`Worktree: yes`). Every commit: `git commit <paths> -F -`, message prefixed `[request-watch]`, ending with the attribution lines the session gives.
- Verification command: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`; a change to a skill or template is also run by hand in a throwaway repo under the session's scratchpad, its output kept as evidence.
- `project.md` field, under `## Sync`: `Request watch: <Device code> | off`. No line, an unrecognized value, or an unreadable file: `off` (unwatched). The template's default is `studio`.
- The watch never pushes, never runs a Deploy check, and never comments on, labels, edits or closes an issue.
- Only a Request whose author is the owner's GitHub account (`gh api user`) can be applied: the repo is PUBLIC, this is a trust boundary.
- A Request is applied only when it is applied as written: `## What` gives the exact text or value, no alternatives side by side, no `TODO(owner)`, nothing `project.md` lists under Always a design decision. Any doubt: not applied ("寧可漏判也不誤判").
- A repo is skipped when its `main` is behind, diverged or Unknown, has uncommitted changes, or has a Claim; `main` only ahead is NOT a skip (owner, plan session).
- A skipped or Unknown repo is notified only when its reason differs from the one the state file recorded last run; a repo back to normal has its record cleared (owner, plan session).
- State file: `~/.claude/request-watch.json`, shape `{ "requests": { "<owner/repo>#<n>": { "result": "applied" | "notified", "at": "<ISO>", "commit"?: "<sha>" } }, "skips": { "<repo dir>": "<reason>" } }`. Written only by the skill; read by `drift --watch`.
- Notification: one push notification per run, under 200 characters; none when nothing is new.
- Kit skills and kit docs are written in English.

## Review Focus

1. **State file corrupt (half-written JSON)** → `drift --watch` must refuse (exit 2, stderr names the file), never treat it as empty and re-apply. Missing file = empty. Test in Task 1.
2. **State lost but the Request already applied** → an open issue whose `Fixes #<n>` commit is on local `main` is marked handled `applied`; `Fixes #120` must not mark #12. Test in Task 1.
3. **Main checkout not on its default branch** (a session left it on a feature branch) → skipped, since `merge --ff-only` there would move the wrong branch. Test in Task 1.
4. **Look-alike format** (`## Whatever` heading, `From:` not at line start, inside a code span) → not the `/file-request` format. Test in Task 1.
5. **A watch session applying to the kit while its cwd is elsewhere** → the Guard denies Edit/Write to the kit from a cwd outside it, and a Bash `cd` moves the cwd; the scheduled task's folder must be the kit and the skill must use absolute paths and `git -C`, never `cd`. Covered by the skill text and the README in Task 3, exercised in Task 3's manual run (apply to a kit-shaped repo).

---

### Task 1: `drift --watch`

**Files:**
- Modify: `hooks/drift.cjs` (header comment; extract the repo scan from `cli()`; add the watch entry)
- Modify: `tests/drift.test.cjs` (new section before `console.log('PASS')`)
- Modify: `README.md` (the `hooks/drift.cjs` bullet: one sentence on `--watch`)

**Interfaces:**
- Consumes: existing `inspect(dir)`, `branchDrift`, `find`, `pool`, `git`, `ENV`, `DEVICE`, `ROOTS`.
- Produces: `node ~/.claude/kit/hooks/drift.cjs --watch` → stdout one JSON object, exit 0; exit 2 with a one-line stderr message when there is no Device code, no roots, or the state file exists but is not valid JSON. JSON:

```
{ "device": "studio", "owner": "<login>" | null, "state": "<abs path of request-watch.json>",
  "repos": [ { "dir": "<abs>", "repo": "<owner/name>" | null, "branch": "main",
               "status": "ok" | "skipped" | "unknown", "reason": "<string, only when not ok>",
               "notify": <bool, only when not ok: reason !== state.skips[dir]>,
               "issues": [ { "number": 12, "title": "...", "url": "...", "author": "<login>",
                             "candidate": <bool>, "reason": "<only when not candidate>",
                             "handled": "applied" | "notified" | null } ] } ] }
```

  `issues` is `[]` unless `status` is `ok`. A missing root or unreadable directory is a repo entry with `repo: null`, `status: "unknown"`. Issue `reason` strings, exactly: `not filed by the owner`, `no From: line`, `no ## What`. `candidate` is true only with none of them.

- [ ] **Step 1: Write the failing tests**

Add a section `// The watch entry: drift --watch.` Use a fresh home `T/watch-home` (with `.claude/device` = `studio`, `.claude/drift-roots`), a fake `gh` in `T/fakebin` prepended to `PATH`, and a fixture `T/fakebin/gh.json` the fake reads:

- Fake `gh` is a node script (`#!/usr/bin/env node`, chmod 755) plus `gh.cmd` (`@node "%~dp0gh" %*`) for Windows. Fixture `{ user: 'me' | null, fail: [<repo basename>], issues: { <repo basename>: [ {number,title,url,author:{login},body} ] } }`. `gh api user ...` prints `user` (exit 1 when null); `gh issue list ...` prints the issues of `path.basename(process.cwd())` as JSON (exit 1 with a stderr line when listed in `fail`).
- Helper `watch()` → `{ code, json, err }` running `node DRIFT --watch` with that HOME/USERPROFILE and PATH.
- Helper `watched(name, value)` = `sync(clone(name, root), value)`-style: commits `docs/agents/project.md` with a `## Sync` holding `Request watch: <value>` (omit the line when `value` is null).
- `GOOD = 'From: x/y @ abc1234\n\n## What\n\nchange it\n'`.

Assertions:

```js
// Listing: only repos naming this device.
// repos: on (studio), other (mbp), off (off), none (no line), typo (Studio), retired (studio, under a ! line)
assert.deepStrictEqual(listed, [on].sort());
// Issues in `on`: 1 GOOD by me, 2 GOOD by stranger, 3 no From:, 4 no ## What,
// 5 '## Whatever' + 'see From: x' mid-line, 6 GOOD by me and already in the state file,
// 12 GOOD by me with a `Fixes #12` commit on local main, 120 GOOD by me (no commit of its own)
assert.deepStrictEqual(pick(1), { candidate: true, handled: null });
assert.strictEqual(issue(2).reason, 'not filed by the owner');
assert.strictEqual(issue(3).reason, 'no From: line');
assert.strictEqual(issue(4).reason, 'no ## What');
assert.ok(!issue(5).candidate);
assert.strictEqual(issue(6).handled, 'notified');     // state: { requests: { '<repo>#6': { result: 'notified' } } }
assert.strictEqual(issue(12).handled, 'applied');     // Fixes #12 on local main, not in state
assert.strictEqual(issue(120).handled, null);         // Fixes #12 does not mark #120
// main only ahead (the Fixes #12 commit is unpushed): ok, not skipped
assert.strictEqual(repo(on).status, 'ok');
// Skips, each its own repo, each with reason containing:
//   behind → 'behind', diverged → 'behind' and 'ahead', dirty → 'uncommitted changes',
//   worktree at .claude/worktrees/x → 'Claim', untracked .scratch/s/plan.md → 'Claim',
//   main checkout on branch feature → 'feature'
for (const [d, word] of skips) { assert.strictEqual(repo(d).status, 'skipped'); assert.ok(repo(d).reason.includes(word)); assert.deepStrictEqual(repo(d).issues, []); }
// notify: true while state.skips lacks the reason; false once state.skips[dir] === reason
// gh issue list fails for one repo → that repo 'unknown', the others unaffected
// gh api user fails (user: null) → every listed repo 'unknown', owner null
// state file 'not json{' → code 2, err mentions request-watch.json; no device file → code 2
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/drift.test.cjs`
Expected: FAIL in the new section (no `--watch` entry: the plain `drift` command runs instead, and `JSON.parse` of its output throws).

- [ ] **Step 3: Implement in `hooks/drift.cjs`**

- `function scan()` → `{ error?: string, repos: string[], missing: string[], unreadable: string[], found: number }`: the roots/Retired logic now in `cli()`, moved verbatim; `cli()` calls it and keeps its exact output (the existing CLI tests must pass unchanged).
- `function watchDevice(top)` → `string`: `/^Request watch:[ \t]*(\S+)[ \t]*\r?$/m` on `docs/agents/project.md`, else `'off'` (same file read as `policies`). A repo is listed when the value equals the Device code exactly.
- `function gh(cwd, args)` → `Promise<string>`: `execFile('gh', args, { cwd, env: ENV, timeout: 20000, encoding: 'utf8', windowsHide: true, shell: process.platform === 'win32' })`, rejecting with the first stderr line, like `git()`.
- `async function claims(dir)` → `string[]`: `Claim: worktree <name>` for each `git worktree list --porcelain` path under `.claude/worktrees/`; `Claim: .scratch/<slug>/plan.md not committed` for each `git status --porcelain -- .scratch` path matching `.scratch/*/plan.md`.
- `async function watch()` → exit code. Per watched repo (via `pool(…, 8, …)`): `inspect(dir)`; `unknown` on `s.unknown` or `s.noRemote`; otherwise reasons, joined with `; `, in this order: current branch is not `s.defaultBranch` (`main checkout is on <branch>`), default branch behind / diverged (`branchDrift` text; ahead alone adds nothing), claims, `uncommitted changes` (only when no Claim already explains it). Any reason → `skipped`. Else `gh issue list --state open --limit 200 --json number,title,url,author,body` → issues; failure → `unknown` with `gh issue list failed: <line>`. `repo` = origin URL through `/([^/:]+\/[^/:]+?)(?:\.git)?$/`. Format: `/^From: \S/m` and `/^## What[ \t]*\r?$/m`. Handled: state `requests["<repo>#<n>"].result`, else `applied` when `git log <defaultBranch> -E --grep="Fixes #<n>([^0-9]|$)" --format=%H` prints anything. Owner: `gh api user --jq .login` once; failure → every watched repo `unknown` with `gh api user failed: <line>`.
- Entry: `process.argv[2] === '--watch'` → `watch().then(code => process.exitCode = code, e => { console.error(...); process.exitCode = 2; })`. Update the header comment to three entry points; keep "The only write it makes to a repo is `git fetch`".

- [ ] **Step 4: Run to verify it passes**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`
Expected: each prints its pass line; `drift.test.cjs` ends `PASS`.

- [ ] **Step 5: Commit**

```bash
git commit hooks/drift.cjs tests/drift.test.cjs README.md -F - <<'EOF'
[request-watch] drift --watch lists the open Requests in every repo whose project.md names this device, with skip reasons and handled marks, as JSON
EOF
```

---

### Task 2: `Request watch:` in `project.md` and `/sync-workflow`

**Files:**
- Modify: `templates/project.md:49-54` (`## Sync`)
- Modify: `docs/agents/project.md:43-46` (`## Sync`)
- Modify: `skills/sync-workflow/SKILL.md` (section 3's `project.md` row; section 5's **Sync** paragraph and its Done-when; section 6's commit suffixes)

**Interfaces:**
- Produces: the line `Request watch: studio` in `## Sync`, read by Task 1's `watchDevice()`.

- [ ] **Step 1: Edit the files**

- `templates/project.md` `## Sync`: extend the explanatory sentence with: `Request watch:` is the Device code of the one device whose Request watch applies this repo's Requests, or `off`; no line means `off`. Add `Request watch: studio` after `Pull: ff`.
- `docs/agents/project.md`: add `Request watch: studio` after `Pull: ff`.
- `skills/sync-workflow/SKILL.md`:
  - Section 3, `project.md` row: the `## Sync` defaults read `Push: ask`, `Pull: ff` and `Request watch: studio`.
  - Section 5: after the **Sync** paragraph, a paragraph: if `## Sync` exists but has no line starting `Request watch:`, add `Request watch: studio` as its last value line; ask nothing; an existing `Request watch:` line is neither read nor changed. A `## Sync` added whole by the paragraph above already carries it. Done-when gains "and a `Request watch:` line".
  - Section 6: suffix `, add Request watch to project.md` when section 5 added only that line; the "Nothing written" list gains `Request watch:`.

- [ ] **Step 2: Run the verification command**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`
Expected: all pass.

- [ ] **Step 3: Run `/sync-workflow` by hand, twice, in the scratchpad**

Follow the edited skill text against a throwaway `git init` repo in the scratchpad: (a) **new** mode on an empty repo → `docs/agents/project.md` contains `Request watch: studio` under `## Sync`; (b) **update** mode after deleting that line → it is re-added, the commit message ends `, add Request watch to project.md`; (c) update mode with `Request watch: off` → unchanged. Save each run's `git show --stat HEAD` and `grep -n 'Request watch' docs/agents/project.md` as evidence in the task report.

- [ ] **Step 4: Commit**

```bash
git commit templates/project.md docs/agents/project.md skills/sync-workflow/SKILL.md -F - <<'EOF'
[request-watch] project.md gains Request watch: studio under ## Sync, in the template and the kit's own; /sync-workflow writes or adds it
EOF
```

---

### Task 3: The `/request-watch` skill

**Files:**
- Create: `skills/request-watch/SKILL.md`
- Modify: `README.md` (a `## Request watch` section)

**Interfaces:**
- Consumes: Task 1's `drift --watch` JSON and exit codes; Task 2's `Request watch:` line.
- Produces: writes `~/.claude/request-watch.json` (shape in Global Constraints).

- [ ] **Step 1: Write `skills/request-watch/SKILL.md`**

Frontmatter: `name: request-watch`, `disable-model-invocation: true`, a description saying it is the unattended Request watch run by a scheduled task. Body, in order, each a short section with a Done-when like the other kit skills:

1. **Unattended.** No `AskUserQuestion`, no waiting on the owner. Never push, never Deploy check, never `gh issue comment|close|edit` or labels. Never `cd`: absolute paths, `git -C <dir>`, Edit/Write with absolute paths (the Guard denies kit edits from a cwd outside the kit; the task runs in the kit).
2. **List.** `node ~/.claude/kit/hooks/drift.cjs --watch` (not `drift`: PATH may lack it). Exit 2: notify `request-watch: cannot run: <stderr line>` and stop.
3. **Triage** each issue with `candidate: true` and `handled: null` in an `ok` repo: read that repo's `docs/agents/workflow.md` and `project.md`; write the Triage block (what, why, touches, verdict + one-line reason) as `workflow.md` **Requests** says. Verdict Apply only when applied as written (Global Constraints wording, verbatim); else Grill or Drop.
4. **Apply** (verdict Apply): slug `request-<n>`; a branch or worktree of that name already existing → not applied, reason `slug taken`. `Worktree: yes`: `git -C <dir> worktree add <dir>/.claude/worktrees/request-<n> -b request-<n> <branch>`; `Worktree: no`: `git -C <dir> switch -c request-<n>`. Make the change; run the repo's whole Verification as `project.md` writes it; a command it cannot run (none written, OS-bound for another OS, needs the owner) → treat as failed. Pass: commit(s) `git -C <wt> commit <paths> -F -`, prefix `[request-<n>]`, the last with `Fixes #<n>` on its own line; `git -C <dir> merge --ff-only request-<n>`; then the workflow's wrap-up (`worktree remove`, `merge-base --is-ancestor`, `branch -D`). Fail: remove the worktree (or `switch <branch>`), `branch -D request-<n>`, nothing committed on `<branch>`; keep the last 20 lines of output for the report.
5. **Record** after each Request: `requests["<repo>#<n>"] = { result, at, commit? }` (`applied` only when merged); then `skips[dir] = reason` for every `skipped`/`unknown` repo and delete `skips[dir]` for every `ok` one. A small `node -e` read-modify-write of `~/.claude/request-watch.json` (missing → `{ requests: {}, skips: {} }`), written whole.
6. **Notify.** New = applied, not applied (verdict, slug taken, verification failed), non-candidate issues not yet handled (record them `notified` too), and repos with `notify: true`. Nothing new → no notification. Otherwise load `PushNotification` (`ToolSearch` `select:PushNotification`) and send one line under 200 chars leading with applied ones, e.g. `request-watch: applied kit#12 (a1b2c3d) — review and push main; 2 to triage; 1 repo skipped`. The final message lists every repo's results in full (Triage blocks, failure output, skip reasons) — the owner opens the run to read it — and says whether the notification was sent.

- [ ] **Step 2: README**

`## Request watch` section: what it does (one sentence, linking `CONTEXT.md`'s term); create it once per watching device in the Claude desktop app → Scheduled → new task: prompt `/request-watch`, hourly, working folder `~/.claude/kit`, permission mode **Auto** (the default mode pauses on approvals and nobody is there; observed in the plan session's probe), then **Run now** once while at the machine to approve any tools. A repo opts in with `Request watch: <Device code>` (or `off`) under `## Sync`.

- [ ] **Step 3: Run the skill by hand in the scratchpad**

`~/.claude/kit` is `main`, which lacks this branch's work until the merge: follow the worktree's `SKILL.md` by hand and run the worktree's `hooks/drift.cjs --watch` in place of the kit path. The skill reads the real `~/.claude/drift-roots` and state file, so back both up first and restore them afterwards, whatever happens. Point `drift-roots` at a scratchpad root, put a fake `gh` first on PATH (Task 1's fixture shape, `user` = the real `gh api user` login) and create four throwaway repos with bare remotes, each with `docs/agents/project.md` (`Request watch: studio`, `Worktree: yes`, a verification command): (a) owner Request with an exact `## What` and passing verification → applied, `Fixes #<n>` on local `main`, worktree and branch gone, nothing pushed; (b) owner Request, exact, verification `false` → not applied, `main` unchanged, worktree and branch gone; (c) owner Request with two options in `## What` → Grill, untouched; (d) stranger's Request → notified only. Run the procedure twice: the second run notifies nothing new. Restore the real files. Keep both runs' final messages and `git -C <repo> log --oneline -3` per repo as evidence.

- [ ] **Step 4: Run the verification command**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`
Expected: all pass (`setup.test.sh` links the new skill like the others).

- [ ] **Step 5: Commit**

```bash
git commit skills/request-watch/SKILL.md README.md -F - <<'EOF'
[request-watch] /request-watch: the unattended Request watch triages new Requests, applies the owner's as-written ones to local main and notifies the owner
EOF
```

---

### Task 4: `workflow.md` and the spec

**Files:**
- Modify: `templates/workflow.md` (**Continue**'s Requests group, line ~106; **Requests**, after the verdict list ~line 120)
- Modify: `.scratch/request-watch/spec.md` (`Status: done`)

- [ ] **Step 1: Edit `templates/workflow.md`**

- **Continue**, Requests group: an open Request with a `Fixes #<n>` commit on local `main` (`git log main -E --grep='Fixes #<n>([^0-9]|$)'`) is listed as `applied, awaiting push` and not offered for Triage.
- **Requests**: keep "change nothing until the owner picks" for a Request the owner picks; add a **Request watch** paragraph: the device named by `Request watch:` in `project.md` runs `/request-watch` hourly; it applies, as Apply above but unattended, only a Request the owner filed in the `/file-request` format and applied as written, stops at local `main` (no push, no Deploy check), skips a repo whose `main` is behind, diverged or Unknown, dirty or Claimed, and only notifies the owner about everything else, never touching the issue.

- [ ] **Step 2: Set the spec's `Status:` to `done`**

- [ ] **Step 3: Run the verification command**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git commit templates/workflow.md .scratch/request-watch/spec.md -F - <<'EOF'
[request-watch] workflow.md: Request watch applies the owner's as-written Requests unattended; Continue shows applied Requests awaiting push; spec done
EOF
```

Then `Merge: ask` per `workflow.md` step 4.
