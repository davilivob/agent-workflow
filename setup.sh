#!/bin/sh
# Sets up the kit on this device. Safe to re-run. macOS, Linux, Windows (Git Bash).
set -eu

KIT=$(cd "$(dirname "$0")" && pwd -P)
IMPORT='@~/.claude/kit/global.md'
CLAUDE_MD="$HOME/.claude/CLAUDE.md"
SKILLS="$HOME/.claude/skills"
CHECK=
case "${1-}" in --check) CHECK=1 ;; "") ;; *) echo "usage: setup.sh [--check]" >&2; exit 2 ;; esac
[ $# -le 1 ] || { echo "usage: setup.sh [--check]" >&2; exit 2; }
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WINDOWS=1 ;; *) WINDOWS= ;; esac

# 1. global.md in every session
if [ -z "$CHECK" ]; then
mkdir -p "$SKILLS"
touch "$CLAUDE_MD"
if ! grep -qxF "$IMPORT" "$CLAUDE_MD"; then
  if [ -s "$CLAUDE_MD" ] && [ -n "$(tail -c 1 "$CLAUDE_MD")" ]; then echo >> "$CLAUDE_MD"; fi
  echo "$IMPORT" >> "$CLAUDE_MD"
  echo "added $IMPORT to $CLAUDE_MD"
fi

# 2. Link every kit skill into ~/.claude/skills, after removing links to kit skills that were deleted
# shortcut: a Windows junction left by a deleted skill may not read as a link here; remove it by hand if one shows up.
for link in "$SKILLS"/*; do
  [ -L "$link" ] && [ ! -e "$link" ] || continue
  case "$(readlink "$link")" in "$KIT"/skills/*) rm "$link"; echo "removed $(basename "$link"), no longer a kit skill" ;; esac
done
for dir in "$KIT"/skills/*/; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  target="$KIT/skills/$name"
  link="$SKILLS/$name"
  if [ -e "$link" ] || [ -L "$link" ]; then
    [ "$(cd "$link" 2>/dev/null && pwd -P)" = "$target" ] && continue
    echo "STOP: $link exists and is not the kit's $name. Move it away, then re-run." >&2
    exit 1
  fi
  if [ -n "$WINDOWS" ]; then
    # ponytail: a junction needs neither admin nor Developer Mode, unlike a symlink
    MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$link")" "$(cygpath -w "$target")" >/dev/null
  else
    ln -s "$target" "$link"
  fi
  echo "linked $name"
done
fi

# 3. What the pipeline depends on
KEEP="grill-with-docs grilling domain-modeling to-spec diagnosing-bugs writing-for-agents improve-codebase-architecture codebase-design prototype wizard wayfinder teach wait-what research handoff retro to-questionnaire code-review"
BAD=
todo() { echo "TODO: $1"; BAD=1; }
missing=
for n in $KEEP; do [ -e "$SKILLS/$n" ] || missing="$missing $n"; done
if [ -n "$missing" ]; then
  MATT="npx -y skills@latest add mattpocock/skills -g -a claude-code -s${missing} -y"
  if command -v npx >/dev/null 2>&1; then
    if [ -n "$CHECK" ]; then todo "install the missing skills: $MATT"
    else sh -c "$MATT" || todo "install failed; retry: $MATT"; fi
  else todo "install Node.js, then run: $MATT"
  fi
fi

