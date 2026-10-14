# cross-device-sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop cross-device divergence: agents offer pushes (the Guard prompt is consent), `/sync-workflow` stops creating commits and conflicts of its own, the Drift check also covers the kit and the project's template age, and changes needing another OS's verification are handed over via a pushed branch.

**Architecture:** One code change (`hooks/drift.cjs`, tested in `tests/drift.test.cjs`); everything else is rule text the agent follows: `global.md`, `templates/workflow.md`, `templates/project.md`, `skills/sync-workflow/SKILL.md`, plus the Guard's prompt string and a kit `.gitattributes`. Rule-text changes are verified by running them by hand in throwaway repos under the session scratchpad and keeping the output.

**Tech Stack:** Node (no dependencies) for the hook and its test; POSIX sh + git for the skill's shell steps; Markdown for rules.

**Spec:** `.scratch/cross-device-sync/spec.md` (read it; this plan argues from it).

## Global Constraints

- Work in a worktree: `git worktree add .claude/worktrees/cross-device-sync -b cross-device-sync main` (kit `project.md`: `Worktree: yes`). Never commit on the main checkout.
- `git commit` always takes paths: `git commit <paths> -F -` (or `-m`); never a pathless commit. Every commit message starts with `[cross-device-sync] ` and ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verification command (kit `project.md`): `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`, then, for a change to a skill or template, run it by hand in a throwaway repo under the session's scratchpad and keep the output as evidence.
- The Guard's behaviour does not change (spec: "Guard 不改"); only its ask-prompt string is reworded (Task 2).
- `global.md` stays the source of the Drift rules; the `ASK`/`FF`/`PUSH` strings in `hooks/drift.cjs` are copies: change both together.
- Drift session mode must stay inside its 25 s deadline: the kit's fetch runs in parallel with the session repo's, never after it.
- `.gitattributes` lines, exactly: `* text=auto eol=lf`, `*.bat eol=crlf`, `*.cmd eol=crlf`, `*.ps1 eol=crlf`.
- OS markers in `project.md`, exactly: `(windows)` and `(macos)`.
- Rule text is English; template headings and `CONTEXT.md` terms (Drift, Unknown, Template, Guard, OS-bound verification, Owner, Claim) are spelled as in the glossary.
- **Scratch runs never `git push`**: the Guard asks the owner at every push and denies `:` refspecs. Wherever a hand-run step below (or the rule being walked) pushes to a scratch bare remote, do the same fast-forward as `git -C <bare> fetch <clone> <branch>:<branch>`, then `git -C <clone> fetch` (and, for a first push, `git -C <clone> branch -u origin/<branch> <branch>`); write in the evidence which push it stands for.
- `Merge: ask` — at the end, ask the owner with `AskUserQuestion` whether to merge; merge only on yes.

## Decided in planning (technical; the owner may overrule)

