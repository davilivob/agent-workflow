#!/usr/bin/env node
// Drift check: one check, two entry points.
//   --session  SessionStart hook: reads hook JSON on stdin, checks the session's repo and the kit (~/.claude/kit),
//              and whether the repo's workflow.md is older than the kit's template; prints context for the agent,
//              always headed by this device's Device code (from ~/.claude/device) for the Session title.
//   (no args)  the `drift` command: scans every repo under the roots listed in ~/.claude/drift-roots,
//              except Retired repos (under a `!` line there), which it only counts.
// The only write it makes to a repo is `git fetch`. Whatever it cannot confirm is Unknown, never "no Drift".
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const FETCH_TIMEOUT = 15000;
const SESSION_DEADLINE = 25000; // under the 30 s hook timeout setup.sh registers: a killed hook would print nothing
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
  'Per global.md: offer to push each ahead branch global.md allows (`main`, or an OS-bound verification handover), in its own checkout; the Guard asks the owner. A rejected push: stop and tell the owner.';
// No password, SSH or credential-manager prompt may hang the check: a fetch that needs one fails, and so is Unknown.
// ponytail: GIT_SSH_COMMAND wins over a core.sshCommand in git config; pass that one through if a device ever uses it.
const ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never',
  GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || 'ssh -o BatchMode=yes' };

function git(cwd, args, timeout = 10000) {
  return new Promise((resolve, reject) => execFile('git', args, { cwd, env: ENV, timeout, encoding: 'utf8', windowsHide: true },
    (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      reject(new Error(err.killed ? `timed out after ${timeout / 1000}s` : (stderr || err.message).trim().split('\n')[0]));
    }));
}

// Fetches, then reads every local branch's tracking state and the working tree.
async function inspect(dir) {
  const s = { dir, unknown: null, noRemote: false, dirty: false, branches: [], current: null, defaultBranch: 'main' };
  try {
    if (!(await git(dir, ['remote'])).trim()) s.noRemote = true;
    else await git(dir, ['fetch', '--all', '--quiet'], FETCH_TIMEOUT).catch((e) => { s.unknown = `fetch failed: ${e.message}`; });
    const refs = await git(dir, ['for-each-ref', '--format=%(refname:short)%09%(upstream:short)%09%(upstream:track)', 'refs/heads']);
    for (const line of refs.split('\n').filter(Boolean)) {
      const [name, upstream, track] = line.split('\t');
      const n = (word) => Number(new RegExp(`${word} (\\d+)`).exec(track)?.[1] ?? 0);
      s.branches.push({ name, upstream: track === '[gone]' ? '' : upstream, ahead: n('ahead'), behind: n('behind') });
    }
    s.current = (await git(dir, ['branch', '--show-current'])).trim() || null; // null: detached HEAD
    s.defaultBranch = (await git(dir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).catch(() => 'origin/main'))
      .trim().replace(/^origin\//, '');
    s.dirty = !!(await git(dir, ['--no-optional-locks', 'status', '--porcelain'])).trim(); // untracked files count
  } catch (e) {
    s.unknown ??= `cannot read git state: ${e.message}`;
  }
  return s;
}

function branchDrift(b) {
  if (!b.upstream) return 'no upstream';
  return [b.behind && `behind ${b.upstream} by ${b.behind}`, b.ahead && `ahead of ${b.upstream} by ${b.ahead}`]
    .filter(Boolean).join(', ');
}

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

function device() {
  let code = '';
  try { code = fs.readFileSync(DEVICE, 'utf8').trim(); } catch {}
  return code ? `Device: ${code}` : `Device: ? (no Device code in ${DEVICE})`;
}

// Written synchronously: the deadline below exits right after. The Device line is for the agent only.
function emit(text) {
  const out = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text ? `${device()}\n${text}` : device() } };
  if (text) out.systemMessage = text;
  fs.writeSync(1, JSON.stringify(out));
}

