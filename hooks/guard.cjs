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