- **Drift also reports the default branch ahead** when the session sits on another branch (a worktree): today only its "behind" is reported. Because sessions often open in a worktree, and the leftover `main` commits are exactly what story 5 wants pushed.
- **A branch both behind and ahead is ASK** (today it gets FF, which then fails). Because spec story 30 lists divergence among the cases that ask, and an offered push would be rejected.
- **The kit's Drift is a block of its own** headed `Drift check for the kit (<path>):`, with its own rule lines. Because the FF/ASK/push rule must apply to the right checkout.
- **No `~/.claude/kit` directory → the kit check and the Template check are skipped silently.** Because the hook itself runs from `~/.claude/kit`, so this happens only in tests; `setup.sh --check` is what reports an install.
- **"The session repo is the kit"** is decided by comparing `git rev-parse --git-common-dir` (realpath) of both, so a kit worktree counts as the kit too.
- **The Guard's push prompt is reworded** (behaviour unchanged): it still says "Approve only if you asked for this push", which contradicts the new rule. Spec misdescribed nothing; the spec says only that the Guard's behaviour stays.
- **`graphify claude install` writes a device-specific absolute path** (verified with graphify 0.9.61: `.claude/settings.json` gets `"command": "/Users/<name>/.local/bin/graphify hook-guard search"`). This is the other divergence source the spec asked the plan to check. `/sync-workflow` rewrites that home-directory prefix to `$HOME` right after installing (the same form as the kit's own hook commands, `node "$HOME/.claude/kit/hooks/guard.cjs"`), so the committed file is the same on every device. A path outside the home directory is left as is and noted in the report.
- **Renormalizing line endings cannot use `git add --renormalize` + `git commit <paths>`**: verified in a scratch repo, `git commit <paths>` re-reads the working tree and, because the HEAD blob has CRLF, keeps it ("nothing to commit"), and a pathless commit is forbidden. Instead: files whose index has CRLF (`git ls-files --eol`, first column `i/crlf` or `i/mixed`) get their working copy stripped of `\r` with `perl -pi -e 's/\r$//'`, then `git commit <those files>`, then `rm` + `git checkout --` them so `eol=crlf` files get CRLF back in the working tree. Verified to work.
- **The writing device removes its worktree and local branch after pushing an OS-bound branch.** Because the pushed branch is now the handover; a local copy would read as a stale Claim. It is deleted only once `git rev-parse <slug>` equals `git rev-parse origin/<slug>`, so nothing local is lost.
- **A failed OS-bound verification stops and shows the owner the output**, like `Merge: manual`. Because the spec does not say, and the verifying session must not change decisions.
- **The handover line format in the spec's `## Comments`**: `- Awaiting OS-bound verification (<os>): \`<command>\``; on a pass it becomes `- OS-bound verification (<os>) passed: \`<command>\``. Continue greps the first form.
- **Unity's per-OS verification lines from `/sync-workflow` get no OS marker.** Each is the same check for its own OS, run by whichever device the session is on, not a check only one OS can do; marking them would make every device report the other two as awaiting.
- **`/sync-workflow` "in sync" with no `Template:` line still writes the line** (and commits); with an old-format or any other sha it writes nothing. Because without a line the next run has no base and calls every difference a conflict.

## Review Focus

1. **A project session whose repo is a kit worktree** — the kit must not be checked twice (no "Drift check for the kit" block). Test added in Task 1.
2. **The kit reached through a symlink** (`~/.claude/kit` → elsewhere) — the check must follow it and print the real path. Test added in Task 1 (the test kit is a symlink/junction).
3. **A `Template:` sha that is an old-format kit `HEAD` whose template equals today's** — must stay silent; and a template change after it must be reported. Tests added in Task 1.
4. **Two devices running `/sync-workflow` against the same remote with an unchanged template** — neither may commit. Covered by Task 4's two-clone run.
5. **A target repo already holding `.gitattributes` with other lines, and one holding CRLF files** — only missing lines are appended; renormalization is asked about and lands in its own commit. Covered by Task 4's run.

## File Structure

| File | Change | Task |
| --- | --- | --- |
| `hooks/drift.cjs` | kit check, Template check, push rule, divergence asks, default branch ahead | 1 |
| `tests/drift.test.cjs` | new cases; `expect` takes several rules | 1 |
| `global.md` | push rule; Drift rules for the kit, ahead, divergence, Template | 2 |
| `hooks/guard.cjs` | push prompt string only | 2 |
| `README.md` | the Drift line mentions the kit and Template check | 2 |
| `templates/workflow.md` | Direct condition 3, step 4 OS-bound verification, Continue group and Claim, Owner boundary sentence | 3 |
| `templates/project.md` | the `(windows)` / `(macos)` note under Verification | 3 |
| `skills/sync-workflow/SKILL.md` | preflight, `KIT_SHA`, in-sync rule, graphify path, `.gitattributes`, push after commit | 4 |
| `.gitattributes` (new, kit root) | the four lines | 5 |
| `.scratch/cross-device-sync/spec.md` | `Status: done` | 5 |

### Overlaps

`cross-repo-requests` (low) is already on `main` (c492fea): this plan is written against it — `/propose-to-kit` is gone, and Continue already lists five groups ending in Requests. Nothing to resolve.

---

### Task 1: Drift check — the kit, the project's Template, and the push rule

**Files:**
- Modify: `hooks/drift.cjs` (constants at lines 15–22; `session()` lines 64–87; new helpers above it)
- Test: `tests/drift.test.cjs`

**Interfaces:**
- Consumes: existing `git(cwd, args, timeout)`, `inspect(dir)` (returns `{ dir, unknown, noRemote, dirty, branches: [{name, upstream, ahead, behind}], current, defaultBranch }`), `branchDrift(b)`, `emit(text)`.
- Produces: `report(s) -> { lines: string[], rules: string[] }`, `block(title, r) -> string`, `kitDir(top) -> Promise<string|null>`, `template(top, kit) -> Promise<string|null>`. Output text other tasks' rules refer to: the rule `PUSH` contains `offer to push`; the kit block title is `Drift check for the kit (<realpath>):`; Template lines start `workflow.md: `.

- [ ] **Step 1: Make `expect` accept several rules and add the push rule marker**

In `tests/drift.test.cjs` replace lines 54–59 with:

```js
const RULES = { ask: 'ask the owner with AskUserQuestion', ff: 'without asking', push: 'offer to push' };
function expect(text, has, rule, what) { // rule: 'ask', 'ff', 'push', a list of them, or false
  const want = [rule].flat().filter(Boolean);
  assert.ok(text, `${what}: no output`);
  for (const h of has) assert.ok(text.includes(h), `${what}: missing "${h}" in:\n${text}`);
  for (const [k, v] of Object.entries(RULES)) assert.strictEqual(text.includes(v), want.includes(k), `${what}: ${k} should be ${want.includes(k)}:\n${text}`);
}
```

And change the existing "ahead" case (line 72) to expect the push rule:

```js
expect(session(d), ['branch main: ahead of origin/main by 1'], 'push', 'ahead');
```

- [ ] **Step 2: Add the session-repo cases for divergence and the default branch ahead**

Insert right after the `wt-main` case (after current line 85):

```js
d = clone('diverged'); advance(d); commit(d, 'y.txt');
expect(session(d), ['branch main: behind origin/main by 1, ahead of origin/main by 1'], 'ask', 'diverged: asks, never offers a push');
d = clone('wt-ahead'); commit(d, 'z.txt');
const wtAhead = path.join(d, '.claude', 'worktrees', 'x');
sh(d, 'worktree', 'add', '-q', wtAhead, '-b', 'x');
expect(session(wtAhead), ['branch x: no upstream', 'branch main: ahead of origin/main by 1'], 'push', 'worktree, main ahead');
d = clone('behind-and-ahead'); sh(d, 'checkout', '-q', '-b', 'dev'); sh(d, 'push', '-q', '-u', 'origin', 'dev'); commit(d, 'w.txt');
advance(d);
expect(session(d), ['branch dev: ahead of origin/dev by 1', 'branch main: behind origin/main by 1'], ['ff', 'push'], 'one branch behind, another ahead');
```

- [ ] **Step 3: Add the kit and Template cases**

Insert at the end of the SessionStart section, right before the `// The drift command.` comment (current line 96). They create `~/.claude/kit` (as a symlink, like a device whose kit lives elsewhere), so every session check after them also checks the kit; the kit is left in sync at the end.

```js
// The kit, reached through ~/.claude/kit as on a device (a symlink; a junction on Windows). Its template is templates/workflow.md.
const kit = clone('kit-real');
const KIT_LINK = path.join(HOME, '.claude', 'kit');
const head = (dir) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, env, encoding: 'utf8' }).trim();
function tmpl(text) {
  fs.mkdirSync(path.join(kit, 'templates'), { recursive: true });
  fs.writeFileSync(path.join(kit, 'templates', 'workflow.md'), text);
  sh(kit, 'add', 'templates'); sh(kit, 'commit', '-q', '-m', 'tmpl'); sh(kit, 'push', '-q');
}
tmpl('v1\n');
const tmplSha = head(kit);
fs.symlinkSync(kit, KIT_LINK, 'junction');
// A project on the template: docs/agents/workflow.md under `Template: <sha>`, committed and pushed.
function project(name, sha) {
  const p = clone(name);
  fs.mkdirSync(path.join(p, 'docs', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(p, 'docs', 'agents', 'workflow.md'), `Template: ${sha}\r\nbody\n`); // CRLF as on Windows
  sh(p, 'add', 'docs'); sh(p, 'commit', '-q', '-m', 'wf'); sh(p, 'push', '-q');
  return p;
}
const p = project('on-template', tmplSha);
assert.strictEqual(session(p), null, 'kit and project in sync, template current: silent');

advance(kit);
expect(session(p), ['Drift check for the kit (', 'branch main: behind origin/main by 1'], 'ff', 'kit behind, clean');
assert.ok(!session(p).includes(`Drift check for ${p}`), 'the project itself has nothing to say');
fs.writeFileSync(path.join(kit, 'scratch.txt'), 'x');
expect(session(p), ['Drift check for the kit (', 'uncommitted changes'], 'ask', 'kit behind, dirty');
fs.rmSync(path.join(kit, 'scratch.txt')); sh(kit, 'pull', '-q', '--ff-only');
commit(kit, 'k.txt');
expect(session(p), [`Drift check for the kit (${kit})`, 'branch main: ahead of origin/main by 1'], 'push', 'kit ahead: real path shown, push offered');
const kitUrl = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: kit, encoding: 'utf8' }).trim();
sh(kit, 'remote', 'set-url', 'origin', path.join(T, 'gone.git'));
expect(session(p), ['Drift check for the kit (', 'Unknown: fetch failed'], 'ask', 'kit unreachable');
sh(kit, 'remote', 'set-url', 'origin', kitUrl);
let k = session(kit);
assert.ok(!k.includes('Drift check for the kit'), `session in the kit: checked once:\n${k}`);
expect(k, [`Drift check for ${kit}`, 'branch main: ahead of origin/main by 1'], 'push', 'session in the kit');
const kitWt = path.join(kit, '.claude', 'worktrees', 'kw');
sh(kit, 'worktree', 'add', '-q', kitWt, '-b', 'kw');
k = session(kitWt);
assert.ok(!k.includes('Drift check for the kit'), `session in a kit worktree: checked once:\n${k}`);
sh(kit, 'worktree', 'remove', kitWt); sh(kit, 'branch', '-q', '-D', 'kw');
sh(kit, 'push', '-q');

// The project's Template, compared by content: an old-format sha (the kit's HEAD then) passes while the template is unchanged.
const oldFormat = project('old-format', head(kit)); // k.txt changed after the template: HEAD is not the template's commit
assert.strictEqual(session(oldFormat), null, 'old-format sha, same template: silent');
tmpl('v2\n');
expect(session(oldFormat), [`Drift check for ${oldFormat}`, 'workflow.md: older than the kit\'s template', '/sync-workflow'], false, 'template changed since');
expect(session(p), ['workflow.md: older than the kit\'s template'], false, 'new-format sha, template changed since');
const stranger = project('stranger', 'f'.repeat(40));
expect(session(stranger), ['workflow.md: Template fffffff is not in the local kit'], false, 'sha unknown to this kit');
```

- [ ] **Step 4: Run the test to see it fail**

Run: `node tests/drift.test.cjs`
Expected: FAIL with an AssertionError on the `'ahead'` case: `push should be true`.

- [ ] **Step 5: Add the push rule and the kit path to `hooks/drift.cjs`**

Replace lines 15–22 (from `const ROOTS` through the `FF` constant) with:

```js
const ROOTS = path.join(os.homedir(), '.claude', 'drift-roots');
const DEVICE = path.join(os.homedir(), '.claude', 'device');
const KIT = path.join(os.homedir(), '.claude', 'kit');
// Copies of the Drift rules in global.md, which stays the source: change both together.
const ASK =
  'Per global.md: before changing any file, ask the owner with AskUserQuestion: `pull --ff-only`, leave it, or stop.';
const FF =
  'Per global.md: fast-forward each behind branch with `pull --ff-only` without asking, in its own checkout if that one is clean, ' +
  'and report it in one line; a dirty checkout: ask first. If a fast-forward fails, stop and tell the owner.';
const PUSH =
  'Per global.md: offer to push each ahead branch, in its own checkout; the Guard asks the owner. A rejected push: stop and tell the owner.';
```

- [ ] **Step 6: Replace `session()` with the per-repo report, the kit check and the Template check**

Replace the whole of current lines 64–87 (the comment above `session()` through its closing `}`) with:

```js
// One repo's Drift. Current branch: behind, ahead, no upstream; default branch: behind, ahead.
// Unknown, a branch both behind and ahead, or behind with uncommitted changes asks the owner; behind fast-forwards; ahead offers a push.
function report(s) {
  const lines = [];
  let behind = false, ahead = false, diverged = false;
  if (s.unknown) lines.push(`Unknown: ${s.unknown}`);
  if (s.noRemote) lines.push('no remote');
  else for (const b of s.branches) {
    const d = b.name === s.current ? branchDrift(b) : b.name === s.defaultBranch && b.upstream ? branchDrift(b) : '';
    if (!d) continue;
    lines.push(`branch ${b.name}: ${d}`);
    if (b.behind && b.ahead) diverged = true;
    else if (b.behind) behind = true;
    else if (b.ahead) ahead = true;
  }
  if (s.dirty) lines.push('uncommitted changes');
  const rules = s.unknown || diverged || (behind && s.dirty) ? [ASK] : [behind && FF, ahead && PUSH].filter(Boolean);
  return { lines, rules };
}

const block = (title, r) => [`${title}:`, ...r.lines.map((l) => `- ${l}`), ...r.rules].join('\n');

// The kit's real path, or null when there is none (only in tests: this hook runs from it) or the session's repo is the kit.
async function kitDir(top) {
  let kit;
  try { kit = fs.realpathSync(KIT); } catch { return null; }
  const common = async (d) => fs.realpathSync(path.resolve(d, (await git(d, ['rev-parse', '--git-common-dir'])).trim()));
  const same = await Promise.all([common(kit), common(top)]).then(([a, b]) => a === b, () => false);
  return same ? null : kit;
}

// The repo's workflow.md against the local kit, by content: an old-format sha (the kit's HEAD then) with today's template passes.
async function template(top, kit) {
  let first;
  try { first = fs.readFileSync(path.join(top, 'docs', 'agents', 'workflow.md'), 'utf8').split('\n')[0].trim(); } catch { return null; }
  const sha = /^Template: ([0-9a-f]{40})$/.exec(first)?.[1];
  if (!sha) return null;
  if (!(await git(kit, ['cat-file', '-e', `${sha}^{commit}`]).then(() => true, () => false)))
    return `workflow.md: Template ${sha.slice(0, 7)} is not in the local kit, which may be behind`;
  const changed = await git(kit, ['diff', '--quiet', sha, 'HEAD', '--', 'templates/workflow.md']).then(() => false, () => true);
  return changed ? "workflow.md: older than the kit's template; suggest /sync-workflow, do not run it" : null;
}

async function session() {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch {}
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(); // cwd first, as in the Guard: it names the worktree
  let top;
  try { top = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim(); } catch { return null; } // not a repo: nothing to say
  const kit = await kitDir(top);
  // In parallel: the kit's fetch shares the session repo's deadline.
  const [s, k, t] = await Promise.all([inspect(top), kit && inspect(kit), kit && template(top, kit)]);
  const blocks = [];
  const r = report(s);
  if (t) r.lines.push(t);
  if (r.lines.length) blocks.push(block(`Drift check for ${top}`, r));
  const kr = k && report(k);
  if (kr?.lines.length) blocks.push(block(`Drift check for the kit (${kit})`, kr));
  return blocks.length ? blocks.join('\n') : null;
}
```

Also update the header comment, line 3–4, to:

```js
//   --session  SessionStart hook: reads hook JSON on stdin, checks the session's repo and the kit (~/.claude/kit),
//              and whether the repo's workflow.md is older than the kit's template; prints context for the agent,
//              always headed by this device's Device code (from ~/.claude/device) for the Session title.
```

- [ ] **Step 7: Run the drift test**

Run: `node tests/drift.test.cjs`
Expected: `PASS`. If the `wt-main` case now fails, check it: it has `main` behind, not ahead, and must still be `'ff'`.

- [ ] **Step 8: Run the full verification**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`
Expected: each prints its pass line, exit 0.

- [ ] **Step 9: Commit**

```bash
git commit hooks/drift.cjs tests/drift.test.cjs -F - <<'EOF'
[cross-device-sync] Drift check: the kit, the project's Template, and an offered push for ahead

The session check also fetches ~/.claude/kit in parallel and reports it in a block of its own,
and says when the repo's workflow.md is older than the kit's template (by content, so old-format
Template lines pass). Ahead now offers a push; a branch both behind and ahead asks; the default
branch is reported when ahead too, for sessions that open in a worktree.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Push rule text — `global.md`, the Guard's prompt, README

**Files:**
- Modify: `global.md:9-13`
- Modify: `hooks/guard.cjs:13`
- Modify: `README.md:8`

**Interfaces:**
- Consumes: Task 1's output words: the rule `offer to push`, the kit block `Drift check for the kit`, Template lines `workflow.md: ...`.
- Produces: the push rule Tasks 3 and 4 cite as "`global.md`": agents offer a push of `main` when reporting work done and when Drift reports ahead; branches are never pushed except an OS-bound verification handover, first pushed with `git push -u origin <slug>`.

- [ ] **Step 1: Replace the push rule in `global.md`**

Replace line 9 (the bullet starting `- Push only when the owner asks`) with:

```markdown
- Push on your own initiative; the Guard asks the owner at every push, and that prompt is their consent. Offer a push when you report work as done and `main` has commits its upstream lacks, and when the session opens with a Drift report of a branch ahead. Push only a fast-forward of the current branch to its upstream, and only `main`: never another branch, except one handed over for OS-bound verification (`workflow.md`, step 4), whose first push is `git push -u origin <slug>`. Force, delete, tag, mirror and refspec (`+` or `:`) pushes stay the owner's: hand them over. A rejected push: stop and tell the owner; never pull, merge or rebase to get it through. A repo whose `project.md` reserves `git push` keeps it all the owner's.
```

- [ ] **Step 2: Extend the Drift rules in `global.md`**

Replace lines 10–11 (the two bullets starting `- When the session opens with a Drift report` and `- When it reports Unknown`) with:

```markdown
- When the session opens with a Drift report of `main` or the session's branch behind its remote and that branch's checkout is clean, fast-forward it with `pull --ff-only` without asking and report it in one line. A behind `main` checked out in another checkout is fast-forwarded there: `git -C <that checkout> pull --ff-only`; checked out nowhere, `git fetch origin main:main`. Any other branch behind: report it only. The report covers the kit, `~/.claude/kit`, in a block of its own, under the same rules: `git -C ~/.claude/kit pull --ff-only`.
- When it reports Unknown, a branch both behind and ahead, or `main` or the session's branch behind with uncommitted changes in its checkout, ask the owner with `AskUserQuestion` before changing any file: `pull --ff-only`, leave it, or stop.
- When it reports a branch ahead, offer to push it (above); the kit's from its checkout: `git -C ~/.claude/kit push`.
- When it reports the repo's `workflow.md` older than the kit's template, or its `Template:` missing from the local kit, pass that on in one line and suggest `/sync-workflow`; never run it yourself.
```

- [ ] **Step 3: Reword the Guard's push prompt**

In `hooks/guard.cjs` replace line 13:

```js
const PUSH = 'Guard: every push waits for the owner here (global.md). Approve to push; deny to keep the commits on this device.';
```

- [ ] **Step 4: Update the README's Drift line**

In `README.md` line 8, replace `it fetches and reports Drift or Unknown in the session's repo;` with:

```markdown
it fetches and reports Drift or Unknown in the session's repo and in the kit, and says when the repo's `workflow.md` is older than the kit's template;
```

- [ ] **Step 5: Run the verification**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`
Expected: all pass (the Guard's behaviour did not change; only its string).

- [ ] **Step 6: Walk the push rule by hand and keep the output**

In the session scratchpad, `S=<scratchpad>/push-rule`: make a bare remote and a clone, add one commit on `main`, then run the Guard on a plain push and on a force push the way `tests/guard.test.cjs` does, and save both results:

```bash
S=<scratchpad>/push-rule; rm -rf "$S"; mkdir -p "$S" && cd "$S"
git init -q --bare -b main r.git && git clone -q r.git c && cd c && git commit -q --allow-empty -m a && git push -q -u origin main
git commit -q --allow-empty -m b
for c in 'git push' 'git push --force' 'git push -u origin cross-device-sync'; do
  printf '{"tool_name":"Bash","tool_input":{"command":"%s"},"cwd":"%s"}' "$c" "$PWD" | node <worktree>/hooks/guard.cjs; echo
done | tee "$S/guard.txt"
```

Expected in `guard.txt`: `"permissionDecision":"ask"` with the new string for `git push` and for `git push -u origin cross-device-sync`, `"deny"` for `--force`. Keep the file for the final report.

- [ ] **Step 7: Commit**

```bash
git commit global.md hooks/guard.cjs README.md -F - <<'EOF'
[cross-device-sync] Push rule: the agent offers the push, the Guard's prompt is the owner's consent

global.md: offer a push of main when reporting work done and when Drift reports ahead; branches only
for an OS-bound verification handover. Drift rules cover the kit, divergence asks, and a stale
Template is passed on with /sync-workflow suggested. The Guard's prompt is reworded to match;
its behaviour is unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: OS-bound verification — `templates/workflow.md` and `templates/project.md`

**Files:**
- Modify: `templates/workflow.md` (Direct condition 3; step 4 bullets; "Continue" section; "Owner boundary" first sentence)
- Modify: `templates/project.md:7-9`

**Interfaces:**
- Consumes: Task 2's push rule (`git push -u origin <slug>` for the handover; offer to push `main`).
- Produces: the handover format Continue reads: a branch `origin/<slug>` whose `.scratch/<slug>/spec.md` has lines `- Awaiting OS-bound verification (<os>): \`<command>\`` under `## Comments`.

- [ ] **Step 1: Direct excludes OS-bound changes**

In `templates/workflow.md`, replace the Direct condition

```markdown
3. It needs no plan, and the whole implementation fits in the current session.
```

with

```markdown
3. It needs no plan, and the whole implementation, verification included, fits in the current session: a change with an OS-bound verification this device cannot run is never Direct.
```

- [ ] **Step 2: Add the OS-bound verification bullet to step 4**

In step 4, insert this bullet immediately before the bullet `- A merge hits a conflict: ...`:

```markdown
   - **OS-bound verification**: `project.md` marks a verification command that runs on one operating system only with `(windows)` or `(macos)` after it. When this device cannot run one: run every other verification; at the bottom of the spec, under `## Comments`, add one line per command it could not run, ``- Awaiting OS-bound verification (<os>): `<command>` ``, and commit it on the branch; push the branch, `git push -u origin <slug>` (`global.md`); do not merge, whatever `Merge:` says. Then remove the worktree, and once `git rev-parse <slug>` equals `git rev-parse origin/<slug>`, delete the local branch with `git branch -D <slug>`: the pushed branch is the handover now. A session on that OS takes it from Continue: `git worktree add .claude/worktrees/<slug> <slug>` (with `Worktree: no`, `git switch <slug>`), runs the awaiting commands and, on a pass, replaces each line with ``- OS-bound verification (<os>) passed: `<command>` `` in the commit that sets `Status: done`, merges as `Merge:` says, offers to push `main`, does the wrap-up, and hands the owner `git push origin --delete <slug>`. A failure: stop and show the owner the output.
```

(The double-backtick spans hold a literal backticked `<command>`: the line the agent writes into the spec is `- Awaiting OS-bound verification (windows): ` followed by the command in single backticks.)

- [ ] **Step 3: Add the handover to Continue**

In the "Continue" section, in the Claim list (after the bullet `- Executing: ...`), add:

```markdown
- Awaiting OS-bound verification: a branch `origin/<slug>` exists (as the session's Drift check fetched it) and its spec, `git show origin/<slug>:.scratch/<slug>/spec.md`, is not `done` and has an `Awaiting OS-bound verification (<os>)` line.
```

In the sentence above the Claim list, change `list five groups, the last from GitHub` to `list six groups, the last from GitHub`. In the groups list, between the **Blocked** bullet and the **Requests** bullet, add:

```markdown
- **Awaiting <OS> verification**: the slugs awaiting OS-bound verification on this device's OS (`macos` or `windows`), here instead of under In progress; on any other OS they stay under In progress. One line each: slug, the awaiting commands, `Merge:`.
```

- [ ] **Step 4: Fix the Owner boundary sentence**

In "Owner boundary", replace

```markdown
The rules that production writes and SSH belong to the owner, and that you push only when asked, are in `global.md`.
```

with

```markdown
The rules that production writes and SSH belong to the owner, and when and what you push, are in `global.md`.
```

- [ ] **Step 5: Explain the OS marker in `templates/project.md`**

Replace lines 7–9:

```markdown
Verification command:

{{VERIFY}}
```

with:

```markdown
Verification command:

{{VERIFY}}

A command that runs on one operating system only ends in `(windows)` or `(macos)`: an OS-bound verification, handed over as `workflow.md` step 4 says.
```

- [ ] **Step 6: Run the verification**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`
Expected: all pass.

- [ ] **Step 7: Walk the handover by hand and keep the output**

In `<scratchpad>/os-bound`: one bare remote `r.git` and two clones `mac` and `win`, each with `docs/agents/project.md` whose Verification lists `` `true` `` and `` `true` (windows) ``, and a committed `.scratch/demo/spec.md` (`Status: ready-for-agent`, `Merge: ask`) on `main`, pushed. Then, following the new step-4 bullet word for word:

1. In `mac`: `git worktree add .claude/worktrees/demo -b demo main`, commit a file, add the `## Comments` line `- Awaiting OS-bound verification (windows): `true`` and commit, `git push -u origin demo`, remove the worktree, check `git rev-parse demo` = `git rev-parse origin/demo`, `git branch -D demo`.
2. In `win`: `git fetch`, then do Continue's lookup: `git branch -r`, `git show origin/demo:.scratch/demo/spec.md | grep 'Awaiting OS-bound verification (windows)'` — it must print the line.
3. In `win`: `git worktree add .claude/worktrees/demo demo`, run `true`, replace the line with the `passed` form and set `Status: done` in one commit, merge into `main`, `git push` (`main`), remove the worktree and branch.
4. Show `git log --oneline --graph --all` in `win` and `git ls-remote r.git`.

Save every command and its output to `<scratchpad>/os-bound/run.txt` for the final report.

- [ ] **Step 8: Commit**

```bash
git commit templates/workflow.md templates/project.md -F - <<'EOF'
[cross-device-sync] OS-bound verification: hand the branch over through origin, picked up from Continue

A verification command marked (windows) or (macos) that this device cannot run: the branch is
pushed with the awaiting commands in the spec's Comments, and a device on that OS sees it in
Continue, verifies, merges and offers the push; the remote branch's deletion goes to the owner.
Such a change is never Direct. The Owner boundary sentence points to global.md's new push rule.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: `/sync-workflow` stops causing divergence

**Files:**
- Modify: `skills/sync-workflow/SKILL.md` (sections 1, 4, 5, 6; new section 8)

**Interfaces:**
- Consumes: Task 2's push rule ("offer to push per `global.md`").
- Produces: `KIT_SHA` = the last kit commit that changed `templates/workflow.md`; `.gitattributes` with the four lines in every synced repo.

- [ ] **Step 1: Preflight — target on `main` and current, kit not ahead, `KIT_SHA` from the template's history**

In section 1, replace step 5 (`5. \`KIT_SHA=$(git -C ~/.claude/kit rev-parse HEAD)\`.`) with these three steps, and renumber the old steps 6 and 7 to 8 and 9:

```markdown
5. If `git -C ~/.claude/kit remote` prints a name and `git -C ~/.claude/kit rev-list --count @{u}..HEAD` prints more than `0`, stop: the kit has commits no other device has, so a sha written now would not exist there. Offer to push the kit per `global.md` (`git -C ~/.claude/kit push`), then re-run.
6. The target: `git branch --show-current` must print `main`; otherwise stop and say which branch it is on — the sync's commit belongs on `main`. If `git remote` prints a name and `main` has an upstream (`git rev-parse --verify -q @{u}`), `git fetch --quiet`, then `git rev-list --left-right --count main...@{u}` (ahead, behind) and `git status --porcelain`:
   - behind only, and the status is empty → `git pull --ff-only`; on failure stop and show the owner the output;
   - ahead and behind, or behind with a non-empty status → one `AskUserQuestion`: deal with it first (stop here) / stop;
   - otherwise go on. Write nothing to any file before this step passes.
7. `KIT_SHA=$(git -C ~/.claude/kit log -1 --format=%H -- templates/workflow.md)`: the last kit commit that changed the template, the same on every device whose kit holds it, and unchanged by any other kit commit.
```

Update the "Done when" line of section 1 to:

```markdown
Done when: the kit is clean, on `main`, current and not ahead; the target is on `main` and not behind; graphify is on PATH; you have `KIT_SHA`, a mode and `ORIGIN` (empty if none).
```

And change the order sentence in old step 7 (now 9) so that section 8 runs in every mode, before section 6:

```markdown
   - `docs/agents/workflow.md` exists → **update**: sections 5, 7, 4, 8, 6.
   - None of `CLAUDE.md`, `docs/`, `.scratch/`, `CONTEXT.md` exists → **new**: sections 2, 7, 3, 4, 8, 6.
   - Otherwise → **existing**: sections 2, 7, 3, 4, 8, 6.
```

- [ ] **Step 2: graphify's command path goes `$HOME`-relative**

In section 4, after step 2 (`2. Otherwise run \`graphify claude install\`...`), insert:

```markdown
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
   }
   fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");'
   ```

   A graphify command that still names an absolute path afterwards (graphify outside the home directory) is left as it is; note it in the report.
```

(Verified in planning on macOS with graphify 0.9.61: the result is `"command": "\"$HOME/.local/bin/graphify\" hook-guard search"`, valid JSON, and `sh -c '"$HOME/.local/bin/graphify" --version'` runs. Re-check it in Step 6's run.)

- [ ] **Step 3: "In sync" commits nothing; the Template line changes only with the content**

In section 5, replace the `in sync` row of the table:

```markdown
| `repo.md` = `tmpl.md` | **in sync** | none; if the `Template:` line is missing or not `$KIT_SHA`, set it and commit (section 6) |
```

with:

```markdown
| `repo.md` = `tmpl.md` | **in sync** | none. A missing `Template:` line is set to `$KIT_SHA` (section 6 commits it); any other `Template:` line stays as it is, old format included — rewriting it would be a commit with no content, which two devices make differently |
```

And replace Apply step 2:

```markdown
2. Set the first line to `Template: $KIT_SHA` (insert it if missing).
```

with:

```markdown
2. If step 1 changed anything, set the first line to `Template: $KIT_SHA` (insert it if missing). Otherwise leave the first line alone.
```

- [ ] **Step 4: Add section 8, line endings**

Append after section 7:

````markdown
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
RENORM=$(git ls-files --eol | awk '$1 == "i/crlf" || $1 == "i/mixed" { sub(/^[^\t]*\t/, ""); print }')
```

If `RENORM` is empty, this section ends. Otherwise, after section 6's commit, list the files and ask one `AskUserQuestion`: renormalize them in a commit of their own (recommended) / leave them. On yes — `git add --renormalize` plus `git commit <paths>` does not work (a path commit re-reads the working tree, and keeps CRLF because the committed blob has it), so strip the working copies instead:

```bash
printf '%s\n' "$RENORM" | while IFS= read -r f; do perl -pi -e 's/\r$//' "$f"; done
printf '%s\n' "$RENORM" | tr '\n' '\0' | xargs -0 git commit -m "Normalize line endings per .gitattributes" --
printf '%s\n' "$RENORM" | while IFS= read -r f; do rm -f "$f"; git checkout -- "$f"; done
```

The last line re-checks them out, so `*.bat`, `*.cmd` and `*.ps1` get CRLF back in the working tree. Report this commit with section 6's.

Done when: `.gitattributes` holds the four lines, and either `RENORM` was empty, the owner declined, or `git ls-files --eol` shows no `i/crlf` or `i/mixed` left.
````

- [ ] **Step 5: Section 6 — no empty commit, then offer the push**

In section 6, after the first bullet (the `git add <paths> && git commit <paths> ...` one), add:

```markdown
- Nothing written (in sync, `.gitattributes` complete): no commit, and say so.
- After the commit (and section 8's, if any), offer to push the target per `global.md`: the sooner it is on the remote, the shorter the time another device can sync on top of a stale base.
```

- [ ] **Step 6: Run the two-device sync by hand and keep the output**

The kit under test is this worktree, not `~/.claude/kit`, so point the skill's `~/.claude/kit` at it with a scratch HOME. Commit Steps 1–5 first (Step 8's commit, moved ahead; Step 7 still runs before you report), then:

