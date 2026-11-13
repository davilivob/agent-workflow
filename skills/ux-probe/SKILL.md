---
name: ux-probe
description: Work through a project's web or iOS interface as its users would, unattended after one agreed plan, and leave a Probe report of friction points, bugs and ranked recommendations.
disable-model-invocation: true
---

`/ux-probe` does a project's user tasks in its real interface, as a newcomer and again as a repeat user, records every point where it got stuck, took a detour or could not tell what to do, and ends in a **Probe report**: observations with their evidence and ranked recommendations, never a decision. Read `~/.claude/kit/skills/unattended-run.md` first and follow its **Unattended**, **End** and **Probe** sections; this file adds only what is the probe's own. It never changes the project's code, config or data, the seed or example config for generated test accounts aside.

**Interfaces**: a web interface in the built-in browser (the `mcp__Claude_Browser__*` tools), an iOS app in the Simulator (the `mcp__Claude_Code_iOS_Simulator__*` tools). Both work in the background: never open the Simulator panel or front a tab for yourself. A CLI, a TUI or a desktop app is not supported: say so in the proposal and stop.

**Environment**: locally, only a local development host (`localhost`, `127.0.0.1`, `[::1]`, a name ending in `.localhost` or `.test`). Test accounts and test data: generate them, or take them from the project's seed, fixture or example-config files; write any you generate into the seed or example config in the main checkout, never in the worktree, and never repeat them in chat. A real credential is never entered.

## 1. Propose

Read the project's README and code, then write the proposal in chat:

- **Tasks**: what real users come to do, each one sentence with the state that means it is done, e.g. "a new user signs up and creates a first project: the project's page shows its name".
- **Lenses**: from the second pass as a repeat user, phone width, dark mode and visual (see **Visual lens**), the ones that fit, each dropped one with why (an iOS app has no "phone width"; an app with no dark theme has no dark mode).
- **How it starts**: the project's `.claude/launch.json` or `run` skill, or for iOS its own build; say which, or that none exists.
- **Ideal duration**, with the reasoning: tasks, passes and lenses, and the free exploration after each task.

Pick the slug, `ux-probe-<topic>`, as **Probe** says.

Done when: the proposal and the slug are in chat, or the interface is unsupported and that is said.

## 2. Agree

As **Probe** says, settling tasks, lenses, duration and any named test host.

Done when: the plan is agreed and the authorization line is written.

## 3. Run

The worktree (nothing changed in it), keep-awake, start and stop of **Probe**, and:

- **Start**: web with `preview_start`, iOS by building and then `launch`.
- **Each task**, in this order:
  1. **Newcomer**: from a clean state (a fresh tab with the site's storage and cookies cleared, or the app deleted from the Simulator and reinstalled), knowing only what the screen says.
  2. **Repeat user**, if agreed: the same task again, the way someone who has done it before would; note every step that is still needed only because the interface asks for it.
  3. **The other agreed lenses**: phone width with `resize_window` preset `mobile`, dark mode with `colorScheme: dark` (web) or `set_appearance` `dark` (iOS); after, reset the window with preset `desktop` and the scheme with `colorScheme: light` or `set_appearance` `light`, so the next task starts clean. The visual lens checks every screen the task reached, in the dark scheme too while the dark mode lens is on, as **Visual lens** says.
  4. **Free exploration**: a few minutes off the scripted path, around what the task touched.
- **A friction point**: write down where (the screen, or the component, and the code behind it where it is obvious), what you expected, what happened, and a screenshot; then mark it **UX** (it works but is hard) or **bug** (it does not do what it says).
- **Screenshots**: save each one a finding cites in the session's scratchpad directory, never in the repo. A tool screenshot whose result names the file it was saved to: copy that file. Otherwise iOS with `xcrun simctl io booted screenshot <path>`, and web by rendering the same URL, width and color scheme to a file with a headless browser on the machine (Chrome's `--headless --screenshot`, or Playwright if the project has it), only when that URL alone shows the same screen. A screen only a click sequence reaches, or no way to save one: describe the screen in the finding and say so under 沒驗證到的地方.
- **Stop** also when every task is done. **Context limit**: checked before each new task.

Done when: the budget is spent, every task and lens is done, or the Context limit was reached, and every friction point has its record.

## 4. Report

As **Probe** says, with:

- The worktree removed with `git worktree remove .claude/worktrees/<slug>`; the Simulator app stopped too.
- **設定與範圍** adds the interface, the agreed tasks and lenses. **觀察**: the visual lens's consistency counts first, unmarked and not friction points; then each friction point with its mark (UX or bug), where, what was expected, what happened, and its screenshot (`screenshots/<name>`) or the description that stands in for one; bugs first, so they can go to debugging instead of a redesign. **沒驗證到的地方** adds tasks, passes or lenses not reached and screenshots that could not be saved.
- The screenshots the report cites copied into `.scratch/<slug>/screenshots/` (the rest stay in the scratchpad directory) and committed with it, with any seed or example-config file that got generated test accounts.

Done when: **Probe**'s Done when holds, its screenshots committed with the report.

## Visual lens

Readability and layout against stated thresholds, never taste: no aesthetic findings. Each finding is marked **UX** and names the measured value, the standard or convention, and its threshold, e.g. "contrast 3.1:1, WCAG 1.4.3 AA requires 4.5:1". The thresholds are this skill's; `project.md` does not change them. A recommendation built on a standard has confidence high, on a convention or AX5 medium, that being its why.

**Web**: measure with `javascript_tool`, reading computed styles and bounding boxes only, never changing the page.

- **Standards**: text contrast at least 4.5:1, or 3:1 for large text, 24px and up or 18.66px and up at weight 700 or more (WCAG 1.4.3 AA); target size at least 24×24 CSS px for buttons, standalone links and form controls, links inside a sentence exempt (WCAG 2.5.8 AA); no horizontal scroll at 320 CSS px width, checked with `resize_window` width 320, height 800, then preset `desktop` (WCAG 1.4.10 AA); no overlapping or clipped elements.
- **Conventions**, each named as a convention, not a standard: body text under 16px, line height under 1.4, lines over 75 characters. The opposite side is never a finding.
- **Consistency**: count the font families, font sizes and button styles in use, for the head of 觀察.

**iOS**: from screenshots only, no measurements: clipped text, overlapping elements, targets plainly under 44×44pt (HIG). Repeat each screen at Dynamic Type XXXL, `xcrun simctl ui booted content_size extra-extra-extra-large`, and at the largest accessibility size, AX5, `xcrun simctl ui booted content_size accessibility-extra-extra-extra-large`; after, reset with `xcrun simctl ui booted content_size large`.
