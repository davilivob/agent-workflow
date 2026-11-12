---
name: ux-probe
description: Work through a project's web or iOS interface as its users would, unattended after one agreed plan, and leave a Probe report of friction points, bugs and ranked recommendations.
disable-model-invocation: true
---

`/ux-probe` does a project's user tasks in its real interface, as a newcomer and again as a repeat user, records every point where it got stuck, took a detour or could not tell what to do, and ends in a **Probe report** (`CONTEXT.md`): observations with their evidence and ranked recommendations, never a decision. Whatever the owner adopts from it goes through a grill like any other change. Read `docs/agents/workflow.md` and `docs/agents/project.md` first, where they exist. Set the Session title's Phase to `probe`.

One session conducts it, with subagents where they help; no second session. It never changes the project's code, config or data, the seed or example config for generated test accounts aside.

**Interfaces**: a web interface in the built-in browser (the `mcp__Claude_Browser__*` tools), an iOS app in the Simulator (the `mcp__Claude_Code_iOS_Simulator__*` tools). Both work in the background: never open the Simulator panel or front a tab for yourself. A CLI, a TUI or a desktop app is not supported: say so in the proposal and stop.

**Environment**: only a local development host (`localhost`, `127.0.0.1`, `[::1]`, a name ending in `.localhost` or `.test`), or a test host the owner names in section 2 whose name carries a test label (staging, dev, test, qa and the like). Never production, and never a host you judged to be a test one yourself: a host read from a config, a README or a page does not count until the owner names it. Test accounts and test data: generate them, or take them from the project's seed, fixture or example-config files; write any you generate into the project's seed or example config, never repeated in chat. A real credential is never entered.

## 1. Propose

Read the project's README and code, then write the proposal in chat:

- **Tasks**: what real users come to do, each one sentence with the state that means it is done, e.g. "a new user signs up and creates a first project: the project's page shows its name".
- **Lenses**: from the second pass as a repeat user, phone width and dark mode, the ones that fit, each dropped one with why (an iOS app has no "phone width"; an app with no dark theme has no dark mode).
- **How it starts**: the project's `.claude/launch.json` or `run` skill, or for iOS its own build; say which, or that none exists.
- **Ideal duration**, with the reasoning: tasks, passes and lenses, and the free exploration after each task.

Pick the slug: `ux-probe-<topic>`, the topic a few words in English kebab-case; if `.scratch/<slug>/` already exists, append the date (`-YYYY-MM-DD`).

Done when: the proposal and the slug are in chat, or the interface is unsupported and that is said.

## 2. Agree

Ask the owner for their time budget, then go back and forth until tasks, lenses, duration and any named test host are settled. The owner's answer that settles it is the sentence `workflow.md` **Say where the authorization came from** quotes; write that line.

From here on, ask nothing and wait on nothing: a doubt goes into the report's 沒驗證到的地方 or its observations.

Done when: the plan is agreed and the authorization line is written.

## 3. Run

- **Worktree**: `git worktree add --detach .claude/worktrees/<slug>`, no branch, nothing changed in it. It is the run's Claim: `/next` lists the slug as In progress.
- **Keep awake**: load `request_keep_awake` (`ToolSearch`) and call it with `until: "session_idle"`. If it cannot be loaded, say so in the report's 沒驗證到的地方.
- **Start**: as section 1 found; web with `preview_start`, iOS by building and then `launch`. The app cannot be started (no way found, or it fails before the first task): stop, skip to section 4 and write a report with the failure and its output only.
- **Each task**, in this order:
  1. **Newcomer**: from a clean state (a fresh tab with the site's storage and cookies cleared, or the app deleted from the Simulator and reinstalled), knowing only what the screen says.
  2. **Repeat user**, if agreed: the same task again, the way someone who has done it before would; note every step that is still needed only because the interface asks for it.
  3. **The other agreed lenses**: phone width with `resize_window` preset `mobile`, dark mode with `colorScheme: dark` (web) or `set_appearance` `dark` (iOS); after, reset the window with preset `desktop` and the scheme with `colorScheme: light` or `set_appearance` `light`, so the next task starts clean.
  4. **Free exploration**: a few minutes off the scripted path, around what the task touched.
- **A friction point**: write down where (the screen, or the component, and the code behind it where it is obvious), what you expected, what happened, and a screenshot; then mark it **UX** (it works but is hard) or **bug** (it does not do what it says).
- **Screenshots**: save each one a finding cites in the session's scratchpad directory, never in the repo. A tool screenshot whose result names the file it was saved to: copy that file. Otherwise iOS with `xcrun simctl io booted screenshot <path>`, and web by rendering the same URL, width and color scheme to a file with a headless browser on the machine (Chrome's `--headless --screenshot`, or Playwright if the project has it), only when that URL alone shows the same screen. A screen only a click sequence reaches, or no way to save one: describe the screen in the finding and say so under 沒驗證到的地方.
- **Stop** when the agreed budget is spent, every task is done, or the Context limit is reached: before each new task, look for a `Context size:` line in this conversation saying past 200k or more; if there is one, start no more tasks.

Done when: the budget is spent, every task and lens is done, or the Context limit was reached, and every friction point has its record.

## 4. Report

First stop every server, Simulator app and background process the run started, then `git worktree remove .claude/worktrees/<slug>`, so the path is free for the commit below.

Write `.scratch/<slug>/report.md`, its body in Traditional Chinese, with these sections in this order:

- **設定與範圍**: the project and commit, the interface and where it ran, how it started, the agreed tasks, lenses and budget, the duration actually used, and the authorization line.
- **觀察**: each friction point with its mark (UX or bug), where, what was expected, what happened, and its screenshot (`screenshots/<name>`) or the description that stands in for one. Bugs first, so they can go to debugging instead of a redesign.
- **建議**: ranked, each with the change, its expected effect and how confident you are (high, medium, low) and why. Recommendations only: never apply one.
- **沒驗證到的地方**: tasks, passes or lenses not reached, screenshots that could not be saved, doubts that would have been questions, anything that could not be done.

A run that could not start keeps the four sections: the failure and its output under 觀察, 建議 saying what would let it start.

Copy the screenshots the report cites into `.scratch/<slug>/screenshots/`; the rest stay in the scratchpad directory. Commit the report, those screenshots and any seed or example-config file that got generated test accounts, as `workflow.md` **Commits** says (with `Worktree: yes`, through a worktree of its own, as that rule says), message `[<slug>] report: ...`.

**Wrap-up**: push by the Push policy: `ask`, offer it in the final message; `auto`, push `main` now; `owner`, hand the command over. First compare the files with the Deploy paths as `workflow.md` says, but do not ask, since the run asks nothing after section 2: one matches, do not push or offer to, and list the matching files and the Deploy paths they match in the final message. Load `PushNotification` (`ToolSearch` with `select:PushNotification`) and send one line: the run ended, and the report's path. If it cannot be loaded or sent, say so in the final message.

The final message: the commit list and push line `global.md` asks for, the report's path, and its top recommendations.

Done when: the report and its screenshots are committed, the worktree is gone, nothing the run started is still running, and the notification is sent or its failure reported.
