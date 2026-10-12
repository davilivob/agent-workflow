// Runs hooks/drift.cjs on repos cloned from throwaway bare remotes and checks what it prints. Needs node and git.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const DRIFT = path.join(__dirname, '..', 'hooks', 'drift.cjs');
const T = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'drift-')));
process.on('exit', () => fs.rmSync(T, { recursive: true, force: true }));

const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
delete env.CLAUDE_PROJECT_DIR; // the session running this test may set it
const sh = (cwd, ...args) => execFileSync('git', args, { cwd, env, stdio: 'ignore' });
const commit = (dir, file) => { fs.writeFileSync(path.join(dir, file), file); sh(dir, 'add', file); sh(dir, 'commit', '-q', '-m', file); };

// A bare remote with one commit on main, and a clone of it at <parent>/<name>, in sync.
let n = 0;
function clone(name, parent = T) {
  const bare = path.join(T, `remote-${++n}.git`);
  sh(T, 'init', '-q', '--bare', '-b', 'main', bare);
  const dir = path.join(parent, name);
  fs.mkdirSync(parent, { recursive: true });
  sh(T, 'clone', '-q', bare, dir);
  commit(dir, 'a.txt');
  sh(dir, 'push', '-q', '-u', 'origin', 'main');
  sh(dir, 'remote', 'set-head', 'origin', 'main');
  return dir;
}
// Another device pushes one commit to <branch>.
function advance(dir, branch = 'main') {
  const other = path.join(T, `other-${++n}`);
  sh(T, 'clone', '-q', '-b', branch, execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: dir, encoding: 'utf8' }).trim(), other);
  commit(other, `b${n}.txt`);
  sh(other, 'push', '-q');
}

