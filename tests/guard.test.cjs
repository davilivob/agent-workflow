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

function hook(input, extraEnv = {}) {
  const r = spawnSync('node', [GUARD], { input: JSON.stringify(input), env: { ...env, ...extraEnv }, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `guard exited ${r.status}: ${r.stderr}`);
  return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
}
const guard = (input, extraEnv) => hook(input, extraEnv)?.permissionDecision ?? 'none';
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

// push: a plain push asks, however it is written; force, delete, tag, mirror and refspec pushes are denied.
expect(bash(main, 'git push'), 'ask', 'git push');
expect(bash(main, `git -C ${wt} push origin feature`), 'ask', 'git -C push');
expect(bash(main, 'npm test && git push'), 'ask', 'push after &&');
expect(bash(main, 'git push -u origin main'), 'ask', 'push -u');
expect(bash(main, 'git push git@github.com:o/r.git main'), 'ask', 'push to an scp-style URL');
for (const p of ['-odeploy', '-o ci.skip:yes origin main', '--push-option a:b', '--receive-pack C:/x origin',
  '-uo a:b', '--repo=origin', '-- origin main']) {
  expect(bash(main, `git push ${p}`), 'ask', `git push ${p}: a value is not a flag or refspec`);
}
expect(bash(main, 'git status; git push --force'), 'deny', 'push --force after ;');
for (const p of ['-f', '-uf', '--force-with-lease', '--force-with-lease=main', '--force-if-includes', '--delete', '-d',
  '--tags', '--follow-tags', '--mirror', '--all', '--branches', '--prune', 'origin +main', 'origin :old',
  'origin HEAD:main', '-fo x', '-- origin +main']) {
  expect(bash(main, `git push ${p}`), 'deny', `git push ${p}`);
}
expect(bash(main, 'git push -f && git commit -am x'), 'deny', 'force push before a pathless commit');
expect(bash(main, "# don't forget\ngit push"), 'ask', 'apostrophe in a # comment');
expect(bash(main, 'ls # ; git push'), 'none', '; inside a # comment');
expect(bash(main, '# note\ngit commit -m msg'), 'deny', 'commit after a # comment line');

// Push policy: the `Push:` line of docs/agents/project.md, read in the repo the push runs in.
function sync(name, text) {
  const dir = repo(name);
  if (text !== null) {
    fs.mkdirSync(path.join(dir, 'docs', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'agents', 'project.md'), `# Project\r\n\r\n## Sync\r\n\r\n${text}\r\nPull: ff\r\n`);
  }
  return dir;
}
const auto = sync('auto', 'Push: auto');
expect(bash(auto, 'git push'), 'none', 'auto: push from main');
expect(bash(auto, 'git push origin main'), 'none', 'auto: push origin main');
expect(bash(auto, 'git push -u origin main'), 'none', 'auto: push -u origin main');
expect(bash(auto, 'git push origin feature'), 'ask', 'auto: push of another branch');
expect(bash(auto, 'git push origin main feature'), 'ask', 'auto: main and another branch');
expect(bash(auto, 'git push --force'), 'deny', 'auto: force push');
expect(bash(auto, 'git push && git push origin feature'), 'ask', 'auto: the strictest push wins');
expect(bash(main, `cd ${auto} && git push`), 'none', 'auto: cd into the auto repo from another');
expect(bash(auto, `cd ${main} && git push`), 'ask', 'auto: cd out of the auto repo');
expect(bash(main, `git -C ${auto} push`), 'none', 'auto: git -C the auto repo');
const autoWt = path.join(T, 'auto-wt');
sh(auto, 'worktree', 'add', '-q', autoWt, '-b', 'side');
expect(bash(autoWt, 'git push'), 'ask', 'auto: push from a branch other than main');
expect(bash(autoWt, 'git push origin main'), 'ask', 'auto: main pushed from another branch');
const owner = sync('owner', 'Push: owner');
expect(bash(owner, 'git push'), 'deny', 'owner: push');
assert.match(hook({ tool_name: 'Bash', tool_input: { command: 'git push' }, cwd: owner }).permissionDecisionReason, /hand the command over/, 'owner: the denial hands the command over');
expect(bash(auto, `git push && cd ${owner} && git push`), 'deny', 'owner: the strictest push wins');
expect(bash(sync('ask', 'Push: ask'), 'git push'), 'ask', 'ask');
expect(bash(sync('unset', 'Pull: ff'), 'git push'), 'ask', 'no Push: line');
expect(bash(sync('typo', 'Push: Auto'), 'git push'), 'ask', 'unknown value');
expect(bash(sync('none', null), 'git push'), 'ask', 'no project.md');

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

// Edits to the kit (~/.claude/kit, a symlink as on a real device): only from inside it.
const home = path.join(T, 'home');
fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
fs.symlinkSync(kit, path.join(home, '.claude', 'kit'), 'junction'); // a junction on Windows, as setup.sh makes; the type is ignored elsewhere
const kitWt = path.join(kit, '.claude', 'worktrees', 'x');
fs.mkdirSync(kitWt, { recursive: true });
const editInput = (tool, cwd, file) => ({ tool_name: tool, tool_input: tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file }, cwd });
const homeEnv = { HOME: home, USERPROFILE: home }; // os.homedir() reads USERPROFILE on Windows
const edit = (tool, cwd, file) => guard(editInput(tool, cwd, file), homeEnv);
const viaLink = (f) => path.join(home, '.claude', 'kit', f);
expect(edit('Edit', flow, viaLink('global.md')), 'deny', 'Edit kit via the symlink from another repo');
expect(edit('Write', flow, path.join(kit, 'skills', 'new', 'SKILL.md')), 'deny', 'Write a new kit file by its real path');
expect(edit('NotebookEdit', flow, viaLink('n.ipynb')), 'deny', 'NotebookEdit in the kit');
expect(edit('Write', flow, path.join(kitWt, 'global.md')), 'deny', 'Write into a kit worktree from another repo');
expect(edit('Write', flow, viaLink('inbox/2026-01-01-flow-x.md')), 'deny', 'Write into the retired inbox/');
assert.match(hook(editInput('Edit', flow, viaLink('global.md')), homeEnv).permissionDecisionReason, /\/send-request/, 'the denial points to /send-request');
expect(edit('Edit', kit, viaLink('global.md')), 'none', 'Edit from the kit checkout');
expect(edit('Edit', kitWt, path.join(kitWt, 'global.md')), 'none', 'Edit from a kit worktree');
expect(edit('Edit', flow, path.join(flow, 'a.txt')), 'none', 'Edit outside the kit');
expect(edit('Edit', flow, '../kit/global.md'), 'deny', 'relative path into the kit');
if (fs.existsSync(kit.toUpperCase())) expect(edit('Edit', flow, path.join(kit.toUpperCase(), 'global.md')), 'deny', 'other letter case, case-insensitive disk');

