
## Dev server

- To verify in the browser from a worktree, add your own entry to `.claude/launch.json`: name `dev-<slug>`, `cwd` pointing at the app directory inside `.claude/worktrees/<slug>`, and a port of its own (the first free one above the main entry's). `preview_start` resolves `launch.json` against the main checkout; without the entry you would be verifying `main`, not your branch. Remove the entry when you remove the worktree.
- Start dev servers with `preview_start`, never with Bash.
- Keep the browser pane displayed while verifying: while it is hidden, visual checks fail silently.
