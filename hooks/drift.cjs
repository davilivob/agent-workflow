#!/usr/bin/env node
// Drift check: one check, three entry points.
//   --session  SessionStart hook: reads hook JSON on stdin, checks the session's repo and the kit (~/.claude/kit),
//              and whether the repo's workflow.md is older than the kit's template; prints context for the agent,
//              always headed by this device's Device code (from ~/.claude/device) and a reminder to set the Session title;
//              after /clear it also sets the Session title to `[<Device code>] Cleared` itself.
//   --prompt   UserPromptSubmit hook: a one-line reminder to update the Session title when the Phase or topic changes.
//   (no args)  the `drift` command: scans every repo under the roots listed in ~/.claude/drift-roots,
//              except Retired repos (under a `!` line there), which it only counts; also says which repos'
//              workflow.md is older than the kit's template (not counted as Drift).
//   --watch    the Request watch's candidate list: for every scanned repo whose project.md says `Request watch: <this Device code>`,
//              its skip reason or its open issues (via `gh`), each marked candidate or not and handled or not, as one JSON object.
// The rules --session prints are copies of global.md's, picked by the repo's Push policy and Pull policy: change both together.
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
const STATE = path.join(os.homedir(), '.claude', 'request-watch.json');
// Copies of the Drift rules in global.md, which stays the source: change both together.
// Which ones print follows the repo's Push policy and Pull policy (`## Sync` in its docs/agents/project.md).
const ASK =
  'Per global.md: before changing any file, ask the owner with AskUserQuestion: `pull --ff-only`, leave it, or stop.';
const FF =
  'Per global.md: fast-forward each behind branch with `pull --ff-only` without asking, in its own checkout if that one is clean, ' +
  'and report it in one line; a dirty checkout: ask first. If a fast-forward fails, stop and tell the owner.';
const PUSH = {
  ask: 'Per global.md (Push: ask): offer to push each ahead branch global.md allows (`main`, or an OS-bound verification handover), in its own checkout; the Guard asks the owner.',
  auto: 'Per global.md (Push: auto): push `main` now if it is ahead, in its own checkout, without offering; the Guard lets it through. ' +
    'Any other ahead branch global.md allows (an OS-bound verification handover): offer it; the Guard asks the owner.',
  owner: 'Per global.md (Push: owner): every push is the owner\'s; hand the push command for each ahead branch over, never run it.',
};
const REJECTED = {
  ff: ' A rejected push: stop and tell the owner.',
  rebase: ' A rejected push of `main`: the Rebase rule below; of any other branch: stop and tell the owner.',
};
const REBASE =
  'Per global.md, the Rebase rule (Pull: rebase): when `main` is both behind and ahead, or a push of it is rejected, rebase it at once ' +
  'with `git pull --rebase` in its own checkout, then push again right away, as the Push policy says. Instead, change nothing and use ' +
  'AskUserQuestion when that checkout has uncommitted changes, or another local branch or worktree contains a `main` commit its upstream lacks. ' +
  'A conflict: `git rebase --abort`, then use AskUserQuestion. A push rejected again: stop and tell the owner; never rebase twice.';
// No password, SSH or credential-manager prompt may hang the check: a fetch that needs one fails, and so is Unknown.
// ponytail: GIT_SSH_COMMAND wins over a core.sshCommand in git config; pass that one through if a device ever uses it.
const ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never',
  GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || 'ssh -o BatchMode=yes' };

function gh(cwd, args) {
  return new Promise((resolve, reject) => execFile('gh', args,
    { cwd, env: ENV, timeout: 20000, encoding: 'utf8', windowsHide: true, shell: process.platform === 'win32' },
    (err, stdout, stderr) => {
      if (!err) return resolve(stdout);
      reject(new Error(err.killed ? 'timed out after 20s' : (stderr || err.message).trim().split('\n')[0]));
    }));
}

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

