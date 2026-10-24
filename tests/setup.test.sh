#!/bin/sh
# Runs setup.sh twice against a throwaway HOME. macOS, Linux and Windows (Git Bash); needs node.
set -eu
KIT=$(cd "$(dirname "$0")/.." && pwd -P)
T=$(mktemp -d)
fail() { echo "FAIL: $1" >&2; exit 1; }

# Stand-in skill: the link loop has something to link even before real skills exist,
# and the foreign-directory check below has a name to collide with.
mkdir -p "$KIT/skills/zz-test-standin"
trap 'rm -rf "$T" "$KIT/skills/zz-test-standin"' EXIT

# Fake npx records its args; fake graphify + superpowers make those deps "present". PATH = fakes + system dirs.
mkdir -p "$T/bin" "$T/.claude/plugins"
printf '#!/bin/sh\necho "$*" >> "$NPXLOG"\n' > "$T/bin/npx"
printf '#!/bin/sh\n' > "$T/bin/graphify"
cp "$T/bin/graphify" "$T/bin/drift"  # the drift command "on PATH"
chmod +x "$T/bin/npx" "$T/bin/graphify" "$T/bin/drift"
touch "$T/.claude/drift-roots"
echo win > "$T/.claude/device"
NODE=$(command -v node)  # captured once: the shell caches lookups, so a later `command -v` can find the fake
ln -s "$NODE" "$T/bin/node"  # the real node: the Guard section needs it
echo '{"plugins":{"superpowers@x":[]}}' > "$T/.claude/plugins/installed_plugins.json"
NPXLOG="$T/npx.log"; : > "$NPXLOG"
export NPXLOG PATH="$T/bin:/usr/bin:/bin${SYSTEMROOT:+:$(cygpath -u "$SYSTEMROOT")/System32}"  # Windows: setup.sh needs cmd for mklink
KEEP="grill-with-docs grilling domain-modeling to-spec diagnosing-bugs writing-for-agents improve-codebase-architecture codebase-design prototype wizard wayfinder teach wait-what research handoff retro to-questionnaire code-review"
for n in $KEEP; do mkdir -p "$T/.claude/skills/$n"; done  # keep list "present": no network install
printf 'existing line' > "$T/.claude/CLAUDE.md"    # no trailing newline, on purpose
cat > "$T/.claude/settings.json" <<'EOF'
{"model": "keep-me", "hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "echo mine"}]}],
 "SessionStart": [{"matcher": "startup", "hooks": [{"type": "command", "command": "echo my-start"}]}]}}
EOF

# Dangling links: one to a deleted kit skill (removed), one foreign (kept). Skipped where ln -s cannot make one.
GONE= ; FOREIGN=
ln -s "$KIT/skills/zz-gone" "$T/.claude/skills/zz-gone" 2>/dev/null && [ -L "$T/.claude/skills/zz-gone" ] && GONE=1
ln -s "$T/nowhere" "$T/.claude/skills/zz-foreign" 2>/dev/null && [ -L "$T/.claude/skills/zz-foreign" ] && FOREIGN=1

HOME="$T" sh "$KIT/setup.sh" >/dev/null
HOME="$T" sh "$KIT/setup.sh" >/dev/null

[ -z "$GONE" ] || [ ! -L "$T/.claude/skills/zz-gone" ] || fail "link to a deleted kit skill kept"
[ -z "$FOREIGN" ] || [ -L "$T/.claude/skills/zz-foreign" ] || fail "foreign dangling link removed"