// A directory holding a .git directory is a repo; nothing inside it is searched.
// A .git file is a linked worktree or submodule: its branches already count in its main repo.
// ponytail: symlinked and junction directories are not followed (no loop guard needed); list their targets as roots instead.
function find(dir, repos, unreadable) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { unreadable.push(dir); return; }
  const dotGit = entries.find((e) => e.name === '.git');
  if (dotGit) { if (dotGit.isDirectory()) repos.push(dir); return; }
  for (const e of entries) if (e.isDirectory() && e.name !== 'node_modules') find(path.join(dir, e.name), repos, unreadable);
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// Every local branch: behind, ahead, no upstream. Lists only repos with something to say, then the totals.
async function cli() {
  const usage = `Create ${ROOTS} with one directory per line, each holding your repos, e.g.\n  ${path.join(os.homedir(), 'proj')}`;
  const roots = [];
  const retired = [];
  // ponytail: case is folded on Windows only and symlinks are not resolved; use realpath if a ! line ever misses.
  const key = (p) => { const k = path.resolve(p); return process.platform === 'win32' ? k.toLowerCase() : k; };
  try {
    for (let l of fs.readFileSync(ROOTS, 'utf8').split(/\r?\n/).map((l) => l.trim())) {
      if (!l || l.startsWith('#')) continue;
      const retire = l.startsWith('!');
      l = (retire ? l.slice(1).trim() : l).replace(/^~(?=$|[\\/])/, os.homedir());
      if (retire) { if (l) retired.push(key(l)); } else roots.push(l); // a bare ! names nothing
    }
  } catch {}
  // A `!` line retires that directory and every repo under it: found and counted, never inspected.
  const isRetired = (dir) => {
    const k = key(dir);
    return retired.some((r) => k === r || k.startsWith(r.endsWith(path.sep) ? r : r + path.sep)); // a drive root ends in sep
  };
  if (!roots.length) { console.error(`drift: no roots configured. ${usage}`); return 2; }
  let repos = [];
  let unreadable = [];
  const missing = roots.filter((r) => !fs.statSync(r, { throwIfNoEntry: false })?.isDirectory());
  for (const r of roots) if (!missing.includes(r)) find(r, repos, unreadable);
  const found = repos.length;
  repos = repos.filter((d) => !isRetired(d));
  unreadable = unreadable.filter((d) => !isRetired(d));
  for (const r of missing) console.log(`missing root: ${r}`);
  for (const d of unreadable) console.log(`${d}\n  Unknown: cannot read directory`);
  if (!found) { console.error(`drift: no git repos found under ${roots.join(', ')}. ${usage}`); return 2; }

  const totals = { drift: 0, unknown: unreadable.length, noRemote: 0 };
  for (const s of await pool(repos, 8, inspect)) {
    const lines = [];
    if (s.unknown) { lines.push(`Unknown: ${s.unknown}`); totals.unknown++; }
    if (s.noRemote) { lines.push('no remote'); totals.noRemote++; }
    const before = lines.length;
    if (!s.noRemote) for (const b of s.branches) { const d = branchDrift(b); if (d) lines.push(`branch ${b.name}: ${d}`); }
    if (s.dirty) lines.push('uncommitted changes');
    if (lines.length > before) totals.drift++;
    if (lines.length) console.log(`${s.dir}\n${lines.map((l) => `  ${l}`).join('\n')}`);
  }
  console.log(`${totals.drift} with Drift, ${totals.unknown} Unknown, ${totals.noRemote} no remote; ${repos.length} repos scanned${found > repos.length ? `, ${found - repos.length} retired` : ''}`);
  return missing.length || totals.unknown || totals.drift ? 1 : 0;
}

if (process.argv[2] === '--session') { // a check that broke or ran out of time is Unknown, never silence
  const deadline = setTimeout(() => {
    emit(`Drift check: Unknown, it did not finish within ${SESSION_DEADLINE / 1000}s.\n${ASK}`);
    process.exit(0);
  }, SESSION_DEADLINE);
  session().then(emit, (e) => emit(`Drift check: Unknown, the check itself failed (${e.message}).\n${ASK}`))
    .finally(() => clearTimeout(deadline));
} else {
  cli().then((code) => { process.exitCode = code; }, (e) => { console.error(`drift: Unknown, the check failed: ${e.message}`); process.exitCode = 2; });
}