// The repo's Push policy and Pull policy, read as the Guard reads Push: anything unreadable or unknown is the default.
// ponytail: the first line-start `Push:`/`Pull:` anywhere in the file counts, not only under `## Sync`; scope it if a repo ever trips on it.
function policies(top) {
  let text = '';
  try { text = fs.readFileSync(path.join(top, 'docs', 'agents', 'project.md'), 'utf8'); } catch {}
  const read = (key, allowed) => {
    const v = new RegExp(`^${key}:[ \\t]*(\\S+)[ \\t]*\\r?$`, 'm').exec(text)?.[1];
    return allowed.includes(v) ? v : allowed[0];
  };
  return { push: read('Push', ['ask', 'owner', 'auto']), pull: read('Pull', ['ff', 'rebase']) };
}

// The Device code that watches this repo's Requests; no line or an unreadable file: off.
function watchDevice(top) {
  let text = '';
  try { text = fs.readFileSync(path.join(top, 'docs', 'agents', 'project.md'), 'utf8'); } catch {}
  return /^Request watch:[ \t]*(\S+)[ \t]*\r?$/m.exec(text)?.[1] ?? 'off';
}

// One repo's Drift. Current branch: behind, ahead, no upstream; default branch: behind, ahead.
// Unknown, a branch both behind and ahead, or behind with uncommitted changes asks the owner; behind fast-forwards;
// ahead pushes as the Push policy says. `main` both behind and ahead under `Pull: rebase` follows the Rebase rule instead.
function report(s, p) {
  const lines = [];
  let behind = false, ahead = false, diverged = false, mainDiverged = false;
  if (s.unknown) lines.push(`Unknown: ${s.unknown}`);
  if (s.noRemote) lines.push('no remote');
  else for (const b of s.branches) {
    const d = b.name === s.current ? branchDrift(b) : b.name === s.defaultBranch && b.upstream ? branchDrift(b) : '';
    if (!d) continue;
    lines.push(`branch ${b.name}: ${d}`);
    if (b.behind && b.ahead && b.name === 'main' && p.pull === 'rebase') mainDiverged = true;
    else if (b.behind && b.ahead) diverged = true;
    else if (b.behind) behind = true;
    else if (b.ahead) ahead = true;
  }
  if (s.dirty) lines.push('uncommitted changes');
  const push = PUSH[p.push] + (p.push === 'owner' ? '' : REJECTED[p.pull]);
  // `main` diverged and dirty still prints REBASE, which says to ask: ASK's `pull --ff-only` cannot work there.
  const rules = s.unknown || diverged || (behind && s.dirty) ? [ASK]
    : [mainDiverged && REBASE, behind && FF, ahead && push].filter(Boolean);
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
    return { unknown: true, line: `workflow.md: Template ${sha.slice(0, 7)} is not in the local kit, which may be behind` };
  const changed = await git(kit, ['diff', '--quiet', sha, 'HEAD', '--', 'templates/workflow.md']).then(() => false, () => true);
  return changed ? { unknown: false, line: "workflow.md: older than the kit's template; suggest /sync-workflow, do not run it" } : null;
}

async function session() {
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch {}
  const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd(); // cwd first, as in the Guard: it names the worktree
  let top;
  try { top = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim(); } catch { return null; } // not a repo: nothing to say
  const kit = await kitDir(top);
  // In parallel: the kit's fetch shares the session repo's deadline.
  const [s, k, t] = await Promise.all([inspect(top), kit && inspect(kit), kit && template(top, kit)]);
  const blocks = [];
  const r = report(s, policies(top));
  if (t) r.lines.push(t.line);
  if (r.lines.length) blocks.push(block(`Drift check for ${top}`, r));
  const kr = k && report(k, policies(kit)); // the kit follows its own project.md
  if (kr?.lines.length) blocks.push(block(`Drift check for the kit (${kit})`, kr));
  return blocks.length ? blocks.join('\n') : null;
}

function deviceCode() {
  try { return fs.readFileSync(DEVICE, 'utf8').trim(); } catch { return ''; }
}

function device() {
  const code = deviceCode();
  return code ? `Device: ${code}` : `Device: ? (no Device code in ${DEVICE})`;
}