[ "$(grep -cxF '@~/.claude/kit/global.md' "$T/.claude/CLAUDE.md")" = 1 ] || fail "import line not present exactly once"
grep -qxF 'existing line' "$T/.claude/CLAUDE.md" || fail "existing CLAUDE.md line damaged"
for d in "$KIT"/skills/*/; do
  n=$(basename "$d")
  [ "$(cd "$T/.claude/skills/$n" && pwd -P)" = "$(cd "$d" && pwd -P)" ] || fail "$n is not linked to the kit"
done

[ "$(grep -c 'kit/hooks/guard.cjs' "$T/.claude/settings.json")" = 3 ] || fail "Guard not registered exactly once per matcher"
grep -q '"Edit|Write|NotebookEdit"' "$T/.claude/settings.json" || fail "Guard lacks the Edit matcher"
grep -q '"keep-me"' "$T/.claude/settings.json" || fail "existing settings key lost"
grep -q 'echo mine' "$T/.claude/settings.json" || fail "existing hook lost"
[ "$(grep -c 'kit/hooks/drift.cjs.* --session"' "$T/.claude/settings.json")" = 1 ] || fail "Drift check hook not registered exactly once"
[ "$(grep -c 'kit/hooks/drift.cjs.* --prompt"' "$T/.claude/settings.json")" = 1 ] || fail "Session title reminder hook not registered exactly once"
grep -q '"startup|resume|clear"' "$T/.claude/settings.json" || fail "Drift check hook lacks its matcher"
grep -q 'echo my-start' "$T/.claude/settings.json" || fail "existing SessionStart hook lost"
grep -q '"language": "Traditional Chinese (繁體中文, never Simplified); code' "$T/.claude/settings.json" || fail "language not set intact"

# A device with the full Guard but no language gains just the language.
"$NODE" -e '
const fs = require("fs"); const f = process.argv[1]; const s = JSON.parse(fs.readFileSync(f, "utf8"));
delete s.language; fs.writeFileSync(f, JSON.stringify(s));' "$T/.claude/settings.json"
HOME="$T" sh "$KIT/setup.sh" | grep -q 'Guard hook' && fail "full Guard reinstalled"
grep -q '繁體中文' "$T/.claude/settings.json" || fail "language not added to a full Guard install"
[ "$(grep -c 'kit/hooks/guard.cjs' "$T/.claude/settings.json")" = 3 ] || fail "language re-run touched the Guard"

# A device with the Guard and language but no Drift check gains just the Drift check.
"$NODE" -e '
const fs = require("fs"); const f = process.argv[1]; const s = JSON.parse(fs.readFileSync(f, "utf8"));
s.hooks.SessionStart = s.hooks.SessionStart.filter((e) => !JSON.stringify(e).includes("drift.cjs")); fs.writeFileSync(f, JSON.stringify(s));' "$T/.claude/settings.json"
out=$(HOME="$T" sh "$KIT/setup.sh")
echo "$out" | grep -q 'Drift check hook' || fail "missing Drift check not reported"
echo "$out" | grep -q 'Guard hook' && fail "Drift check upgrade reinstalled the Guard"
[ "$(grep -c 'kit/hooks/drift.cjs.* --session"' "$T/.claude/settings.json")" = 1 ] || fail "Drift check not re-added exactly once"
echo "$out" | grep -q 'Session title reminder hook' && fail "Drift check upgrade reinstalled the Session title reminder hook"

# A device without the Session title reminder hook gains just that.
"$NODE" -e '
const fs = require("fs"); const f = process.argv[1]; const s = JSON.parse(fs.readFileSync(f, "utf8"));
delete s.hooks.UserPromptSubmit; fs.writeFileSync(f, JSON.stringify(s));' "$T/.claude/settings.json"
out=$(HOME="$T" sh "$KIT/setup.sh")
echo "$out" | grep -q 'installed the Session title reminder hook' || fail "missing Session title reminder hook not reported"
echo "$out" | grep -q 'Drift check hook' && fail "Session title upgrade reinstalled the Drift check"
[ "$(grep -c 'kit/hooks/drift.cjs.* --prompt"' "$T/.claude/settings.json")" = 1 ] || fail "Session title reminder hook not re-added exactly once"

# A language the owner set is kept.
"$NODE" -e '
const fs = require("fs"); const f = process.argv[1]; const s = JSON.parse(fs.readFileSync(f, "utf8"));
s.language = "mine"; fs.writeFileSync(f, JSON.stringify(s));' "$T/.claude/settings.json"
HOME="$T" sh "$KIT/setup.sh" >/dev/null
grep -q '"language":"mine"' "$T/.claude/settings.json" || fail "owner-set language overwritten"

# An older install (Skill and Bash only) gains just the missing matcher.
"$NODE" -e '
const fs = require("fs"); const f = process.argv[1]; const s = JSON.parse(fs.readFileSync(f, "utf8"));
s.hooks.PreToolUse = s.hooks.PreToolUse.filter((e) => e.matcher !== "Edit|Write|NotebookEdit");
fs.writeFileSync(f, JSON.stringify(s));' "$T/.claude/settings.json"
HOME="$T" sh "$KIT/setup.sh" | grep -q 'Guard hook for Edit|Write|NotebookEdit in' || fail "missing matcher not reported"
[ "$(grep -c 'kit/hooks/guard.cjs' "$T/.claude/settings.json")" = 3 ] || fail "upgrade did not add exactly the missing matcher"

# A same-named directory that is not the kit's: setup.sh must stop and leave it alone.
rm "$T/.claude/skills/zz-test-standin"
mkdir "$T/.claude/skills/zz-test-standin" && touch "$T/.claude/skills/zz-test-standin/mine"
if HOME="$T" sh "$KIT/setup.sh" >/dev/null 2>&1; then fail "setup.sh did not stop on a foreign directory"; fi
[ -f "$T/.claude/skills/zz-test-standin/mine" ] || fail "foreign directory was touched"

[ ! -s "$NPXLOG" ] || fail "npx called although the keep list is present"
HOME="$T" sh "$KIT/setup.sh" --check | grep -q TODO && fail "--check printed TODO with everything present"
HOME="$T" sh "$KIT/setup.sh" --check >/dev/null || fail "--check exited non-zero with everything present"

# Missing skills: one npx call, -s takes exactly the missing names.
rm -rf "$T/.claude/skills/zz-test-standin"
rmdir "$T/.claude/skills/wizard" "$T/.claude/skills/retro"
HOME="$T" sh "$KIT/setup.sh" >/dev/null
[ "$(wc -l < "$NPXLOG" | tr -d ' ')" = 1 ] || fail "npx not called exactly once"
grep -qxe '-y skills@latest add mattpocock/skills -g -a claude-code -s wizard retro -y' "$NPXLOG" || fail "wrong npx args: $(cat "$NPXLOG")"

# --check with missing skills: TODO, exit 1, nothing installed, linked or written.
: > "$NPXLOG"; rm "$T/.claude/skills/zz-test-standin"
cp "$T/.claude/CLAUDE.md" "$T/before"
cp "$T/.claude/settings.json" "$T/before-settings"
rc=0; out=$(HOME="$T" sh "$KIT/setup.sh" --check) || rc=$?
[ "$rc" = 1 ] || fail "--check exit $rc, want 1"
echo "$out" | grep -q 'TODO.*-s wizard retro -y' || fail "--check TODO lacks install command"
[ ! -s "$NPXLOG" ] || fail "--check called npx"
[ ! -e "$T/.claude/skills/zz-test-standin" ] || fail "--check created a link"
cmp -s "$T/.claude/CLAUDE.md" "$T/before" || fail "--check changed CLAUDE.md"
cmp -s "$T/.claude/settings.json" "$T/before-settings" || fail "--check changed settings.json"
if HOME="$T" sh "$KIT/setup.sh" --bogus 2>/dev/null; then fail "unknown argument accepted"; fi

# The drift command's roots file and PATH: a TODO each when missing, and --check fails.
mkdir "$T/.claude/skills/wizard" "$T/.claude/skills/retro"
rm "$T/.claude/drift-roots" "$T/bin/drift"
rc=0; out=$(HOME="$T" sh "$KIT/setup.sh" --check) || rc=$?
[ "$rc" = 1 ] || fail "--check exit $rc without drift-roots and drift, want 1"
echo "$out" | grep -q 'TODO: create ~/.claude/drift-roots' || fail "no TODO for a missing drift-roots"
echo "$out" | grep -q 'TODO: add .*bin to PATH' || fail "no TODO for drift not on PATH"
touch "$T/.claude/drift-roots"; cp "$T/bin/graphify" "$T/bin/drift"

# The Device code file: a TODO when missing or empty, and --check fails.
: > "$T/.claude/device"
rc=0; out=$(HOME="$T" sh "$KIT/setup.sh" --check) || rc=$?
[ "$rc" = 1 ] || fail "--check exit $rc with an empty device file, want 1"
echo "$out" | grep -q 'TODO: create ~/.claude/device' || fail "no TODO for an empty device file"
echo win > "$T/.claude/device"

# Section 4 under --check: a TODO naming what settings.json lacks, --check fails, nothing written.
cp "$T/.claude/settings.json" "$T/full-settings"
node -e 'const fs = require("fs"); const f = process.argv[1]; const s = JSON.parse(fs.readFileSync(f, "utf8"));
delete s.language; s.hooks.SessionStart = []; s.hooks.UserPromptSubmit = []; s.hooks.PreToolUse = s.hooks.PreToolUse.filter((e) => e.matcher !== "Bash"); fs.writeFileSync(f, JSON.stringify(s));' "$T/.claude/settings.json"
cp "$T/.claude/settings.json" "$T/before-settings"
rc=0; out=$(HOME="$T" sh "$KIT/setup.sh" --check) || rc=$?
[ "$rc" = 1 ] || fail "--check exit $rc without a Guard matcher, the Drift check hook and language, want 1"
echo "$out" | grep -q 'TODO: run sh ~/.claude/kit/setup.sh; .* lacks the Guard hook for Bash; the Drift check hook; the Session title reminder hook; language$' || fail "no TODO naming the missing Guard matcher, Drift check hook, Session title reminder hook and language"
cmp -s "$T/.claude/settings.json" "$T/before-settings" || fail "--check changed settings.json"
cp "$T/full-settings" "$T/.claude/settings.json"
rm "$T/bin/node"
rc=0; out=$(HOME="$T" sh "$KIT/setup.sh" --check) || rc=$?
[ "$rc" = 1 ] || fail "--check exit $rc without node, want 1"
echo "$out" | grep -q 'TODO: install Node.js' || fail "--check gave no TODO without node"
ln -s "$NODE" "$T/bin/node"
rmdir "$T/.claude/skills/wizard" "$T/.claude/skills/retro"

# Extras: recorded as mattpocock/skills, dir exists, not kept -> reported, never deleted.
# A lock entry whose dir is gone is stale and stays silent.
mkdir "$T/.claude/skills/wizard" "$T/.claude/skills/retro" "$T/.claude/skills/zz-extra"
mkdir "$T/.agents"
cat > "$T/.agents/.skill-lock.json" <<'LOCK'
{
  "version": 3,
  "skills": {
    "zz-extra": {
      "source": "mattpocock/skills",
      "sourceType": "github"
    },
    "zz-stale": {
      "source": "mattpocock/skills",
      "sourceType": "github"
    },
    "wizard": {
      "source": "mattpocock/skills",
      "sourceType": "github"
    }
  },
  "dismissed": {}
}
LOCK
out=$(HOME="$T" sh "$KIT/setup.sh")
echo "$out" | grep -q 'TODO.*zz-extra' || fail "extra not reported"
echo "$out" | grep -q 'zz-stale' && fail "stale lock entry reported"
echo "$out" | grep -q 'wizard' && fail "kept skill reported as extra"
[ -d "$T/.claude/skills/zz-extra" ] || fail "extra was deleted"
HOME="$T" sh "$KIT/setup.sh" --check >/dev/null || fail "extras alone made --check fail"

# No node: a TODO line, and settings.json untouched.
rm "$T/bin/node"; cp "$T/.claude/settings.json" "$T/before-settings"
HOME="$T" sh "$KIT/setup.sh" | grep -q 'TODO.*Guard' || fail "no TODO for the Guard without node"
cmp -s "$T/.claude/settings.json" "$T/before-settings" || fail "settings.json changed without node"
ln -s "$NODE" "$T/bin/node"

# A settings.json it cannot read: setup.sh must stop and leave it alone.
printf '{broken' > "$T/.claude/settings.json"
if HOME="$T" sh "$KIT/setup.sh" >/dev/null 2>&1; then fail "setup.sh did not stop on a broken settings.json"; fi
[ "$(cat "$T/.claude/settings.json")" = '{broken' ] || fail "broken settings.json was rewritten"

echo PASS