function session(cwd) {
  const r = spawnSync('node', [DRIFT, '--session'], { input: JSON.stringify({ hook_event_name: 'SessionStart', cwd }), env, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `drift --session exited ${r.status}: ${r.stderr}`);
  if (!r.stdout) return null;
  const out = JSON.parse(r.stdout);
  assert.strictEqual(out.systemMessage, out.hookSpecificOutput.additionalContext, 'owner and agent see the same text');
  return out.hookSpecificOutput.additionalContext;
}
const RULES = { ask: 'ask the owner with AskUserQuestion', ff: 'without asking' };
function expect(text, has, rule, what) { // rule: 'ask', 'ff' or false
  assert.ok(text, `${what}: no output`);
  for (const h of has) assert.ok(text.includes(h), `${what}: missing "${h}" in:\n${text}`);
  for (const [k, v] of Object.entries(RULES)) assert.strictEqual(text.includes(v), rule === k, `${what}: ${k} should be ${rule === k}:\n${text}`);
}

// SessionStart.
assert.strictEqual(session(clone('synced')), null, 'in sync: silent');
let d = clone('behind'); advance(d);
expect(session(d), ['branch main: behind origin/main by 1'], 'ff', 'behind, clean');
fs.writeFileSync(path.join(d, 'a.txt'), 'changed');
expect(session(d), ['branch main: behind origin/main by 1', 'uncommitted changes'], 'ask', 'behind, dirty');
d = clone('ahead'); commit(d, 'x.txt');
expect(session(d), ['branch main: ahead of origin/main by 1'], false, 'ahead');
d = clone('dirty'); fs.writeFileSync(path.join(d, 'a.txt'), 'changed');
expect(session(d), ['uncommitted changes'], false, 'tracked file changed');
d = clone('untracked'); fs.writeFileSync(path.join(d, 'new.txt'), 'x');
expect(session(d), ['uncommitted changes'], false, 'only an untracked file');
d = clone('local-branch'); sh(d, 'checkout', '-q', '-b', 'feature');
expect(session(d), ['branch feature: no upstream'], false, 'branch with no upstream');
d = clone('dev');
sh(d, 'checkout', '-q', '-b', 'dev'); sh(d, 'push', '-q', '-u', 'origin', 'dev'); advance(d, 'dev'); advance(d, 'dev');
expect(session(d), ['branch dev: behind origin/dev by 2'], 'ff', 'current non-default branch behind');
d = clone('wt-main'); advance(d);
const wt = path.join(d, '.claude', 'worktrees', 'x');
sh(d, 'worktree', 'add', '-q', wt, '-b', 'x');
expect(session(wt), ['branch x: no upstream', 'branch main: behind origin/main by 1'], 'ff', 'worktree, main behind');
d = clone('no-remote'); sh(d, 'remote', 'remove', 'origin');
expect(session(d), ['no remote'], false, 'no remote');
assert.ok(!session(d).includes('no upstream'), 'no remote: branches are not reported as no upstream');
fs.writeFileSync(path.join(d, 'new.txt'), 'x');
expect(session(d), ['no remote', 'uncommitted changes'], false, 'no remote, uncommitted changes');
d = clone('bad-remote'); sh(d, 'remote', 'set-url', 'origin', path.join(T, 'gone.git'));
expect(session(d), ['Unknown: fetch failed'], 'ask', 'remote unreachable');
fs.mkdirSync(path.join(T, 'plain'));
assert.strictEqual(session(path.join(T, 'plain')), null, 'not a repo: silent');

// The drift command.
const home = path.join(T, 'home');
fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
const roots = (...lines) => fs.writeFileSync(path.join(home, '.claude', 'drift-roots'), lines.join('\n'));
function cli() {
  const r = spawnSync('node', [DRIFT], { env: { ...env, HOME: home, USERPROFILE: home }, encoding: 'utf8' }); // os.homedir() reads USERPROFILE on Windows
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const noDrift = /0 with Drift, 0 Unknown/;

let r = cli();
assert.ok(r.code !== 0 && r.err.includes('drift-roots') && !noDrift.test(r.out), `no roots file: ${JSON.stringify(r)}`);
roots('# only a comment');
assert.ok(cli().code !== 0, 'roots file with no roots');
fs.mkdirSync(path.join(T, 'empty-root'));
roots(path.join(T, 'empty-root'));
r = cli();
assert.ok(r.code !== 0 && r.err.includes('no git repos') && !noDrift.test(r.out), `no repos: ${JSON.stringify(r)}`);

const clean = path.join(T, 'clean-root');
clone('one', clean);
roots(clean);
r = cli();
assert.strictEqual(r.code, 0, `all in sync: ${JSON.stringify(r)}`);
assert.strictEqual(r.out.trim(), '0 with Drift, 0 Unknown, 0 no remote; 1 repos scanned', 'all in sync: only the totals');

roots(clean, path.join(T, 'typo'));
r = cli();
assert.ok(r.code !== 0 && r.out.includes(`missing root: ${path.join(T, 'typo')}`), `missing root: ${JSON.stringify(r)}`);

const root = path.join(T, 'root');
const behind = clone('behind', path.join(root, 'group')); advance(behind); // nested one level down
const quiet = clone('quiet', root);
sh(quiet, 'branch', 'side'); // a branch other than the current one, never pushed
sh(quiet, 'worktree', 'add', '-q', path.join(quiet, '.claude', 'worktrees', 'w'), '-b', 'w');
const lonely = clone('lonely', root); sh(lonely, 'remote', 'remove', 'origin');
const lonelyDirty = clone('lonely-dirty', root); sh(lonelyDirty, 'remote', 'remove', 'origin');
fs.writeFileSync(path.join(lonelyDirty, 'new.txt'), 'x');
const broken = clone('broken', root); sh(broken, 'remote', 'set-url', 'origin', path.join(T, 'gone.git'));
clone('dep', path.join(root, 'node_modules')); advance(path.join(root, 'node_modules', 'dep'));
roots(root);
r = cli();
assert.strictEqual(r.code, 1, `drift found: ${JSON.stringify(r)}`);
assert.ok(r.out.includes(`${behind}\n  branch main: behind origin/main by 1`), `behind repo:\n${r.out}`);
assert.ok(r.out.includes('branch side: no upstream') && r.out.includes('branch w: no upstream'), `every local branch:\n${r.out}`);
assert.ok(!r.out.includes(path.join('worktrees', 'w')), `a worktree is not a repo of its own:\n${r.out}`);
assert.ok(r.out.includes(`${lonely}\n  no remote\n`), `no remote:\n${r.out}`);
assert.ok(r.out.includes(`${lonelyDirty}\n  no remote\n  uncommitted changes\n`), `no remote, dirty:\n${r.out}`);
assert.ok(r.out.includes(`${broken}\n  Unknown: fetch failed`), `unreachable remote:\n${r.out}`);
assert.ok(!r.out.includes('node_modules'), `node_modules skipped:\n${r.out}`);
assert.ok(r.out.trimEnd().endsWith('3 with Drift, 1 Unknown, 2 no remote; 5 repos scanned'), `totals:\n${r.out}`);

fs.mkdirSync(path.join(home, 'proj'));
clone('mine', path.join(home, 'proj'));
roots('~/proj');
assert.strictEqual(cli().code, 0, '~ expands to the home directory');

console.log('PASS');