// Said here, at session start, because the rule in global.md alone gets skipped: the tool is deferred.
const LOAD = 'The tool is deferred; load it first with ToolSearch "select:mcp__ccd_session_mgmt__set_session_title". Without that tool, skip it.';
const TITLE = `Session title: set it now with set_session_title (session self): [<Device code>] <Phase> · <topic>, as global.md says. ${LOAD}`;
// After /clear the work is not known yet, so emit() sets the title to Cleared itself: the agent only acts once a prompt arrives.
const CLEARED = `Session title: the session was just cleared and this hook set it to [<Device code>] Cleared; once the work is known, set it with set_session_title (session self) to [<Device code>] <Phase> · <topic>, as global.md says. ${LOAD}`;
// Said at every prompt, because nothing else fires when the topic changes mid-session.
const PROMPT = 'Session title: if this message changes the Phase or topic, first update it with set_session_title (session self), as global.md says; the tool is deferred: ToolSearch "select:mcp__ccd_session_mgmt__set_session_title".';
let input = {}; // the hook JSON, read by session()

// The owner's copy of the report, in Traditional Chinese: the facts only, since the `Per global.md` rules are the agent's.
// A line no pattern matches (a git error message) stays as it is.
const ZH = [
  [/^Drift check for the kit \((.*)\):$/, 'Drift 檢查：kit（$1）'],
  [/^Drift check for (.*):$/, 'Drift 檢查：$1'],
  [/^Drift check: Unknown, it did not finish within (\d+)s\.$/, 'Drift 檢查：無法確認，$1 秒內沒跑完。'],
  [/^Drift check: Unknown, the check itself failed \((.*)\)\.$/, 'Drift 檢查：無法確認，檢查本身失敗（$1）。'],
  [/^- Unknown: /, '- 無法確認：'],
  [/^- no remote$/, '- 沒有 remote'],
  [/^- uncommitted changes$/, '- 有未 commit 的變更'],
  [/^- workflow\.md: older than the kit's template; suggest \/sync-workflow, do not run it$/, '- workflow.md 比 kit 的範本舊，建議跑 /sync-workflow'],
  [/^- workflow\.md: Template (\w+) is not in the local kit, which may be behind$/, '- workflow.md 的 Template $1 不在本機 kit 裡，kit 可能落後'],
  [/^- branch (.*?): /, '- 分支 $1：'],
  [/no upstream/, '沒有 upstream'],
  [/behind (\S+) by (\d+)/, '落後 $1 $2 個 commit'],
  [/, ahead of /, '、ahead of '],
  [/ahead of (\S+) by (\d+)/, '領先 $1 $2 個 commit'],
];
const zh = (text) => text.split('\n').filter((l) => !l.startsWith('Per global.md'))
  .map((l) => ZH.reduce((acc, [re, to]) => acc.replace(re, to), l)).join('\n');

// Written synchronously: the deadline below exits right after. The Device and Session title lines are for the agent only.
function emit(text) {
  const clear = input.source === 'clear';
  const head = `${device()}\n${clear ? CLEARED : TITLE}`;
  const out = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text ? `${head}\n${text}` : head } };
  if (clear) out.hookSpecificOutput.sessionTitle = `[${deviceCode() || '?'}] Cleared`;
  if (text) out.systemMessage = zh(text);
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

const USAGE = `Create ${ROOTS} with one directory per line, each holding your repos, e.g.\n  ${path.join(os.homedir(), 'proj')}`;

// The repos under the roots in ~/.claude/drift-roots, Retired ones left out (`found` counts them too).
function scan() {
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
  if (!roots.length) return { error: `drift: no roots configured. ${USAGE}`, repos: [], missing: [], unreadable: [], found: 0 };
  let repos = [];
  let unreadable = [];
  const missing = roots.filter((r) => !fs.statSync(r, { throwIfNoEntry: false })?.isDirectory());
  for (const r of roots) if (!missing.includes(r)) find(r, repos, unreadable);
  const found = repos.length;
  repos = repos.filter((d) => !isRetired(d));
  unreadable = unreadable.filter((d) => !isRetired(d));
  return { roots, repos, missing, unreadable, found };
}

