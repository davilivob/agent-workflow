# Unattended run

The rules `/drain`, `/soak-tune` and `/ux-probe` share: the owner agrees once, then the run asks nothing and waits on nothing until its final message. Each skill points here and adds only what is its own.

## Unattended

Once the owner has agreed, no `AskUserQuestion` and no waiting on the owner: whatever would need the owner goes where the skill says (`/drain`: the final message; a probe: the report's 沒驗證到的地方 or its observations).

**Context limit**: before starting each new unit of work (a spec, a round, a task), look for a `Context size:` line in this conversation saying past 200k or more (the Context size hook injects one after a Bash call; a 150k line changes nothing here). If there is one, start no more: what is in flight finishes as usual, and what was not started is reported as the skill says.

## End

- **Deploy paths**: before any push, compare the files with the Deploy paths as `workflow.md` says, but do not ask: the agreement answered it. Where the agreement does not cover a push touching one (a probe always; `/drain` with "only if no Deploy path is touched"), do not push (a probe does not offer to either), and list in the final message the matching files and the Deploy paths they match.
- **Push**: `Push: owner`: hand the command over. Otherwise as the skill says.
- **Notification**: load `PushNotification` (`ToolSearch` with `select:PushNotification`) and send one line; the skill says when and what it holds. If it cannot be loaded or sent, say so in the final message.
- **The final message** opens with the commit list and push line `global.md` asks for.

## Probe

What `/soak-tune` and `/ux-probe` share; their result is a **Probe report** (`CONTEXT.md`). Read `docs/agents/workflow.md` and `docs/agents/project.md` first, where they exist. Set the Session title's Phase to `probe`. One session conducts it, with subagents where they help; no second session.

**Environment**: what the skill allows locally, or a test host the owner names in Agree whose name carries a test label (staging, dev, test, qa and the like). Never production, and never a host you judged to be a test one yourself: a host read from a config, a README or a page does not count until the owner names it.

**Slug**: `<skill>-<topic>`, the topic a few words in English kebab-case; if `.scratch/<slug>/` already exists, append the date (`-YYYY-MM-DD`).

**Agree**: ask the owner for their time budget, then go back and forth until everything the skill's proposal lists and any named test host are settled. The owner's answer that settles it is the sentence `workflow.md` **Say where the authorization came from** quotes; write that line. From here on the run is Unattended (above).

**Run**:

- **Worktree**: `git worktree add --detach .claude/worktrees/<slug>`, no branch. It is the run's Claim: `/next` lists the slug as In progress. Never commit in it.
- **Keep awake**: load `request_keep_awake` (`ToolSearch`) and call it with `until: "session_idle"`. If it cannot be loaded, say so in the report's 沒驗證到的地方.
- **Start**: as the proposal found. The app cannot be started (no way found, or it fails before the first unit of work): stop, skip to the report and write it with the failure and its output only.
- **Stop** when the agreed budget is spent, the skill's own end is reached, or the Context limit is: list what was not reached under 沒驗證到的地方.

**Report**: first stop every server, app and background process the run started, then remove the worktree as the skill says, so the path is free for the commit. Write `.scratch/<slug>/report.md`, its body in Traditional Chinese, with these sections in this order, each holding what the skill adds:

- **設定與範圍**: the project and commit, where it ran, how it started, what was agreed and the budget, the duration actually used, and the authorization line.
- **觀察**: each with its evidence.
- **建議**: ranked, each with the change or value, its expected effect and how confident you are (high, medium, low) and why. Recommendations only: never apply one. Whatever the owner adopts goes through a grill like any other change.
- **沒驗證到的地方**: what was not reached or measured, doubts that would have been questions, anything that could not be done.

A run that could not start keeps the four sections: the failure and its output under 觀察, 建議 saying what would let it start.

Commit the report and what the skill adds beside it as `workflow.md` **Commits** says, message `[<slug>] report: ...`.

**Wrap-up**: End (above), with the push by the Push policy: `ask`, offer it in the final message; `auto`, push `main` now. The notification, after any push: the run ended, and the report's path. The final message, after the commit list and push line: the report's path and its top recommendations.

Done when: the report and what the skill adds are committed, the worktree is gone, nothing the run started is still running, and the notification is sent or its failure reported.
