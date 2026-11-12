# Classify workflow.md against the kit's template

Shared by `/sync-workflow` (update mode) and `/generate-kit-proposal`: which case a repo's `docs/agents/workflow.md` is in, and its items. It changes no file in the repo.

Paths are relative to the repo's root; `W` is a work directory the caller names:

```bash
git -C ~/.claude/kit show HEAD:templates/workflow.md | tr -d '\r' > "$W/tmpl.md"
```

Every file in `$W` is stripped of `\r`: on Windows `core.autocrlf` makes the working tree CRLF while `git show` gives LF.

- First line is `Template: <40 hex>` → that is `BASE`, read CR-free: `BASE=$(head -n 1 docs/agents/workflow.md | tr -d '\r' | sed -n 's/^Template: \([0-9a-f]\{40\}\)$/\1/p')`; if `git -C ~/.claude/kit cat-file -e "$BASE^{commit}"` fails, stop: the commit is not in the local kit (another device made it and has not pushed), so tell the owner to push the kit from that device, then re-run; `tail -n +2 docs/agents/workflow.md | tr -d '\r' > "$W/repo.md"`; `git -C ~/.claude/kit show "${BASE}:templates/workflow.md" | tr -d '\r' > "$W/base.md"`.
- No `Template:` line → there is no base; `tr -d '\r' < docs/agents/workflow.md > "$W/repo.md"`.

Classify — the first matching row wins:

| Case | Result | Items |
| --- | --- | --- |
| `repo.md` = `tmpl.md` | **in sync** | none. A missing `Template:` line is set to the kit sha (the caller commits it); any other `Template:` line stays as it is, old format included — rewriting it would be a commit with no content, which two devices make differently |
| no base | **unknown** | each hunk of `diff -u tmpl.md repo.md` is a **conflict** |
| `repo.md` = `base.md` | **behind** | each hunk of `diff -u base.md tmpl.md` |
| `tmpl.md` = `base.md` | **ahead** | each hunk of `diff -u base.md repo.md` |
| otherwise | **diverged** | hunks of `diff -U0 base.md repo.md` (ahead) and `diff -U0 base.md tmpl.md` (behind); two hunks whose `base.md` line ranges overlap are one **conflict** (`-U0` keeps context lines out of the ranges; `git merge-file -p --diff3 repo.md base.md tmpl.md` shows them as markers) |