```bash
S=<scratchpad>/sync2; rm -rf "$S"; mkdir -p "$S/home/.claude"
git init -q --bare -b main "$S/kit.git" && git -C "$S/kit.git" fetch -q <worktree> cross-device-sync:main
git clone -q "$S/kit.git" "$S/home/.claude/kit"
export HOME="$S/home"   # in every shell of this run: the skill's ~/.claude/kit is now the clone, on main, with a remote, not ahead
```

Kit commits for the cases below are made in a second clone `$S/kitdev` and land with `git -C $S/kit.git fetch $S/kitdev main:main`; the skill's own preflight then pulls them into `$S/home/.claude/kit`. Make a bare `$S/proj.git` with one commit on `main` and two clones `dev1`, `dev2`. Then, as an agent following the edited `SKILL.md` word for word with that HOME (answer the `AskUserQuestion`s yourself with the recommended option and write down each answer):

1. `dev1`: run the sync (mode **new**); push. `dev2`: `git pull --ff-only`.
2. Both: run the sync again with the kit unchanged → each must make **no commit** (`git log --oneline | wc -l` unchanged).
3. Add a kit commit that does **not** touch `templates/workflow.md` (in `$S/kitdev`, landed as above); sync both again → still no commit, and the first line is unchanged.
4. Add a kit commit that changes `templates/workflow.md`; sync `dev1`, push; sync `dev2` → its preflight pulls `dev1`'s sync and finds it in sync: no commit, no conflict. Show `git log --oneline --graph` of both.
5. Stops: `dev1` on a branch `x` → stops before writing; `dev2` behind with a dirty file → asks; the kit with an unpushed commit → stops and offers the kit push. Show `git status --porcelain` empty after each stop.
6. `.gitattributes`: a third clone with an existing `.gitattributes` holding `*.png binary` and a committed CRLF file `a.txt` → after sync, the file holds `*.png binary` plus the four lines, the sync commit includes it, and the renormalize commit is separate; `git ls-files --eol a.txt` shows `i/lf`.

