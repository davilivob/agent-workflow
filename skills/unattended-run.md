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

**Environment**: what the skill allows locally, or a test host the owner names in Agree whose name carries a test label (staging, dev, test, qa and the like). Never production, and never a host you judged to be a test one yourself: a host read from a config, a README or a page does not count until the owner names it. A skill may also allow a device reached from this machine; it counts as a test host does, only once the owner names it in Agree.

**Slug**: `<skill>-<topic>`, the topic a few words in English kebab-case; if `.scratch/<slug>/` already exists, append the date (`-YYYY-MM-DD`). When the owner says in Agree to resume `<slug>`, keep that slug and its directory, with no date.

**Agree**: ask the owner for their budget, in the unit the skill's proposal sizes the run in, then go back and forth until everything the skill's proposal lists, any named test host or device, the **Probe harness** paths if one is needed, and whether the report states numbers only are settled. The owner's answer that settles it is the sentence `workflow.md` **Say where the authorization came from** quotes; write that line. From here on the run is Unattended (above).

**Run**:

- **Worktree**: read `Worktree:` in `project.md` and any exceptions written beside it. `yes`, with none of the paths this run changes in an exception: `git worktree add --detach .claude/worktrees/<slug>`, no branch, and never commit in it. Otherwise run on the main checkout. The worktree only isolates; it is not the Claim.
- **Claim**: `.scratch/<slug>/` in the main checkout, with no committed `report.md`: `/next` lists the slug as In progress (probing). Create it as the run starts; the data, `progress.md` and the list of changed files live there.
- **Data**: raw measurements go into `.scratch/<slug>/` in the main checkout from the first unit of work, never the session's scratchpad, so a reboot or a new session loses nothing (`/ux-probe`'s screenshots go where it says).
- **Project files**, on the main checkout: prefer environment variables or launch arguments. A tracked file that must change: first check it has no uncommitted changes (`git status --porcelain -- <file>` empty), or stop and say so in the report; write each one changed into `.scratch/<slug>/changed-files`. At the report, `git restore` only those, then confirm `git status --short` shows nothing but `.scratch/<slug>/` and the harness paths.
- **Probe harness** (`CONTEXT.md`): only in the paths the owner named in Agree. One with decision logic comes with a self-check, run and passing before the harness is used. Commit it on its own, `[<slug>] harness: ...`, with each night's results. A change it needs outside those paths: say in the proposal what is missing, and stop. In a worktree, write it there, and commit it onto `main` as `workflow.md` **Commits** says for a checkout not on `main`: through a branch worktree of its own, never in the probe's.
- **Keep awake**: load `request_keep_awake` (`ToolSearch`) and call it with `until: "session_idle"`. If it cannot be loaded, say so in the report's 沒驗證到的地方.
- **Start**: as the proposal found. The app cannot be started (no way found, or it fails before the first unit of work): stop, skip to the report and write it with the failure and its output only.
- **Stop** when the agreed budget is spent, the skill's own end is reached, or the Context limit is. The Context limit reached with agreed work not yet run (a task, a lens, a range) and budget left (an open-ended budget always has some): this night is not the last (**Nights**), whatever Agree said about nights, and what was not run goes into `progress.md`. Otherwise list what was not reached under 沒驗證到的地方.

**Nights**: a probe spread over several nights is one run of the skill per night, each resuming the same slug once the owner says so in Agree. A night the Context limit cut short (**Stop**) is one that is not the last too; the next starts when the owner sends the Wrap-up's next step, which is that night's Agree. A night that is not the last ends with the Report's cleanup (stop, worktree or restore) but no `report.md`: commit `.scratch/<slug>/progress.md` (what this night ran, how far it got, where the next night picks up), the data the Report would commit and the harness, message `[<slug>] progress: ...`; then the Wrap-up. Only the last night writes and commits `report.md`, and the Claim ends with it.

**Report**: first stop every server, app and background process the run started, then remove the worktree as the skill says, or, with none, restore the project files as **Project files** says, so the path is free for the commit. Write `.scratch/<slug>/report.md`, its body in Traditional Chinese, with these sections in this order, each holding what the skill adds:

- **設定與範圍**: the project and commit, where it ran, how it started, what was agreed and the budget, how much the run did, in the budget's unit, any Probe harness, and the authorization line.
- **觀察**: each with its evidence.
- **建議**: ranked, each with the change or value, its expected effect and how confident you are (high, medium, low) and why. Recommendations only: never apply one. Whatever the owner adopts goes through a grill like any other change. Agreed to numbers only: this section says only that the owner withheld recommendations in Agree.
- **沒驗證到的地方**: what was not reached or measured, doubts that would have been questions, anything that could not be done.

A run that could not start keeps the four sections: the failure and its output under 觀察, 建議 saying what would let it start.

Commit the report and what the skill adds beside it as `workflow.md` **Commits** says, message `[<slug>] report: ...`. Raw data goes with it when it totals 1 MB or less; otherwise leave it uncommitted and give its location and size in the report.

**Wrap-up**, every night: End (above), with the push by the Push policy: `ask`, offer it in the final message; `auto`, push `main` now. The notification, after any push: the run ended, and the report's path (`progress.md`'s on a night that is not the last). The final message, after the commit list and push line: the report's path and its top recommendations, or its numbers. On a night that is not the last: `progress.md`'s path and, as the next step, `/<skill> <topic>，接續 <slug>：<what was not run>`, never one of the report's recommendations.

Done when: the report (`progress.md` on a night that is not the last) and what the skill adds are committed, the worktree is gone or the project files restored, nothing the run started is still running, and the notification is sent or its failure reported.
