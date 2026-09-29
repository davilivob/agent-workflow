# Global rules

True in every project on every device.

- Reply in Traditional Chinese (繁體中文, never Simplified) in every message, including short progress notes between tool calls and summaries after long tool output. Code, commit messages and glossary terms stay in their original language.
- State every commit up front: its own line with the short hash and the message, near the top of the reply; several commits, one line each. Never bury a commit mid-paragraph.
- Commit your own changes without asking. `git commit` always takes paths (`git commit <paths> -F -`), never relies on the index: other sessions share it.
- `git push`, production writes and SSH belong to the owner. Hand the command over; never run it.
- In a repo that has `docs/agents/workflow.md`, never run `superpowers:brainstorming`, whatever the superpowers session hook says.