// Every local branch: behind, ahead, no upstream. Lists only repos with something to say, then the totals.
async function cli() {
  const { error, roots, repos, missing, unreadable, found } = scan();
  if (error) { console.error(error); return 2; }
  for (const r of missing) console.log(`missing root: ${r}`);
  for (const d of unreadable) console.log(`${d}\n  Unknown: cannot read directory`);
  if (!found) { console.error(`drift: no git repos found under ${roots.join(', ')}. ${USAGE}`); return 2; }

  let kit = null;
  try { kit = fs.realpathSync(KIT); } catch {} // no kit on this device: no template check
  const totals = { drift: 0, unknown: unreadable.length, noRemote: 0, oldWorkflow: 0 };
  for (const s of await pool(repos, 8, async (d) => ({ ...(await inspect(d)), t: kit && (await template(d, kit)) }))) {
    const lines = [];
    if (s.unknown) lines.push(`Unknown: ${s.unknown}`);
    if (s.unknown || s.t?.unknown) totals.unknown++; // once per repo, as Drift is
    if (s.t) { lines.push(s.t.line); if (!s.t.unknown) totals.oldWorkflow++; }
    if (s.noRemote) { lines.push('no remote'); totals.noRemote++; }
    const before = lines.length;
    if (!s.noRemote) for (const b of s.branches) { const d = branchDrift(b); if (d) lines.push(`branch ${b.name}: ${d}`); }
    if (s.dirty) lines.push('uncommitted changes');
    if (lines.length > before) totals.drift++;
    if (lines.length) console.log(`${s.dir}\n${lines.map((l) => `  ${l}`).join('\n')}`);
  }
  console.log(`${totals.drift} with Drift, ${totals.unknown} Unknown, ${totals.noRemote} no remote${totals.oldWorkflow ? `, ${totals.oldWorkflow} with an old workflow.md` : ''}; ${repos.length} repos scanned${found > repos.length ? `, ${found - repos.length} retired` : ''}`);
  return missing.length || totals.unknown || totals.drift ? 1 : 0;
}

// What a working session leaves in a repo: a worktree under .claude/worktrees/, or a plan.md not yet committed.
async function claims(dir) {
  const out = [];
  const linked = (await git(dir, ['worktree', 'list', '--porcelain'])).split(/\r?\n\r?\n/).slice(1); // the first is the main checkout
  for (const w of linked) { const m = /^worktree .*[\\/]\.claude[\\/]worktrees[\\/](.+?)\r?$/m.exec(w); if (m) out.push(`Claim: worktree ${m[1]}`); }
  for (const m of (await git(dir, ['--no-optional-locks', 'status', '--porcelain', '-uall', '--', '.scratch'])).matchAll(/^.. (\.scratch\/[^/]+\/plan\.md)\r?$/gm))
    out.push(`Claim: ${m[1]} not committed`);
  return out;
}

// A repo the watch does not look into this run; notified only when the reason differs from the last run's.
const notOk = (r, state, status, reason) => ({ ...r, status, reason, notify: reason !== state.skips?.[r.dir], issues: [] });

