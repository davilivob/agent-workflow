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
// The Session title reminder, always second and for the agent only, is checked here.
let lastDevice, lastOwner;
let lastTitle;
function session(cwd, source) {
  const r = spawnSync('node', [DRIFT, '--session'], { input: JSON.stringify({ hook_event_name: 'SessionStart', cwd, source }), env, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `drift --session exited ${r.status}: ${r.stderr}`);
  const out = JSON.parse(r.stdout);
  const [first, title, ...rest] = out.hookSpecificOutput.additionalContext.split('\n');
  assert.ok(first.startsWith('Device: '), `no Device line first:\n${out.hookSpecificOutput.additionalContext}`);
  assert.ok(title.startsWith('Session title: ') && title.includes('set_session_title'), `no Session title reminder second:\n${out.hookSpecificOutput.additionalContext}`);
  lastDevice = first;
  lastTitle = title;
  const text = rest.join('\n') || null;
  assert.strictEqual(!!out.systemMessage, !!text, 'owner sees a report exactly when the agent does');
  if (text) assert.ok(!/Per global\.md|Device: |Session title: /.test(out.systemMessage), `owner sees the facts only:\n${out.systemMessage}`);
  lastOwner = out.systemMessage;
  return text;
}
const RULES = { ask: 'ask the owner with AskUserQuestion', ff: 'without asking', push: 'offer to push',
  rebase: 'git pull --rebase', auto: 'without offering', owner: 'hand the push command' };
function expect(text, has, rule, what) { // rule: a key of RULES, a list of them, or false
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
assert.ok(!lastTitle.includes('Cleared'), 'startup: no Cleared title');
session(T, 'clear');
assert.ok(lastTitle.includes('[<Device code>] Cleared'), `clear: the title is Cleared until the work is known:\n${lastTitle}`);
assert.strictEqual(lastDevice, 'Device: mbp', 'device file read and trimmed');
let d = clone('behind'); advance(d);
expect(session(d), ['branch main: behind origin/main by 1'], 'ff', 'behind, clean');
assert.ok(lastOwner.endsWith('\n- 分支 main：落後 origin/main 1 個 commit'), `owner's copy in Chinese:\n${lastOwner}`);
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

// Push policy and Pull policy, from `## Sync` in the repo's docs/agents/project.md (committed, as in a real repo).
function sync(dir, text) {
  fs.mkdirSync(path.join(dir, 'docs', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'agents', 'project.md'), `# Project\r\n\r\n## Sync\r\n\r\n${text}\r\n`);
  sh(dir, 'add', 'docs'); sh(dir, 'commit', '-q', '-m', 'sync'); sh(dir, 'push', '-q');
  return dir;
}
d = sync(clone('rebase-diverged'), 'Push: ask\r\nPull: rebase'); advance(d); commit(d, 'y.txt');
expect(session(d), ['branch main: behind origin/main by 1, ahead of origin/main by 1', 'Rebase rule'], 'rebase', 'Pull: rebase, main diverged: rebases, does not ask');
fs.writeFileSync(path.join(d, 'a.txt'), 'changed');
expect(session(d), ['uncommitted changes', 'uncommitted changes, or another local branch'], 'rebase', 'Pull: rebase, main diverged, dirty: the Rebase rule, which asks; never `pull --ff-only`');
d = sync(clone('rebase-ahead'), 'Pull: rebase'); commit(d, 'x.txt');
expect(session(d), ['branch main: ahead of origin/main by 1', 'A rejected push of `main`: the Rebase rule'], 'push', 'Pull: rebase, ahead: a rejected push rebases');
d = sync(clone('rebase-dev'), 'Pull: rebase');
sh(d, 'checkout', '-q', '-b', 'dev'); sh(d, 'push', '-q', '-u', 'origin', 'dev'); advance(d, 'dev'); commit(d, 'v.txt');
expect(session(d), ['branch dev: behind origin/dev by 1, ahead of origin/dev by 1'], 'ask', 'Pull: rebase, another branch diverged: asks');
d = sync(clone('ff-diverged'), 'Pull: ff'); advance(d); commit(d, 'y.txt');
expect(session(d), ['branch main: behind'], 'ask', 'Pull: ff, main diverged: asks');
d = sync(clone('typo-diverged'), 'Pull: Rebase'); advance(d); commit(d, 'y.txt');
expect(session(d), ['branch main: behind'], 'ask', 'unknown Pull value: ff');
d = sync(clone('auto-ahead'), 'Push: auto'); commit(d, 'x.txt');
expect(session(d), ['branch main: ahead of origin/main by 1', 'A rejected push: stop'], 'auto', 'Push: auto, ahead: pushes without offering');
d = sync(clone('owner-ahead'), 'Push: owner\r\nPull: rebase'); commit(d, 'x.txt');
const ownerText = session(d);
expect(ownerText, ['branch main: ahead of origin/main by 1'], 'owner', 'Push: owner, ahead: hands the command over');
assert.ok(!ownerText.includes('rejected'), `Push: owner: no rejected push to handle:\n${ownerText}`);
d = sync(clone('auto-behind'), 'Push: auto'); advance(d);
expect(session(d), ['branch main: behind origin/main by 1'], 'ff', 'Push: auto, behind: fast-forwards');

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
sync(p, 'Push: owner'); commit(kit, 'k2.txt');
expect(session(p), [`Drift check for the kit (${kit})`, 'branch main: ahead of origin/main by 2'], 'push', "the kit's block follows the kit's own Push policy, not the project's");
let k = session(kit);
assert.ok(!k.includes('Drift check for the kit'), `session in the kit: checked once:\n${k}`);
expect(k, [`Drift check for ${kit}`, 'branch main: ahead of origin/main by 2'], 'push', 'session in the kit');
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

// The watch entry: drift --watch. A fresh home naming this device `studio`, and a fake `gh` first on PATH reading gh.json.
const WH = path.join(T, 'watch-home');
fs.mkdirSync(path.join(WH, '.claude'), { recursive: true });
fs.writeFileSync(path.join(WH, '.claude', 'device'), 'studio\n');
const BIN = path.join(T, 'fakebin');
fs.mkdirSync(BIN);
fs.writeFileSync(path.join(BIN, 'gh'), `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const f = JSON.parse(fs.readFileSync(path.join(__dirname, 'gh.json'), 'utf8'));
const [a, b] = process.argv.slice(2);
if (a === 'api' && b === 'user') {
  if (f.user == null) { console.error('gh: not logged in'); process.exit(1); }
  console.log(f.user);
} else if (a === 'issue' && b === 'list') {
  const r = path.basename(process.cwd());
  if (f.fail.includes(r)) { console.error('gh: cannot list ' + r); process.exit(1); }
  console.log(JSON.stringify(f.issues[r] || []));
} else { console.error('fake gh: unexpected ' + process.argv.slice(2).join(' ')); process.exit(1); }
`, { mode: 0o755 });
fs.writeFileSync(path.join(BIN, 'gh.cmd'), '@node "%~dp0gh" %*\r\n');
const fixture = (f) => fs.writeFileSync(path.join(BIN, 'gh.json'), JSON.stringify({ user: 'me', fail: [], issues: {}, ...f }));
const STATE = path.join(WH, '.claude', 'request-watch.json');
function watch() {
  const r = spawnSync('node', [DRIFT, '--watch'], { cwd: T, encoding: 'utf8',
    env: { ...env, HOME: WH, USERPROFILE: WH, PATH: `${BIN}${path.delimiter}${env.PATH}` } });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch {}
  return { code: r.status, json, err: r.stderr };
}
// A repo under the watch root whose project.md has `Request watch: <value>` under ## Sync (no such line when value is null).
const WR = path.join(T, 'watch-root');
const watched = (name, value) => sync(clone(name, WR), value === null ? 'Push: ask' : `Push: ask\r\nRequest watch: ${value}`);
const GOOD = 'From: x/y @ abc1234\n\n## What\n\nchange it\n';
const ask = (number, body, login = 'me') => ({ number, title: `t${number}`, url: `https://x/${number}`, author: { login }, body });

const on = watched('on', 'studio');
const others = ['other', 'off', 'none', 'typo', 'retired'].map((n, i) => watched(n, ['mbp', 'off', null, 'Studio', 'studio'][i]));
sh(on, 'commit', '-q', '--allow-empty', '-m', 'fix it\n\nFixes #12'); // unpushed: main only ahead
const wBehind = watched('w-behind', 'studio'); advance(wBehind);
const wDiverged = watched('w-diverged', 'studio'); advance(wDiverged); commit(wDiverged, 'y.txt');
const wDirty = watched('w-dirty', 'studio'); fs.writeFileSync(path.join(wDirty, 'a.txt'), 'changed');
const wWorktree = watched('w-worktree', 'studio');
sh(wWorktree, 'worktree', 'add', '-q', path.join(wWorktree, '.claude', 'worktrees', 'x'), '-b', 'x');
const wPlan = watched('w-plan', 'studio');
fs.mkdirSync(path.join(wPlan, '.scratch', 's'), { recursive: true });
fs.writeFileSync(path.join(wPlan, '.scratch', 's', 'plan.md'), 'plan');
const wFeature = watched('w-feature', 'studio'); sh(wFeature, 'checkout', '-q', '-b', 'feature');
const wGhFail = watched('w-ghfail', 'studio');
const missingRoot = path.join(T, 'watch-missing');
fs.writeFileSync(path.join(WH, '.claude', 'drift-roots'), [WR, missingRoot, `!${path.join(WR, 'retired')}`].join('\n'));
fixture({ fail: ['w-ghfail'], issues: { on: [
  ask(1, GOOD), ask(2, GOOD, 'stranger'), ask(3, '## What\n\nx\n'), ask(4, 'From: x/y @ abc1234\n\nchange it\n'),
  ask(5, 'From: x/y @ abc1234\n\n## Whatever\n\nx\n'), ask(7, 'see From: x mid-line\n\n## What\n\nx\n'),
  ask(8, '`From: x` and `## What`\n'), ask(6, GOOD), ask(12, GOOD), ask(120, GOOD),
] } });

let w = watch();
assert.strictEqual(w.code, 0, `watch: ${JSON.stringify(w)}`);
const repo = (dir) => w.json.repos.find((x) => x.dir === dir) ?? assert.fail(`${dir} not in:\n${JSON.stringify(w.json, null, 1)}`);
assert.strictEqual(w.json.device, 'studio');
assert.strictEqual(w.json.owner, 'me');
assert.strictEqual(w.json.state, STATE);
const listed = w.json.repos.map((x) => x.dir).filter((dir) => [on, ...others].includes(dir)).sort();
assert.deepStrictEqual(listed, [on].sort(), 'only repos naming this device exactly, Retired ones left out');
assert.deepStrictEqual({ ...repo(missingRoot), dir: undefined }, { dir: undefined, repo: null, branch: null, status: 'unknown',
  reason: 'missing root', notify: true, issues: [] }, 'a missing root is Unknown');
assert.strictEqual(repo(on).status, 'ok', `main only ahead is not a skip: ${JSON.stringify(repo(on))}`);
assert.strictEqual(repo(on).branch, 'main');
assert.ok(/^[^/]+\/remote-\d+$/.test(repo(on).repo), `owner/name from the origin URL: ${repo(on).repo}`);
const issue = (num) => repo(on).issues.find((i) => i.number === num);
const pick = (num) => ({ candidate: issue(num).candidate, handled: issue(num).handled });
assert.deepStrictEqual(issue(1), { number: 1, title: 't1', url: 'https://x/1', author: 'me', candidate: true, handled: null });
assert.deepStrictEqual(pick(1), { candidate: true, handled: null });
assert.strictEqual(issue(2).reason, 'not filed by the owner');
assert.strictEqual(issue(3).reason, 'no From: line');
assert.strictEqual(issue(4).reason, 'no ## What');
assert.strictEqual(issue(5).reason, 'no ## What', 'a ## Whatever heading is not ## What');
assert.strictEqual(issue(7).reason, 'no From: line', 'From: mid-line is not a From: line');
assert.ok(!issue(8).candidate, 'in a code span: not the format');
assert.strictEqual(issue(6).handled, null, 'not in the state file yet');
assert.strictEqual(issue(12).handled, 'applied', 'Fixes #12 on local main');
assert.strictEqual(issue(120).handled, null, 'Fixes #12 does not mark #120');
const skips = [[wBehind, 'behind'], [wDiverged, 'behind'], [wDiverged, 'ahead'], [wDirty, 'uncommitted changes'],
  [wWorktree, 'Claim'], [wPlan, 'Claim'], [wFeature, 'feature']];
for (const [dir, word] of skips) {
  assert.strictEqual(repo(dir).status, 'skipped', `${dir}: ${JSON.stringify(repo(dir))}`);
  assert.ok(repo(dir).reason.includes(word), `${dir}: "${word}" not in ${repo(dir).reason}`);
  assert.deepStrictEqual(repo(dir).issues, []);
  assert.strictEqual(repo(dir).notify, true, 'a reason not in the state file is notified');
}
assert.ok(!repo(wWorktree).reason.includes('uncommitted') && !repo(wPlan).reason.includes('uncommitted'), 'a Claim explains the untracked files');
assert.strictEqual(repo(wWorktree).reason, 'Claim: worktree x');
assert.strictEqual(repo(wPlan).reason, 'Claim: .scratch/s/plan.md not committed');
assert.strictEqual(repo(wGhFail).status, 'unknown');
assert.ok(repo(wGhFail).reason.startsWith('gh issue list failed: gh: cannot list w-ghfail'), repo(wGhFail).reason);
assert.ok(!('reason' in repo(on)) && !('notify' in repo(on)), 'an ok repo has no reason and no notify');

// The state file: handled Requests, and the skip reasons notified last run.
const key = `${repo(on).repo}#6`;
fs.writeFileSync(STATE, JSON.stringify({ requests: { [key]: { result: 'notified', at: '2026-01-01T00:00:00Z' } },
  skips: { [wBehind]: repo(wBehind).reason, [wDirty]: 'something else' } }));
w = watch();
assert.strictEqual(issue(6).handled, 'notified', 'in the state file');
assert.strictEqual(repo(wBehind).notify, false, 'the same reason as last run: not notified again');
assert.strictEqual(repo(wDirty).notify, true, 'a changed reason is notified');

fixture({ user: null });
w = watch();
assert.strictEqual(w.code, 0);
assert.strictEqual(w.json.owner, null);
for (const x of w.json.repos) assert.strictEqual(x.status, 'unknown', `gh api user failed: ${JSON.stringify(x)}`);
assert.ok(repo(on).reason.startsWith('gh api user failed: gh: not logged in'), repo(on).reason);

fs.writeFileSync(STATE, 'not json{');
w = watch();
assert.ok(w.code === 2 && w.err.includes('request-watch.json') && !w.json, `corrupt state: ${JSON.stringify(w)}`);
fs.rmSync(STATE);
fs.rmSync(path.join(WH, '.claude', 'device'));
w = watch();
assert.ok(w.code === 2 && w.err.includes('device') && !w.json, `no device: ${JSON.stringify(w)}`);

console.log('PASS');
