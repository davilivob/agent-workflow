#!/bin/sh
# Runs setup.sh twice against a throwaway HOME. macOS/Linux only; needs node.
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
chmod +x "$T/bin/npx" "$T/bin/graphify"
ln -s "$(command -v node)" "$T/bin/node"  # the real node: the Guard section needs it
echo '{"plugins":{"superpowers@x":[]}}' > "$T/.claude/plugins/installed_plugins.json"
NPXLOG="$T/npx.log"; : > "$NPXLOG"
SAVED_PATH=$PATH
export NPXLOG PATH="$T/bin:/usr/bin:/bin"
KEEP="grill-with-docs grilling domain-modeling to-spec diagnosing-bugs writing-for-agents writing-great-skills improve-codebase-architecture codebase-design resolving-merge-conflicts prototype wizard wayfinder teach wait-what research handoff retro to-questionnaire code-review"
for n in $KEEP; do mkdir -p "$T/.claude/skills/$n"; done  # keep list "present": no network install
printf 'existing line' > "$T/.claude/CLAUDE.md"    # no trailing newline, on purpose
cat > "$T/.claude/settings.json" <<'EOF'
{"model": "keep-me", "hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "echo mine"}]}]}}
EOF

HOME="$T" sh "$KIT/setup.sh" >/dev/null
HOME="$T" sh "$KIT/setup.sh" >/dev/null

[ "$(grep -cxF '@~/.claude/kit/global.md' "$T/.claude/CLAUDE.md")" = 1 ] || fail "import line not present exactly once"
grep -qxF 'existing line' "$T/.claude/CLAUDE.md" || fail "existing CLAUDE.md line damaged"
for d in "$KIT"/skills/*/; do
  n=$(basename "$d")
  [ "$(cd "$T/.claude/skills/$n" && pwd -P)" = "$(cd "$d" && pwd -P)" ] || fail "$n is not linked to the kit"
done

[ "$(grep -c 'kit/hooks/guard.cjs' "$T/.claude/settings.json")" = 2 ] || fail "Guard not registered exactly once (Skill and Bash)"
grep -q '"keep-me"' "$T/.claude/settings.json" || fail "existing settings key lost"
grep -q 'echo mine' "$T/.claude/settings.json" || fail "existing hook lost"

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
ln -s "$(PATH=$SAVED_PATH command -v node)" "$T/bin/node"

# A settings.json it cannot read: setup.sh must stop and leave it alone.
printf '{broken' > "$T/.claude/settings.json"
if HOME="$T" sh "$KIT/setup.sh" >/dev/null 2>&1; then fail "setup.sh did not stop on a broken settings.json"; fi
[ "$(cat "$T/.claude/settings.json")" = '{broken' ] || fail "broken settings.json was rewritten"

echo PASS