Save every command and its output to `$S/run.txt` for the final report.

- [ ] **Step 7: Run the verification**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`
Expected: all pass.

- [ ] **Step 8: Commit** (before Step 6's run, as it says; amend nothing afterwards — a fix found by the run is a new commit)

```bash
git commit skills/sync-workflow/SKILL.md -F - <<'EOF'
[cross-device-sync] sync-workflow: no commit when the template is unchanged, preflight the target, .gitattributes

Template: names the last kit commit that changed templates/workflow.md, and the first line changes only
with the content, so two devices syncing the same template make no commit. The target must be on main
and current, the kit not ahead; the push is offered after the commit. graphify's absolute hook path is
rewritten to $HOME. .gitattributes keeps text LF (CRLF for .bat/.cmd/.ps1); renormalizing is asked
about and committed on its own.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: The kit's own `.gitattributes`, and the spec done

**Files:**
- Create: `.gitattributes`
- Modify: `.scratch/cross-device-sync/spec.md:1`

**Interfaces:**
- Consumes: the four lines from Global Constraints.
- Produces: nothing later tasks use.

- [ ] **Step 1: Write the kit's `.gitattributes`**

```
* text=auto eol=lf
*.bat eol=crlf
*.cmd eol=crlf
*.ps1 eol=crlf
```