// Edits to the Knowledge base (~/.claude/knowledge_base.conf): from elsewhere only into its inbox.
const kb = repo('kb');
fs.mkdirSync(path.join(kb, 'inbox'));
const kbWt = path.join(kb, '.claude', 'worktrees', 'y');
fs.mkdirSync(kbWt, { recursive: true });
const conf = path.join(home, '.claude', 'knowledge_base.conf');
fs.writeFileSync(conf, `drive=elsewhere\nrepo=${kb}\ninbox=inbox\n`);
for (const tool of ['Edit', 'Write', 'NotebookEdit']) {
  expect(edit(tool, flow, path.join(kb, 'inbox', 'n.md')), 'none', `${tool} into the inbox from another repo`);
}
expect(edit('Write', flow, path.join(kb, 'notes', 'n.md')), 'deny', 'Write outside the inbox from another repo');
assert.match(hook(editInput('Write', flow, path.join(kb, 'a.txt')), homeEnv).permissionDecisionReason, /inbox/, 'the denial points to the inbox');
expect(edit('Write', kb, path.join(kb, 'notes', 'n.md')), 'none', 'Write from the Knowledge base checkout');
expect(edit('Write', kbWt, path.join(kb, 'notes', 'n.md')), 'none', 'Write from a Knowledge base worktree');
fs.mkdirSync(`${kb}-other`);
expect(edit('Edit', flow, path.join(`${kb}-other`, 'a.txt')), 'none', 'a path that only shares the prefix');
fs.writeFileSync(conf, `repo=${kb}\n`);
expect(edit('Write', flow, path.join(kb, 'notes', 'n.md')), 'none', 'conf without inbox=');
fs.rmSync(conf);
expect(edit('Write', flow, path.join(kb, 'notes', 'n.md')), 'none', 'no conf');

// Everything else, and whatever the Guard cannot read, passes.
expect(bash(main, 'ls -la'), 'none', 'ls');
expect(bash(main, 'git status'), 'none', 'git status');
expect(bash(main, 'git commit -m "unbalanced'), 'none', 'unparsable');
expect(bash(path.join(T, 'nowhere'), 'git commit -m msg'), 'none', 'git query fails');
expect(guard({ tool_name: 'Read', tool_input: { file_path: 'a' }, cwd: main }), 'none', 'other tool');

console.log('PASS');