// One watched repo: skipped (with why), Unknown, or ok with its open issues marked.
async function watchRepo(dir, owner, state) {
  const r = { dir, repo: null, branch: null, status: 'ok', issues: [] };
  const not = (status, reason) => notOk(r, state, status, reason);
  r.repo = /([^/:]+\/[^/:]+?)(?:\.git)?$/.exec((await git(dir, ['remote', 'get-url', 'origin']).catch(() => '')).trim())?.[1] ?? null;
  if (owner.error) return not('unknown', `gh api user failed: ${owner.error}`);
  const s = await inspect(dir);
  if (s.unknown || s.noRemote) return not('unknown', s.unknown || 'no remote');
  r.branch = s.defaultBranch;
  const reasons = [];
  if (s.current !== s.defaultBranch) reasons.push(`main checkout is on ${s.current ?? 'a detached HEAD'}`);
  const main = s.branches.find((b) => b.name === s.defaultBranch);
  if (main?.behind) reasons.push(`branch ${main.name}: ${branchDrift(main)}`); // ahead alone: the watch merges onto it
  const c = await claims(dir).catch((e) => [`cannot read Claims: ${e.message}`]);
  reasons.push(...c);
  if (s.dirty && !c.length) reasons.push('uncommitted changes');
  if (reasons.length) return not('skipped', reasons.join('; '));
  let list;
  try { list = JSON.parse(await gh(dir, ['issue', 'list', '--state', 'open', '--limit', '200', '--json', 'number,title,url,author,body'])); }
  catch (e) { return not('unknown', `gh issue list failed: ${e.message}`); }
  // One log for every issue: the bodies of the commits on the default branch that say `Fixes #<n>`.
  let fixes;
  try { fixes = await git(dir, ['log', s.defaultBranch, '-E', '--grep=Fixes #[0-9]', '--format=%B']); }
  catch (e) { return not('unknown', `git log failed: ${e.message}`); }
  r.issues = list.map((i) => {
    const body = i.body || '';
    const why = i.author?.login !== owner.login ? 'not filed by the owner'
      : !/^From: \S/m.test(body) ? 'no From: line' : !/^## What[ \t]*\r?$/m.test(body) ? 'no ## What' : null;
    const handled = state.requests?.[`${r.repo}#${i.number}`]?.result
      ?? (new RegExp(`Fixes #${i.number}([^0-9]|$)`, 'm').test(fixes) ? 'applied' : null);
    return { number: i.number, title: i.title, url: i.url, author: i.author?.login ?? null, candidate: !why, ...(why && { reason: why }), handled };
  });
  return r;
}

// The Request watch's candidate list, as JSON on stdout. Only `gh` reads; nothing is written but `git fetch`.
async function watch() {
  let code = '';
  try { code = fs.readFileSync(DEVICE, 'utf8').trim(); } catch {}
  if (!code) { console.error(`drift --watch: no Device code in ${DEVICE}`); return 2; }
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('not a JSON object');
  } catch (e) { // never read as empty: that would apply a handled Request again
    if (e.code !== 'ENOENT') { console.error(`drift --watch: cannot read ${STATE}: ${e.message}`); return 2; }
    state = {};
  }
  const { error, repos, missing, unreadable } = scan();
  if (error) { console.error(error); return 2; }
  const dirs = repos.filter((d) => watchDevice(d) === code);
  const owner = dirs.length ? await gh(os.homedir(), ['api', 'user', '--jq', '.login']).then((o) => (o.trim() ? { login: o.trim() } : { error: 'no login' }), (e) => ({ error: e.message }))
    : {};
  const lost = (dir, reason) => notOk({ dir, repo: null, branch: null }, state, 'unknown', reason);
  const out = [...missing.map((d) => lost(d, 'missing root')), ...unreadable.map((d) => lost(d, 'cannot read directory')),
    ...await pool(dirs, 8, (d) => watchRepo(d, owner, state))];
  console.log(JSON.stringify({ device: code, owner: owner.login ?? null, state: STATE, repos: out }, null, 2));
  return 0;
}

if (process.argv[2] === '--session') { // a check that broke or ran out of time is Unknown, never silence
  const deadline = setTimeout(() => {
    emit(`Drift check: Unknown, it did not finish within ${SESSION_DEADLINE / 1000}s.\n${ASK}`);
    process.exit(0);
  }, SESSION_DEADLINE);
  session().then(emit, (e) => emit(`Drift check: Unknown, the check itself failed (${e.message}).\n${ASK}`))
    .finally(() => clearTimeout(deadline));
} else if (process.argv[2] === '--prompt') {
  console.log(PROMPT);
} else if (process.argv[2] === '--watch') {
  watch().then((code) => { process.exitCode = code; }, (e) => { console.error(`drift --watch: Unknown, the check failed: ${e.message}`); process.exitCode = 2; });
} else {
  cli().then((code) => { process.exitCode = code; }, (e) => { console.error(`drift: Unknown, the check failed: ${e.message}`); process.exitCode = 2; });
}