- [ ] **Step 2: Check nothing needs renormalizing**

Run: `git ls-files --eol | awk '$1 != "i/lf" && $1 != "i/-text"'`
Expected: no output (checked during planning: every tracked file is `i/lf`). If any line appears, renormalize it as section 8 of `SKILL.md` says, in its own commit, before Step 4.

- [ ] **Step 3: Run the verification**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs && node tests/drift.test.cjs`
Expected: all pass; `git status --porcelain` shows only `.gitattributes`.

- [ ] **Step 4: Set the spec to done and commit both**

Change line 1 of `.scratch/cross-device-sync/spec.md` from `Status: ready-for-agent` to `Status: done`, then:

```bash
git add .gitattributes
git commit .gitattributes .scratch/cross-device-sync/spec.md -F - <<'EOF'
[cross-device-sync] kit .gitattributes (text LF, CRLF for .bat/.cmd/.ps1); spec done

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 5: Merge per `Merge: ask`**

Show the owner the evidence: the verification output, `<scratchpad>/push-rule/guard.txt`, `<scratchpad>/os-bound/run.txt`, `<scratchpad>/sync2/run.txt`. Then one `AskUserQuestion`: merge `cross-device-sync` into `main` / not yet. On yes, from the main checkout: `git merge --no-ff cross-device-sync` (a conflict: stop and ask the owner), `git worktree remove .claude/worktrees/cross-device-sync`, `git merge-base --is-ancestor cross-device-sync main && git branch -D cross-device-sync`, and offer to push `main` per the new `global.md`.
