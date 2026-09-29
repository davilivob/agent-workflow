#!/bin/sh
# Sets up the kit on this device. Safe to re-run. macOS, Linux, Windows (Git Bash).
set -eu

KIT=$(cd "$(dirname "$0")" && pwd -P)
IMPORT='@~/.claude/kit/global.md'
CLAUDE_MD="$HOME/.claude/CLAUDE.md"
SKILLS="$HOME/.claude/skills"
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WINDOWS=1 ;; *) WINDOWS= ;; esac

# 1. global.md in every session
mkdir -p "$SKILLS"
touch "$CLAUDE_MD"
if ! grep -qxF "$IMPORT" "$CLAUDE_MD"; then
  if [ -s "$CLAUDE_MD" ] && [ -n "$(tail -c 1 "$CLAUDE_MD")" ]; then echo >> "$CLAUDE_MD"; fi
  echo "$IMPORT" >> "$CLAUDE_MD"
  echo "added $IMPORT to $CLAUDE_MD"
fi

# 2. Link every kit skill into ~/.claude/skills
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

# 3. What the pipeline depends on
MATT='npx -y skills@latest add mattpocock/skills -g -a claude-code -s '\''*'\'' -y'
if [ -e "$SKILLS/to-spec" ]; then :
elif command -v npx >/dev/null 2>&1; then sh -c "$MATT"
else echo "TODO: install Node.js, then run: $MATT"
fi

if command -v graphify >/dev/null 2>&1; then :
elif command -v uv >/dev/null 2>&1; then uv tool install graphifyy
else echo "TODO: install uv (https://docs.astral.sh/uv/getting-started/installation/), then run: uv tool install graphifyy"
fi

if ! grep -qs '"superpowers@' "$HOME/.claude/plugins/installed_plugins.json"; then
  echo "TODO: in Claude Code, run: /plugin install superpowers@claude-plugins-official"
fi
