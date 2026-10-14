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
const HOME = path.join(T, 'home'); // holds .claude/device; USERPROFILE is what os.homedir() reads on Windows
fs.mkdirSync(path.join(HOME, '.claude'), { recursive: true });
env.HOME = env.USERPROFILE = HOME;
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

// Returns the Drift report, or null; the Device line, always first and for the agent only, goes to lastDevice.
let lastDevice;
function session(cwd) {
  const r = spawnSync('node', [DRIFT, '--session'], { input: JSON.stringify({ hook_event_name: 'SessionStart', cwd }), env, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `drift --session exited ${r.status}: ${r.stderr}`);
  const out = JSON.parse(r.stdout);
  const [first, ...rest] = out.hookSpecificOutput.additionalContext.split('\n');
  assert.ok(first.startsWith('Device: '), `no Device line first:\n${out.hookSpecificOutput.additionalContext}`);
  lastDevice = first;
  const text = rest.join('\n') || null;
  assert.strictEqual(out.systemMessage, text ?? undefined, 'owner sees the Drift report, without the Device line');
  return text;
}
const RULES = { ask: 'ask the owner with AskUserQuestion', ff: 'without asking', push: 'offer to push' };
function expect(text, has, rule, what) { // rule: 'ask', 'ff', 'push', a list of them, or false
  const want = [rule].flat().filter(Boolean);
  assert.ok(text, `${what}: no output`);
  for (const h of has) assert.ok(text.includes(h), `${what}: missing "${h}" in:\n${text}`);
  for (const [k, v] of Object.entries(RULES)) assert.strictEqual(text.includes(v), want.includes(k), `${what}: ${k} should be ${want.includes(k)}:\n${text}`);
}

// SessionStart.
assert.strictEqual(session(clone('synced')), null, 'in sync: silent');
assert.ok(lastDevice.startsWith('Device: ? '), `no device file: ${lastDevice}`);
fs.writeFileSync(path.join(HOME, '.claude', 'device'), 'mbp\r\n');
assert.strictEqual(session(T), null, 'not a repo: silent');
assert.strictEqual(lastDevice, 'Device: mbp', 'device file read and trimmed');
let d = clone('behind'); advance(d);
expect(session(d), ['branch main: behind origin/main by 1'], 'ff', 'behind, clean');
fs.writeFileSync(path.join(d, 'a.txt'), 'changed');
expect(session(d), ['branch main: behind origin/main by 1', 'uncommitted changes'], 'ask', 'behind, dirty');
d = clone('ahead'); commit(d, 'x.txt');
expect(session(d), ['branch main: ahead of origin/main by 1'], 'push', 'ahead');
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
d = clone('diverged'); advance(d); commit(d, 'y.txt');
expect(session(d), ['branch main: behind origin/main by 1, ahead of origin/main by 1'], 'ask', 'diverged: asks, never offers a push');
d = clone('wt-ahead'); commit(d, 'z.txt');
const wtAhead = path.join(d, '.claude', 'worktrees', 'x');
sh(d, 'worktree', 'add', '-q', wtAhead, '-b', 'x');
expect(session(wtAhead), ['branch x: no upstream', 'branch main: ahead of origin/main by 1'], 'push', 'worktree, main ahead');
d = clone('behind-and-ahead'); sh(d, 'checkout', '-q', '-b', 'dev'); sh(d, 'push', '-q', '-u', 'origin', 'dev'); commit(d, 'w.txt');
advance(d);
expect(session(d), ['branch dev: ahead of origin/dev by 1', 'branch main: behind origin/main by 1'], ['ff', 'push'], 'one branch behind, another ahead');
d = clone('no-remote'); sh(d, 'remote', 'remove', 'origin');
expect(session(d), ['no remote'], false, 'no remote');
assert.ok(!session(d).includes('no upstream'), 'no remote: branches are not reported as no upstream');
fs.writeFileSync(path.join(d, 'new.txt'), 'x');
expect(session(d), ['no remote', 'uncommitted changes'], false, 'no remote, uncommitted changes');
d = clone('bad-remote'); sh(d, 'remote', 'set-url', 'origin', path.join(T, 'gone.git'));
expect(session(d), ['Unknown: fetch failed'], 'ask', 'remote unreachable');
fs.mkdirSync(path.join(T, 'plain'));
assert.strictEqual(session(path.join(T, 'plain')), null, 'not a repo: silent');

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
function project(name, sha, parent) {
  const p = clone(name, parent);
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

// The drift command.
const home = path.join(T, 'home');
fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
const roots = (...lines) => fs.writeFileSync(path.join(home, '.claude', 'drift-roots'), lines.join('\n'));
function cli() {
  const r = spawnSync('node', [DRIFT], { cwd: T, env: { ...env, HOME: home, USERPROFILE: home }, encoding: 'utf8' }); // os.homedir() reads USERPROFILE on Windows
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

// Retired repos: a `!` line retires that directory and every repo under it, which are only counted.
roots(root, '!', `!${behind}x`, `!${path.join(root, 'group')}`, `!${broken}`, `  !${lonely}  `);
r = cli();
for (const p of [behind, broken, lonely]) assert.ok(!r.out.split('\n').includes(p), `retired ${p} not listed:\n${r.out}`);
assert.ok(r.out.includes(lonelyDirty), `a sibling sharing a name prefix is not retired:\n${r.out}`);
assert.ok(r.out.trimEnd().endsWith('2 with Drift, 0 Unknown, 1 no remote; 2 repos scanned, 3 retired'), `retired totals:\n${r.out}`);
assert.ok(session(broken).includes('Unknown: fetch failed'), 'a session in a retired repo still checks it');
roots(root, `!${root}`);
r = cli();
assert.strictEqual(r.code, 0, `all retired: ${JSON.stringify(r)}`);
assert.strictEqual(r.out.trim(), '0 with Drift, 0 Unknown, 0 no remote; 0 repos scanned, 5 retired', 'all retired: only the totals');

fs.mkdirSync(path.join(home, 'proj'));
clone('mine', path.join(home, 'proj'));
roots('~/proj');
assert.strictEqual(cli().code, 0, '~ expands to the home directory');
const old = clone('old', path.join(home, 'proj')); advance(old);
roots('~/proj', '!~/proj/old');
assert.ok(cli().out.trimEnd().endsWith('1 repos scanned, 1 retired'), '~ expands in a ! line');

// The drift command reports each repo's workflow.md against the kit; an old one is not Drift, an unknown sha is Unknown.
const tr = path.join(T, 'tmpl-root');
const stale = project('stale', tmplSha, tr);
project('current', head(kit), tr);
const foreign = project('foreign', 'f'.repeat(40), tr);
roots(tr);
r = cli();
assert.strictEqual(r.code, 1, `an unknown Template is Unknown: ${JSON.stringify(r)}`);
assert.ok(r.out.includes(`${stale}\n  workflow.md: older than the kit's template`), `old workflow.md:\n${r.out}`);
assert.ok(r.out.includes(`${foreign}\n  workflow.md: Template fffffff is not in the local kit`), `unknown Template:\n${r.out}`);
assert.ok(!r.out.includes(path.join(tr, 'current')), `current workflow.md not listed:\n${r.out}`);
assert.ok(r.out.trimEnd().endsWith('0 with Drift, 1 Unknown, 0 no remote, 1 with an old workflow.md; 3 repos scanned'), `template totals:\n${r.out}`);
sh(foreign, 'remote', 'set-url', 'origin', path.join(T, 'gone.git'));
r = cli();
assert.ok(r.out.trimEnd().endsWith('0 with Drift, 1 Unknown, 0 no remote, 1 with an old workflow.md; 3 repos scanned'), `Unknown once per repo:\n${r.out}`);

console.log('PASS');
