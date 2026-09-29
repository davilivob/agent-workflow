# Global rules

True in every project on every device.

- Reply in Traditional Chinese (繁體中文, never Simplified) in every message, including short progress notes between tool calls and summaries after long tool output. Code, commit messages and glossary terms stay in their original language.
- Before reporting work as done, list every commit made since your last reply, subagents' included: `git log --oneline <HEAD at your last reply>..HEAD` in each checkout that got commits, one line per commit (short hash and message) at the top of the reply. Never bury a commit mid-paragraph.
- Commit your own changes without asking. `git commit` always takes paths (`git commit <paths> -F -`), never relies on the index: other sessions share it.
- `git push`, production writes and SSH belong to the owner. Hand the command over; never run it.
