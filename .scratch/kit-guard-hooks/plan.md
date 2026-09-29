# kit-guard-hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Guard — a PreToolUse hook that denies `superpowers:brainstorming` in workflow repos, asks on every `git push`, and denies pathless `git commit` on a main checkout — install it from `setup.sh`, and deduplicate the rules it backs in `global.md` and `templates/workflow.md`.

**Architecture:** One dependency-free Node script, `hooks/guard.cjs`, reads the hook JSON on stdin and prints a `hookSpecificOutput.permissionDecision` (or nothing). `setup.sh` merges two PreToolUse entries (`Skill`, `Bash`) pointing at it into `~/.claude/settings.json` with an inline `node -e`. Tests feed JSON to the script (`tests/guard.test.cjs`) and run `setup.sh` against a throwaway `HOME` (`tests/setup.test.sh`).

**Tech Stack:** POSIX sh, Node (built-ins only, CommonJS `.cjs` so a stray `"type": "module"` in a parent `package.json` cannot break it), git ≥ 2.31 (`rev-parse --path-format`).

## Global Constraints

- Spec: `.scratch/kit-guard-hooks/spec.md`. The spec is the decision record; do not change a decision in it.
- Work in a worktree: `git worktree add .claude/worktrees/kit-guard-hooks -b kit-guard-hooks main` (from the main checkout). Never commit on the main checkout.
- Commit prefix: `[kit-guard-hooks]`. Always `git commit <paths> -F -`.
- Guard fails open: any parse error or failed git query → print nothing, exit 0.
- Commit rule never asks; only deny or silence. Push only asks.
- Hook command is exactly `node "$HOME/.claude/kit/hooks/guard.cjs"` (literal `$HOME`, expanded when the hook runs; works in Git Bash and macOS).
- `settings.json`: already registered → untouched; missing → created; invalid JSON → message on stderr, file untouched, non-zero exit. No `node` → one `TODO:` line.
- `kit-trim-skills` (the spec's `Overlaps:`) is already on `main`: `setup.sh` has a `--check` mode that must write nothing and fails only on its own `todo` items. The Guard section is skipped under `--check` (the spec puts reporting the Guard out of scope), and its missing-node line is a plain `echo "TODO: …"`, not `todo`. Do not touch section 3.
- `global.md` and `templates/workflow.md` are English; keep their style (one rule per bullet, a reason clause).

## Files

- Create `hooks/guard.cjs` — the Guard.
- Create `tests/guard.test.cjs` — behaviour tests for the Guard (real git repos in a temp dir).
- Modify `setup.sh` — new section 4 installs the Guard.
- Modify `tests/setup.test.sh` — install assertions.
- Modify `docs/agents/project.md` — verification command gains the Guard test.
- Modify `README.md` — one line for `hooks/`.
- Modify `global.md`, `templates/workflow.md` — dedup.
- Modify `.scratch/kit-guard-hooks/spec.md` — `Status: done` in the last commit.

---

### Task 1: The Guard

**Files:**
- Create: `hooks/guard.cjs`
- Test: `tests/guard.test.cjs`

**Interfaces:**
- Produces: `node hooks/guard.cjs` reading PreToolUse JSON (`tool_name`, `tool_input`, `cwd`) on stdin, env `CLAUDE_PROJECT_DIR` optional. Output is either empty or `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"|"ask","permissionDecisionReason":"Guard: ..."}}`. Always exit 0. Tasks 2 and 4 rely on the path `hooks/guard.cjs`.

Behaviour, per the spec's Implementation Decisions (plus two resolutions made while planning, now written into the spec):
- `Skill` with `skill === "superpowers:brainstorming"`: find the repo top level of `CLAUDE_PROJECT_DIR` (else `cwd`); deny if it has `docs/agents/workflow.md` **or `templates/workflow.md`** (the kit repo itself only has the latter).
- `Bash`: split the command into segments on `&&` `||` `;` `|` `&` `(` `)` newline, respecting quotes; drop heredoc bodies and redirection targets (`2>&1`, `>/dev/null`). A segment `cd <dir>` moves the directory used for later segments (so `cd <worktree> && git commit -m x` is judged in the worktree); `git` global options (`-C`, `-c`, `--git-dir`, …) are passed through to the git query.
- `git … push` in any segment → ask. `git … commit`: paths present (positional args, or anything after `--`, or `--pathspec-from-file`) and no `-a`/`--all` → silent; `--amend` + `--only`/`-o` → silent; else ask git in that directory: linked worktree (`--git-dir` ≠ `--git-common-dir`) or `MERGE_HEAD`/`CHERRY_PICK_HEAD`/`REVERT_HEAD` present → silent; otherwise deny with the corrected form. Deny wins over ask.

- [ ] **Step 1: Write the failing test** — create `tests/guard.test.cjs`:

```js
// Feeds hook JSON to hooks/guard.cjs and checks the decision it prints. Needs node and git.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const GUARD = path.join(__dirname, '..', 'hooks', 'guard.cjs');
const T = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-')));
process.on('exit', () => fs.rmSync(T, { recursive: true, force: true }));

const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
delete env.CLAUDE_PROJECT_DIR; // the session running this test may set it
const sh = (cwd, ...args) => execFileSync('git', args, { cwd, env, stdio: 'ignore' });

function repo(name) {
  const dir = path.join(T, name);
  fs.mkdirSync(dir);
  sh(dir, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  sh(dir, 'add', 'a.txt');
  sh(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

function guard(input, extraEnv = {}) {
  const r = spawnSync('node', [GUARD], { input: JSON.stringify(input), env: { ...env, ...extraEnv }, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `guard exited ${r.status}: ${r.stderr}`);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'none';
}
const bash = (cwd, command) => guard({ tool_name: 'Bash', tool_input: { command }, cwd });
const expect = (got, want, what) => assert.strictEqual(got, want, `${what}: expected ${want}, got ${got}`);

const main = repo('main');
const wt = path.join(T, 'wt');
sh(main, 'worktree', 'add', '-q', wt, '-b', 'feature');
const merging = repo('merging');
fs.writeFileSync(path.join(merging, '.git', 'MERGE_HEAD'), execFileSync('git', ['rev-parse', 'HEAD'], { cwd: merging, env, encoding: 'utf8' }));

// Brainstorming: denied only where the kit workflow applies.
const kit = repo('kit');
fs.mkdirSync(path.join(kit, 'templates'));
fs.writeFileSync(path.join(kit, 'templates', 'workflow.md'), '# Workflow\n');
const flow = repo('flow');
fs.mkdirSync(path.join(flow, 'docs', 'agents'), { recursive: true });
fs.writeFileSync(path.join(flow, 'docs', 'agents', 'workflow.md'), '# Workflow\n');
const skill = (cwd, name, e) => guard({ tool_name: 'Skill', tool_input: { skill: name }, cwd }, e);
expect(skill(flow, 'superpowers:brainstorming'), 'deny', 'brainstorming, docs/agents/workflow.md');
expect(skill(kit, 'superpowers:brainstorming'), 'deny', 'brainstorming, templates/workflow.md');
expect(skill(path.join(T, 'x'), 'superpowers:brainstorming', { CLAUDE_PROJECT_DIR: flow }), 'deny', 'brainstorming, CLAUDE_PROJECT_DIR wins over cwd');
expect(skill(main, 'superpowers:brainstorming'), 'none', 'brainstorming, no workflow');
expect(skill(flow, 'superpowers:writing-plans'), 'none', 'other skill');

// push: always ask, however it is written.
expect(bash(main, 'git push'), 'ask', 'git push');
expect(bash(main, `git -C ${wt} push origin feature`), 'ask', 'git -C push');
expect(bash(main, 'npm test && git push'), 'ask', 'push after &&');
expect(bash(main, 'git status; git push --force'), 'ask', 'push after ;');

// commit on the main checkout.
expect(bash(main, "git commit a.txt -F - <<'EOF'\nfix: stop git commit -m x from\nEOF"), 'none', 'paths -F - heredoc');
expect(bash(main, 'git commit -m "msg" a.txt'), 'none', '-m with a path');
expect(bash(main, 'git commit -m msg -- a.txt'), 'none', '-- with a path');
expect(bash(main, 'git commit a.txt -m "$(cat <<\'EOF\'\nmsg\nEOF\n)" 2>&1'), 'none', 'path, $(cat heredoc) message, 2>&1');
expect(bash(main, 'git commit -m "msg"'), 'deny', '-m only');
expect(bash(main, 'git commit -m msg 2>&1'), 'deny', '-m only, 2>&1 is no path');
expect(bash(main, 'git commit -a -m msg'), 'deny', '-a');
expect(bash(main, 'git commit -am msg'), 'deny', '-am');
expect(bash(main, 'git commit --all -m msg a.txt'), 'deny', '--all with a path');
expect(bash(main, 'git commit --amend --no-edit'), 'deny', '--amend');
expect(bash(main, 'git commit --amend --only -m msg'), 'none', '--amend --only');
expect(bash(main, 'git add a.txt && git commit -m msg'), 'deny', 'pathless commit after &&');
expect(bash(merging, 'git commit --no-edit'), 'none', 'merge in progress');

// commit in a linked worktree: its index is its own.
expect(bash(wt, 'git commit -m msg'), 'none', 'worktree, -m only');
expect(bash(main, `git -C ${wt} commit -m msg`), 'none', 'git -C worktree');
expect(bash(main, `cd ${wt} && git commit -m msg`), 'none', 'cd worktree &&');

// Everything else, and whatever the Guard cannot read, passes.
expect(bash(main, 'ls -la'), 'none', 'ls');
expect(bash(main, 'git status'), 'none', 'git status');
expect(bash(main, 'git commit -m "unbalanced'), 'none', 'unparsable');
expect(bash(path.join(T, 'nowhere'), 'git commit -m msg'), 'none', 'git query fails');
expect(guard({ tool_name: 'Read', tool_input: { file_path: 'a' }, cwd: main }), 'none', 'other tool');

console.log('PASS');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/guard.test.cjs`
Expected: FAIL — `guard exited 1` with `Cannot find module …/hooks/guard.cjs`.

- [ ] **Step 3: Write the Guard** — create `hooks/guard.cjs`:

```js
#!/usr/bin/env node
// Guard: PreToolUse hook that backs the mechanical rules in global.md and workflow.md.
// Prints a deny/ask decision, or nothing to leave the call to the normal permission flow.
// Anything it cannot parse or check is let through: the written rule stays the source, this is the backstop.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BRAINSTORM =
  'Guard: this repo follows the kit workflow — grill plus /to-spec replace superpowers:brainstorming. ' +
  'Do not retry; run the grill instead.';
const PUSH = 'Guard: `git push` belongs to the owner (global.md). Approve only if you meant to push.';
const COMMIT =
  'Guard: on the main checkout `git commit` must take paths — other sessions share the index (global.md). ' +
  "Retry as `git commit <paths> -F - <<'EOF'` with the message in the heredoc, or `git commit -m <msg> -- <paths>`. " +
  'An amend that only rewrites the message takes `--only`.';

// Options of `git commit` that consume the next argument when not written as --opt=value.
const VALUE_LONG = new Set(['--message', '--file', '--reuse-message', '--reedit-message', '--author', '--date',
  '--template', '--fixup', '--squash', '--trailer', '--cleanup', '--pathspec-from-file']);
const VALUE_SHORT = 'mFCct';
// git's own options before the subcommand that consume the next argument.
const GIT_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);

// Splits a shell command into segments (&&, ||, ;, |, &, parentheses, newline) of unquoted words.
// Heredoc bodies and redirection targets are dropped. Throws on unbalanced quotes.
function segments(cmd) {
  const segs = [[]];
  const heredocs = [];
  let tok = null;
  let q = null;
  const push = () => { if (tok !== null) segs[segs.length - 1].push(tok); tok = null; };
  const split = () => { push(); if (segs[segs.length - 1].length) segs.push([]); };
  const word = (i) => { // reads one (possibly quoted) word starting at i; returns [word, next index]
    while (cmd[i] === ' ' || cmd[i] === '\t') i++;
    let w = '';
    let wq = null;
    for (; i < cmd.length; i++) {
      const c = cmd[i];
      if (wq) { if (c === wq) wq = null; else w += c; continue; }
      if (c === "'" || c === '"') { wq = c; continue; }
      if (/[\s;&|()<>]/.test(c)) break;
      w += c;
    }
    return [w, i];
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) {
      if (c === q) q = null;
      else if (c === '\\' && q === '"' && i + 1 < cmd.length) tok += cmd[++i];
      else tok += c;
      continue;
    }
    if (c === "'" || c === '"') { q = c; tok = tok ?? ''; continue; }
    if (c === '\\' && i + 1 < cmd.length) {
      if (cmd[i + 1] === '\n') { i++; push(); continue; } // line continuation
      tok = (tok ?? '') + cmd[++i];
      continue;
    }
    if (c === '<' && cmd[i + 1] === '<' && cmd[i + 2] !== '<') { // heredoc: remember the delimiter
      push();
      i += 2;
      const strip = cmd[i] === '-';
      if (strip) i++;
      const [delim, next] = word(i);
      heredocs.push({ delim, strip });
      i = next - 1;
      continue;
    }
    if (c === '<' || c === '>') { // redirection: drop a bare fd number before it and the target after it
      if (tok !== null && /^\d+$/.test(tok)) tok = null;
      push();
      while (cmd[i + 1] === '<' || cmd[i + 1] === '>' || cmd[i + 1] === '|') i++;
      if (cmd[i + 1] === '&') { i++; while (/[\d-]/.test(cmd[i + 1] ?? '')) i++; continue; }
      const [, next] = word(i + 1);
      i = next - 1;
      continue;
    }
    if (c === '\n') {
      split();
      while (heredocs.length) { // skip each pending heredoc body up to its delimiter line
        const { delim, strip } = heredocs.shift();
        let end = cmd.indexOf('\n', i + 1);
        for (;;) {
          const line = cmd.slice(i + 1, end === -1 ? cmd.length : end);
          i = end === -1 ? cmd.length : end;
          if ((strip ? line.replace(/^\t+/, '') : line) === delim || end === -1) break;
          end = cmd.indexOf('\n', i + 1);
        }
      }
      continue;
    }
    if (/[;&|()]/.test(c)) { split(); continue; }
    if (c === ' ' || c === '\t') { push(); continue; }
    tok = (tok ?? '') + c;
  }
  if (q) throw new Error('unbalanced quote');
  push();
  return segs.filter((s) => s.length);
}

// Reads `git [global options] <sub> <args>` from one segment; null when the segment is not git.
function gitCall(seg) {
  let i = 0;
  while (i < seg.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(seg[i])) i++; // leading VAR=value
  if (!/^git(\.exe)?$/.test(path.basename(seg[i] ?? ''))) return null;
  i++;
  const globals = [];
  while (i < seg.length && seg[i].startsWith('-')) {
    globals.push(seg[i]);
    if (GIT_VALUE.has(seg[i]) && i + 1 < seg.length) globals.push(seg[++i]);
    i++;
  }
  return { globals, sub: seg[i], args: seg.slice(i + 1) };
}

function commitShape(args) {
  const s = { paths: false, all: false, amend: false, only: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { s.paths = s.paths || i + 1 < args.length; break; }
    if (a.startsWith('--')) {
      const name = a.split('=')[0];
      if (name === '--all') s.all = true;
      else if (name === '--amend') s.amend = true;
      else if (name === '--only') s.only = true;
      else if (name === '--pathspec-from-file') s.paths = true;
      if (VALUE_LONG.has(name) && !a.includes('=')) i++;
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      for (let j = 1; j < a.length; j++) {
        const f = a[j];
        if (f === 'a') s.all = true;
        else if (f === 'o') s.only = true;
        if (VALUE_SHORT.includes(f)) { if (j === a.length - 1) i++; break; }
      }
      continue;
    }
    s.paths = true;
  }
  return s;
}

function git(cwd, globals, args) {
  return execFileSync('git', [...globals, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n').map((l) => l.trim());
}

// True when git lets a pathless commit through here: a linked worktree, or a merge,
// cherry-pick or revert in progress (git refuses a partial commit there).
function pathlessOk(cwd, globals) {
  const [gitDir, common, ...heads] = git(cwd, globals, ['rev-parse', '--path-format=absolute', '--git-dir',
    '--git-common-dir', '--git-path', 'MERGE_HEAD', '--git-path', 'CHERRY_PICK_HEAD', '--git-path', 'REVERT_HEAD']);
  if (fs.realpathSync(gitDir) !== fs.realpathSync(common)) return true;
  return heads.slice(0, 3).some((h) => fs.existsSync(h));
}

function checkBash(command, cwd) {
  let dir = cwd;
  let ask = false;
  for (const seg of segments(command)) {
    if (seg[0] === 'cd' && seg.length === 2) { dir = path.resolve(dir, seg[1]); continue; }
    const call = gitCall(seg);
    if (!call) continue;
    if (call.sub === 'push') { ask = true; continue; }
    if (call.sub !== 'commit') continue;
    const s = commitShape(call.args);
    if ((s.paths && !s.all) || (s.amend && s.only)) continue;
    try { if (pathlessOk(dir, call.globals)) continue; } catch { continue; }
    return ['deny', COMMIT];
  }
  return ask ? ['ask', PUSH] : null;
}

function checkSkill(skill, dir) {
  if (skill !== 'superpowers:brainstorming') return null;
  let root = dir;
  try { root = git(dir, [], ['rev-parse', '--show-toplevel'])[0] || dir; } catch {}
  const marked = ['docs/agents/workflow.md', 'templates/workflow.md'].some((f) => fs.existsSync(path.join(root, f)));
  return marked ? ['deny', BRAINSTORM] : null;
}

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const cwd = input.cwd || process.cwd();
  const t = input.tool_input || {};
  const verdict =
    input.tool_name === 'Bash' ? checkBash(String(t.command ?? ''), cwd)
    : input.tool_name === 'Skill' ? checkSkill(t.skill, process.env.CLAUDE_PROJECT_DIR || cwd)
    : null;
  if (verdict) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: {
      hookEventName: 'PreToolUse', permissionDecision: verdict[0], permissionDecisionReason: verdict[1] } }));
  }
} catch {
  // ponytail: fail open — a parser gap must never block the agent
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/guard.test.cjs`
Expected: `PASS`

- [ ] **Step 5: Commit**

```bash
git add hooks/guard.cjs tests/guard.test.cjs
git commit hooks/guard.cjs tests/guard.test.cjs -F - <<'EOF'
[kit-guard-hooks] Guard: deny brainstorming in workflow repos, ask on push, deny pathless commits on a main checkout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Install the Guard from setup.sh

**Files:**
- Modify: `setup.sh` (new section 4, just before the last line `[ -z "$CHECK" ] || [ -z "$BAD" ] || exit 1`)
- Modify: `tests/setup.test.sh`
- Modify: `docs/agents/project.md` (Verification section)
- Modify: `README.md`

**Interfaces:**
- Consumes: `hooks/guard.cjs` from Task 1 (only its path).
- Produces: `~/.claude/settings.json` with `hooks.PreToolUse` entries `{"matcher":"Skill"}` and `{"matcher":"Bash"}`, each `hooks: [{"type":"command","command":"node \"$HOME/.claude/kit/hooks/guard.cjs\""}]`.

- [ ] **Step 1: Write the failing assertions** — in `tests/setup.test.sh`:

The test runs `setup.sh` with `PATH="$T/bin:/usr/bin:/bin"`, where `node` is usually absent. After the line `chmod +x "$T/bin/npx" "$T/bin/graphify"`, add:

```sh
ln -s "$(command -v node)" "$T/bin/node"  # the real node: the Guard section needs it
```

After the line `printf 'existing line' > "$T/.claude/CLAUDE.md"    # no trailing newline, on purpose`, add:

```sh
cat > "$T/.claude/settings.json" <<'EOF'
{"model": "keep-me", "hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "echo mine"}]}]}}
EOF
```

After the `for d in "$KIT"/skills/*/; do … done` block that follows the two initial runs, add:

```sh
[ "$(grep -c 'kit/hooks/guard.cjs' "$T/.claude/settings.json")" = 2 ] || fail "Guard not registered exactly once (Skill and Bash)"
grep -q '"keep-me"' "$T/.claude/settings.json" || fail "existing settings key lost"
grep -q 'echo mine' "$T/.claude/settings.json" || fail "existing hook lost"
```

In the `# --check with missing skills` block, after `cp "$T/.claude/CLAUDE.md" "$T/before"` add `cp "$T/.claude/settings.json" "$T/before-settings"`, and after `cmp -s "$T/.claude/CLAUDE.md" "$T/before" || fail "--check changed CLAUDE.md"` add:

```sh
cmp -s "$T/.claude/settings.json" "$T/before-settings" || fail "--check changed settings.json"
```

Just before the final `echo PASS`, add:

```sh
# No node: a TODO line, and settings.json untouched.
rm "$T/bin/node"; cp "$T/.claude/settings.json" "$T/before-settings"
HOME="$T" sh "$KIT/setup.sh" | grep -q 'TODO.*Guard' || fail "no TODO for the Guard without node"
cmp -s "$T/.claude/settings.json" "$T/before-settings" || fail "settings.json changed without node"
ln -s "$(PATH=$SAVED_PATH command -v node)" "$T/bin/node"

# A settings.json it cannot read: setup.sh must stop and leave it alone.
printf '{broken' > "$T/.claude/settings.json"
if HOME="$T" sh "$KIT/setup.sh" >/dev/null 2>&1; then fail "setup.sh did not stop on a broken settings.json"; fi
[ "$(cat "$T/.claude/settings.json")" = '{broken' ] || fail "broken settings.json was rewritten"
```

and, so the real node can be found again there, change `export NPXLOG PATH="$T/bin:/usr/bin:/bin"` to:

```sh
SAVED_PATH=$PATH
export NPXLOG PATH="$T/bin:/usr/bin:/bin"
```

Also change the header comment `# Runs setup.sh twice against a throwaway HOME. macOS/Linux only.` to `# Runs setup.sh twice against a throwaway HOME. macOS/Linux only; needs node.`

- [ ] **Step 2: Run it to verify it fails**

Run: `sh tests/setup.test.sh`
Expected: `FAIL: Guard not registered exactly once (Skill and Bash)`

- [ ] **Step 3: Add section 4 to `setup.sh`**, inserted just before the last line `[ -z "$CHECK" ] || [ -z "$BAD" ] || exit 1`:

```sh
# 4. Guard: a PreToolUse hook backing the mechanical rules in global.md and workflow.md. --check leaves it alone.
SETTINGS="$HOME/.claude/settings.json"
GUARD_CMD='node "$HOME/.claude/kit/hooks/guard.cjs"'
if [ -n "$CHECK" ]; then :
elif command -v node >/dev/null 2>&1; then
  node -e '
const fs = require("fs");
const [file, command] = process.argv.slice(1);
let s = {};
if (fs.existsSync(file)) {
  try { s = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { console.error(`STOP: ${file} is not valid JSON (${e.message}). Fix it, then re-run.`); process.exit(1); }
}
const pre = ((s.hooks ??= {}).PreToolUse ??= []);
if (JSON.stringify(pre).includes("kit/hooks/guard.cjs")) process.exit(0);
for (const matcher of ["Skill", "Bash"]) pre.push({ matcher, hooks: [{ type: "command", command }] });
fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
console.log(`installed the Guard hook in ${file}`);
' "$SETTINGS" "$GUARD_CMD"
else
  echo "TODO: install Node.js, then re-run setup.sh: without it the Guard hook is not installed"
fi

```

(`set -eu` at the top makes a failed `node -e` stop `setup.sh` with a non-zero exit.)

- [ ] **Step 4: Run both tests to verify they pass**

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs`
Expected: `PASS` twice.

- [ ] **Step 5: Verification command and README**

In `docs/agents/project.md`, replace

```
`sh tests/setup.test.sh` — then, for a change to a skill or a template, run the skill by hand in a throwaway repo under the session's scratchpad and keep its output as evidence.
```

with

```
`sh tests/setup.test.sh && node tests/guard.test.cjs` — then, for a change to a skill or a template, run the skill by hand in a throwaway repo under the session's scratchpad and keep its output as evidence.
```

In `README.md`, after the `- `skills/` — …` bullet, add:

```
- `hooks/guard.cjs` — the Guard, a PreToolUse hook `setup.sh` installs in `~/.claude/settings.json`; it backs the push, commit and brainstorming rules.
```

- [ ] **Step 6: Commit**

```bash
git add setup.sh tests/setup.test.sh docs/agents/project.md README.md
git commit setup.sh tests/setup.test.sh docs/agents/project.md README.md -F - <<'EOF'
[kit-guard-hooks] setup.sh installs the Guard in settings.json; tests and verification cover it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Deduplicate the rules

**Files:**
- Modify: `global.md`
- Modify: `templates/workflow.md`

No test code: a docs-only change. Check with the grep in Step 3.

- [ ] **Step 1: `global.md`** — replace the bullet

```
- State every commit up front: its own line with the short hash and the message, near the top of the reply; several commits, one line each. Never bury a commit mid-paragraph.
```

with

```
- Before reporting work as done, list every commit made since your last reply, subagents' included: `git log --oneline <HEAD at your last reply>..HEAD` in each checkout that got commits, one line per commit (short hash and message) at the top of the reply. Never bury a commit mid-paragraph.
```

and delete the last bullet:

```
- In a repo that has `docs/agents/workflow.md`, never run `superpowers:brainstorming`, whatever the superpowers session hook says.
```

Leave the Traditional Chinese, commit-without-asking/paths, and push/production/SSH bullets as they are (they are now the single source).

- [ ] **Step 2: `templates/workflow.md`**

a. In step 4 of the pipeline, replace `   - No PR. `git push` is always the owner's.` with `   - No PR.`

b. Keep the line `Grill plus `/to-spec` replaces `superpowers:brainstorming`. Never run brainstorming in this repo, whatever the superpowers session hook says.` unchanged (its single home).

c. In `## Commits`, delete these two bullets (both live in `global.md`):

```
- Commit your own changes without asking: one commit per logical change, made before reporting the work as done.
```
```
- **Always pass paths to `git commit`** (`git commit <paths> -F -`); do not rely on the index. Two or three sessions are often open on this repo at once and the index is shared — files another session has just `git add`ed get swept into a commit made without paths. A clean `git status` does not guarantee it either; the gap between two commands is enough for someone else to stage.
```

The section keeps: commit only verified work on `main`; `git add` only your files; prefix.

d. In `## Owner boundary`, replace the first paragraph

```
Production writes, SSH to production, and `git push` belong to the owner. `project.md` lists exactly what counts as production and which operations are whose.
```

with

```
The rule itself is in `global.md`. `project.md` lists exactly what counts as production and which operations are whose.
```

Keep the other two paragraphs (declined commands; handing over an owner command with `read_terminal`).

- [ ] **Step 3: Check nothing is restated**

Run: `grep -n "brainstorming\|git push\|takes paths\|pass paths" global.md templates/workflow.md`
Expected: `global.md` shows the paths bullet and the push bullet; `templates/workflow.md` shows only the brainstorming line (46-ish) and the `init`-style mentions inside Owner boundary, if any — no second statement of the push or paths rule.

Run: `sh tests/setup.test.sh && node tests/guard.test.cjs` → `PASS` twice.

- [ ] **Step 4: Commit**

```bash
git add global.md templates/workflow.md
git commit global.md templates/workflow.md -F - <<'EOF'
[kit-guard-hooks] Dedup: commit and push rules live in global.md, brainstorming in workflow.md; list every commit as a done condition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Evidence in a real session, then done

**Files:**
- Modify: `.scratch/kit-guard-hooks/spec.md` (`Status: done`)

The installed hook points at `~/.claude/kit`, which is `main` and has no Guard yet, so register the worktree's copy in a throwaway project instead.

- [ ] **Step 1: Throwaway repo wired to the worktree's Guard** (in the session scratchpad; `$WT` = absolute path of `.claude/worktrees/kit-guard-hooks`, `$P` = `<scratchpad>/guard-evidence`):

```bash
mkdir -p "$P/.claude" "$P/docs/agents" && cd "$P" && git init -q -b main
printf '# Workflow\n' > docs/agents/workflow.md && printf 'a\n' > a.txt
git add . && git commit -q -m init
node -e 'const [f,g]=process.argv.slice(1); require("fs").writeFileSync(f, JSON.stringify({hooks:{PreToolUse:["Skill","Bash"].map(matcher=>({matcher,hooks:[{type:"command",command:`node "${g}"`}]}))}}, null, 2))' "$P/.claude/settings.json" "$WT/hooks/guard.cjs"
printf 'b\n' >> a.txt && git add a.txt
```

- [ ] **Step 2: Three real sessions** (from `$P`; keep each output):

```bash
claude -p "Run exactly this Bash command and nothing else first: git commit -m evidence. If it is refused, follow the reason and retry." --allowedTools Bash > commit.txt 2>&1
claude -p "Run exactly this Bash command: git push" --allowedTools Bash > push.txt 2>&1
claude -p "Use the Skill tool to invoke superpowers:brainstorming, then say what happened." > brainstorm.txt 2>&1
git log --oneline -3 >> commit.txt
```

Expected: `commit.txt` shows the Guard's deny reason and a retried commit with `a.txt` as a path (the log shows the new commit); `push.txt` shows the push was not run because it needed approval, naming the Guard/`global.md` reason (in `-p` mode an `ask` cannot be answered, which is the evidence it asked); `brainstorm.txt` shows the Guard's deny reason. If any of these differ, stop and report — do not edit the Guard to fit.

The interactive confirmation window for `git push` is checked by the owner after merge (Step 4 hand-over).

- [ ] **Step 3: Mark done and commit**

In `.scratch/kit-guard-hooks/spec.md` change `Status: ready-for-agent` to `Status: done`.

```bash
git add .scratch/kit-guard-hooks/spec.md
git commit .scratch/kit-guard-hooks/spec.md -F - <<'EOF'
[kit-guard-hooks] Status: done

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 4: Merge (`Merge: ask`)**

Run `sh tests/setup.test.sh && node tests/guard.test.cjs` once more on the branch. Show the owner both `PASS` lines and the three evidence files, then `AskUserQuestion` whether to merge. Only on yes, from the main checkout: `git merge --no-ff kit-guard-hooks`, run the verification again on `main`, then `git worktree remove .claude/worktrees/kit-guard-hooks` and `git branch -d kit-guard-hooks`.

Hand the owner these, each in its own `bash` block: `sh ~/.claude/kit/setup.sh` (installs the Guard on this device; then open a new session and try `git push` to see the confirmation window) and `git -C ~/.claude/kit push`.
