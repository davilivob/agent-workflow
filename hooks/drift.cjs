#!/usr/bin/env node
// Drift check: one check, two entry points.
//   --session  SessionStart hook: reads hook JSON on stdin, checks the session's repo, prints context for the agent.
//   (no args)  the `drift` command: scans every repo under the roots listed in ~/.claude/drift-roots.
// The only write it makes to a repo is `git fetch`. Whatever it cannot confirm is Unknown, never "no Drift".
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const FETCH_TIMEOUT = 15000; // under the 30 s hook timeout setup.sh registers
const ROOTS = path.join(os.homedir(), '.claude', 'drift-roots');
const ASK =
  'Per global.md: before changing any file, ask the owner with AskUserQuestion: `pull --ff-only`, leave it, or stop.';
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
  const s = { dir, unknown: null, noRemote: false, dirty: false, branches: [], current: null, def: 'main' };
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
    s.def = (await git(dir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).catch(() => 'origin/main'))
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

// Current branch: behind, ahead, no upstream. Default branch: behind. Behind or Unknown asks the owner first.
async function session() {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch {}
  const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  let top;
  try { top = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim(); } catch { return; } // not a repo: nothing to say
  const s = await inspect(top);
  const lines = [];
  let ask = !!s.unknown;
  if (s.unknown) lines.push(`Unknown: ${s.unknown}`);
  if (s.noRemote) lines.push('no remote');
  else for (const b of s.branches) {
    const d = b.name === s.current ? branchDrift(b) : b.name === s.def && b.behind ? `behind ${b.upstream} by ${b.behind}` : '';
    if (!d) continue;
    lines.push(`branch ${b.name}: ${d}`);
    if (b.behind) ask = true;
  }
  if (s.dirty && !s.noRemote) lines.push('uncommitted changes');
  if (!lines.length) return;
  const text = `Drift in ${top}:\n${lines.map((l) => `- ${l}`).join('\n')}${ask ? `\n${ASK}` : ''}`;
  process.stdout.write(JSON.stringify({ systemMessage: text,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
}

// A directory holding a .git directory is a repo; nothing inside it is searched.
// A .git file is a linked worktree or submodule: its branches already count in its main repo.
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
  let roots = [];
  try {
    roots = fs.readFileSync(ROOTS, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
      .map((l) => l.replace(/^~(?=$|[\\/])/, os.homedir()));
  } catch {}
  if (!roots.length) { console.error(`drift: no roots configured. ${usage}`); return 2; }
  const repos = [];
  const unreadable = [];
  const missing = roots.filter((r) => !fs.statSync(r, { throwIfNoEntry: false })?.isDirectory());
  for (const r of roots) if (!missing.includes(r)) find(r, repos, unreadable);
  for (const r of missing) console.log(`missing root: ${r}`);
  for (const d of unreadable) console.log(`${d}\n  Unknown: cannot read directory`);
  if (!repos.length) { console.error(`drift: no git repos found under ${roots.join(', ')}. ${usage}`); return 2; }

  const t = { drift: 0, unknown: unreadable.length, noRemote: 0 };
  for (const s of await pool(repos, 8, inspect)) {
    const lines = [];
    if (s.unknown) { lines.push(`Unknown: ${s.unknown}`); t.unknown++; }
    if (s.noRemote) { lines.push('no remote'); t.noRemote++; }
    else {
      const before = lines.length;
      for (const b of s.branches) { const d = branchDrift(b); if (d) lines.push(`branch ${b.name}: ${d}`); }
      if (s.dirty) lines.push('uncommitted changes');
      if (lines.length > before) t.drift++;
    }
    if (lines.length) console.log(`${s.dir}\n${lines.map((l) => `  ${l}`).join('\n')}`);
  }
  console.log(`${t.drift} with Drift, ${t.unknown} Unknown, ${t.noRemote} no remote; ${repos.length} repos scanned`);
  return missing.length || t.unknown || t.drift ? 1 : 0;
}

if (process.argv[2] === '--session') {
  session().catch((e) => { // a check that broke is Unknown, never silence
    const text = `Drift: Unknown, the check itself failed (${e.message}).\n${ASK}`;
    process.stdout.write(JSON.stringify({ systemMessage: text,
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }));
  });
} else {
  cli().then((code) => { process.exitCode = code; }, (e) => { console.error(`drift: Unknown, the check failed: ${e.message}`); process.exitCode = 2; });
}
