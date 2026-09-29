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
expect(bash(main, "# don't forget\ngit push"), 'ask', 'apostrophe in a # comment');
expect(bash(main, 'ls # ; git push'), 'none', '; inside a # comment');
expect(bash(main, '# note\ngit commit -m msg'), 'deny', 'commit after a # comment line');

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
