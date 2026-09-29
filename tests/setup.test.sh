#!/bin/sh
# Runs setup.sh twice against a throwaway HOME. macOS/Linux only.
set -eu
KIT=$(cd "$(dirname "$0")/.." && pwd -P)
T=$(mktemp -d)
fail() { echo "FAIL: $1" >&2; exit 1; }

# Stand-in skill: the link loop has something to link even before real skills exist,
# and the foreign-directory check below has a name to collide with.
mkdir -p "$KIT/skills/zz-test-standin"
trap 'rm -rf "$T" "$KIT/skills/zz-test-standin"' EXIT

mkdir -p "$T/.claude/skills/to-spec"               # Matt Pocock skills "present": no network install
printf 'existing line' > "$T/.claude/CLAUDE.md"    # no trailing newline, on purpose

HOME="$T" sh "$KIT/setup.sh" >/dev/null
HOME="$T" sh "$KIT/setup.sh" >/dev/null

[ "$(grep -cxF '@~/.claude/kit/global.md' "$T/.claude/CLAUDE.md")" = 1 ] || fail "import line not present exactly once"
grep -qxF 'existing line' "$T/.claude/CLAUDE.md" || fail "existing CLAUDE.md line damaged"
for d in "$KIT"/skills/*/; do
  n=$(basename "$d")
  [ "$(cd "$T/.claude/skills/$n" && pwd -P)" = "$(cd "$d" && pwd -P)" ] || fail "$n is not linked to the kit"
done

# A same-named directory that is not the kit's: setup.sh must stop and leave it alone.
rm "$T/.claude/skills/zz-test-standin"
mkdir "$T/.claude/skills/zz-test-standin" && touch "$T/.claude/skills/zz-test-standin/mine"
if HOME="$T" sh "$KIT/setup.sh" >/dev/null 2>&1; then fail "setup.sh did not stop on a foreign directory"; fi
[ -f "$T/.claude/skills/zz-test-standin/mine" ] || fail "foreign directory was touched"

echo PASS
