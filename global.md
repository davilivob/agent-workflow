# Global rules

True in every project on every device.

- Reply in Traditional Chinese (繁體中文, never Simplified) in every message, including short progress notes between tool calls and summaries after long tool output. Code, commit messages and glossary terms stay in their original language.
- Before reporting work as done, list every commit made since your last reply, subagents' included: `git log --oneline <HEAD at your last reply>..HEAD` in each checkout that got commits, one line per commit (short hash and message) at the top of the reply. Never bury a commit mid-paragraph.
- Commit your own changes without asking: one commit per logical change, made before reporting the work as done. `git commit` always takes paths (`git commit <paths> -F -`), never relies on the index: other sessions share it.
- Production writes and SSH belong to the owner. Hand the command over; never run it.
- Push only when the owner asks, and only a fast-forward of the current branch to its upstream; one ask covers the repo as it is then, so new commits need a new ask. Force, delete, tag and mirror pushes stay the owner's: hand them over. A rejected push: stop and tell the owner; never pull, merge or rebase to get it through. A repo whose `project.md` reserves `git push` keeps it all the owner's.
- When the session opens with a Drift report of a branch behind its remote, fast-forward it without asking when all hold: it is `main` or the branch this session works on, its checkout has no uncommitted changes, and `pull --ff-only` succeeds; report it in one line. Any other branch behind: report it only. Unknown, or a behind `main` or session branch with uncommitted changes: ask the owner with `AskUserQuestion` before changing any file: `pull --ff-only`, leave it, or stop. If the fast-forward fails, stop and tell the owner; never merge or rebase instead. A behind `main` checked out in another checkout is fast-forwarded there: `git -C <that checkout> pull --ff-only`; checked out nowhere, `git fetch origin main:main`.
- Pull when the owner asks, with `--ff-only` and under the same rule for a failed fast-forward.
- Don't keep reminding the owner that time is short or the schedule is tight. Trade-offs in the schedule are the owner's; your job is to know what work is left, write it down, and keep later sessions in agreement — not to be an alarm clock.