# Extras: the lock records them as the kit's source, but they are not on the keep list. Report only.
LOCK="$HOME/.agents/.skill-lock.json"
if [ -r "$LOCK" ]; then
  # depth counted before each line: name lines sit at d==2 (root > skills), their "source" at d==3
  extras=
  for n in $(awk '
    { l=$0; o=gsub(/\{/,"{",l); c=gsub(/\}/,"}",l)
      if (d==2 && o>c && match($0,/"[^"]+"/)) name=substr($0,RSTART+1,RLENGTH-2)
      if (d==3 && $0 ~ /"source"[ ]*:[ ]*"mattpocock\/skills"/) print name
      d+=o-c }' "$LOCK"); do
    case " $KEEP " in *" $n "*) continue ;; esac
    [ -e "$SKILLS/$n" ] && extras="$extras $n"
  done
  [ -z "$extras" ] || echo "TODO: not on the kit's keep list; to remove, run: npx -y skills@latest remove -g -y${extras}"
fi

if command -v graphify >/dev/null 2>&1; then :
elif [ -n "$CHECK" ]; then todo "install graphify: run sh ~/.claude/kit/setup.sh"
elif command -v uv >/dev/null 2>&1; then uv tool install graphifyy || echo "TODO: install failed; retry: uv tool install graphifyy"
else echo "TODO: install uv (https://docs.astral.sh/uv/getting-started/installation/), then run: uv tool install graphifyy"
fi

if ! grep -qs '"superpowers@' "$HOME/.claude/plugins/installed_plugins.json"; then
  todo "in Claude Code, run: /plugin install superpowers@claude-plugins-official"
fi

# 4. Guard, Drift check and language. The Guard is a PreToolUse hook backing the mechanical rules in global.md and workflow.md;
#    the Drift check is a SessionStart hook reporting Drift in the session's repo, and a UserPromptSubmit hook reminding of the Session title;
#    language puts global.md's reply-language rule into the system prompt, where it outlasts a long session. --check writes nothing and reports what is missing.
SETTINGS="$HOME/.claude/settings.json"
GUARD_CMD='node "$HOME/.claude/kit/hooks/guard.cjs"'
DRIFT_CMD='node "$HOME/.claude/kit/hooks/drift.cjs" --session'
if command -v node >/dev/null 2>&1; then
  node -e '
const fs = require("fs");
const [file, command, driftCmd, check] = process.argv.slice(1);
let s = {};
if (fs.existsSync(file)) {
  try { s = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { console.error(`STOP: ${file} is not valid JSON (${e.message}). Fix it, then re-run.`); process.exit(1); }
}
const pre = ((s.hooks ??= {}).PreToolUse ??= []);
const has = (m) => pre.some((e) => e.matcher === m && JSON.stringify(e).includes("kit/hooks/guard.cjs"));
const missing = ["Skill", "Bash", "Edit|Write|NotebookEdit"].filter((m) => !has(m));
const start = (s.hooks.SessionStart ??= []);
const needDrift = !start.some((e) => JSON.stringify(e).includes("kit/hooks/drift.cjs"));
const prompt = (s.hooks.UserPromptSubmit ??= []);
const needPrompt = !prompt.some((e) => JSON.stringify(e).includes("kit/hooks/drift.cjs"));
const needLang = !("language" in s);  // a language the owner set stays
if (!missing.length && !needDrift && !needPrompt && !needLang) process.exit(0);
if (check) {
  const lacks = [missing.length && `the Guard hook for ${missing.join(", ")}`, needDrift && "the Drift check hook", needPrompt && "the Session title hook", needLang && "language"].filter(Boolean);
  console.log(`TODO: run sh ~/.claude/kit/setup.sh; ${file} lacks ${lacks.join("; ")}`);
  process.exit(1);
}
for (const matcher of missing) pre.push({ matcher, hooks: [{ type: "command", command }] });
// no compact: the session already had its report when it started
if (needDrift) start.push({ matcher: "startup|resume|clear", hooks: [{ type: "command", command: driftCmd, timeout: 30 }] });
if (needPrompt) prompt.push({ hooks: [{ type: "command", command: driftCmd.replace(/--session$/, "--prompt") }] });
// A copy of the first rule in global.md, which stays the source: change both together.
if (needLang) s.language = "Traditional Chinese (繁體中文, never Simplified); code, commit messages and glossary terms stay in their original language";
fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
if (missing.length) console.log(`installed the Guard hook for ${missing.join(", ")} in ${file}`);
if (needDrift) console.log(`installed the Drift check hook in ${file}`);
if (needPrompt) console.log(`installed the Session title hook in ${file}`);
if (needLang) console.log(`set language in ${file}`);
' "$SETTINGS" "$GUARD_CMD" "$DRIFT_CMD" "$CHECK" || if [ -n "$CHECK" ]; then BAD=1; else exit 1; fi
else
  todo "install Node.js, then re-run setup.sh: without it the Guard and Drift check hooks are not installed and language is not set"
fi

# 5. The drift command. Its roots and PATH differ per device, so setup.sh only says what is missing.
[ -f "$HOME/.claude/drift-roots" ] || todo "create ~/.claude/drift-roots listing the directories that hold your repos, one per line (e.g. ~/proj; a !<path> line retires a repo or directory), for the drift command"
if ! command -v drift >/dev/null 2>&1; then
  BIN="$KIT/bin"; [ -z "$WINDOWS" ] || BIN=$(cygpath -w "$BIN")
  todo "add $BIN to PATH (macOS: in ~/.zshrc; Windows: the user Path environment variable), so the drift command works"
fi

# 6. The Device code differs per device too: the Drift check hook hands it to the agent for the Session title.
[ -s "$HOME/.claude/device" ] || todo "create ~/.claude/device holding this device's Device code on one line (studio, mbp or win), for the Session title"

[ -z "$CHECK" ] || [ -z "$BAD" ] || exit 1
