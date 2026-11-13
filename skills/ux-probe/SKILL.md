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
- **Lenses**: from the second pass as a repeat user, phone width, dark mode and **visual** (below), the ones that fit, each dropped one with why (an iOS app has no "phone width"; an app with no dark theme has no dark mode).
- **Design reference**, if the visual lens is proposed: any found in the repo (design tokens such as CSS variables, a Tailwind config or a tokens file; a written brand guide), or that there is none and the owner may name one.
- **How it starts**: the project's `.claude/launch.json` or `run` skill, or for iOS its own build; say which, or that none exists.
- **Ideal duration**, with the reasoning: tasks, passes and lenses, and the free exploration after each task.

Pick the slug, `ux-probe-<topic>`, as **Probe** says.

Done when: the proposal and the slug are in chat, or the interface is unsupported and that is said.

## 2. Agree

As **Probe** says, settling tasks, lenses, duration, any named test host and, with the visual lens, the design reference, if any: one from the repo, a brand guide, screenshots or design files, or a URL the owner names here (only looked at, never operated).

Done when: the plan is agreed and the authorization line is written.

## 3. Run

The worktree (nothing changed in it), keep-awake, start and stop of **Probe**, and:

- **Start**: web with `preview_start`, iOS by building and then `launch`.
- **Each task**, in this order:
  1. **Newcomer**: from a clean state (a fresh tab with the site's storage and cookies cleared, or the app deleted from the Simulator and reinstalled), knowing only what the screen says.
  2. **Repeat user**, if agreed: the same task again, the way someone who has done it before would; note every step that is still needed only because the interface asks for it.
  3. **The other agreed lenses**: phone width with `resize_window` preset `mobile`, dark mode with `colorScheme: dark` (web) or `set_appearance` `dark` (iOS); after, reset the window with preset `desktop` and the scheme with `colorScheme: light` or `set_appearance` `light`, so the next task starts clean. The visual lens runs on every screen the task reached, as **Visual lens** says.
  4. **Free exploration**: a few minutes off the scripted path, around what the task touched.
- **A friction point**: write down where (the screen, or the component, and the code behind it where it is obvious), what you expected, what happened, and a screenshot; then mark it **UX** (it works but is hard) or **bug** (it does not do what it says).
- **Screenshots**: save each one a finding cites in the session's scratchpad directory, never in the repo. A tool screenshot whose result names the file it was saved to: copy that file. Otherwise iOS with `xcrun simctl io booted screenshot <path>`, and web by rendering the same URL, width and color scheme to a file with a headless browser on the machine (Chrome's `--headless --screenshot`, or Playwright if the project has it), only when that URL alone shows the same screen. A screen only a click sequence reaches, or no way to save one: describe the screen in the finding and say so under 沒驗證到的地方.
- **Stop** also when every task is done. **Context limit**: checked before each new task.

Done when: the budget is spent, every task and lens is done, or the Context limit was reached, and every friction point has its record.

## Visual lens

Checks every screen a task reached against stated thresholds; never taste. Each finding is marked **UX** and names the measured value, the standard or convention, and its threshold, e.g. "contrast 3.1:1, WCAG 1.4.3 AA requires 4.5:1".

**Web**: measure with `javascript_tool`, reading computed styles and bounding boxes only, never changing the page. With the dark mode lens agreed, measure contrast in both schemes.

- **Standards** (confidence high): text contrast at least 4.5:1, 3:1 for large text (WCAG 1.4.3 AA); target size at least 24×24 CSS px for buttons, standalone links and form controls, links inside a sentence exempt (WCAG 2.5.8 AA); no horizontal scroll at 320px width (WCAG 1.4.10); no overlapping or clipped elements.
- **Conventions** (confidence medium, each named as a convention, not a standard): body text under 16px; line height under 1.4; lines over 75 characters. Only that side of each is a finding.
- **Consistency**: count the font families, font sizes and button styles in use and list the counts under 設定與範圍; a count is a finding only where it departs from the design reference.

**iOS**: from screenshots only, no measurements: clipped text, overlapping elements, targets plainly under 44×44pt (HIG). Repeat each screen at Dynamic Type XXXL and AX5 (`xcrun simctl ui booted content_size extra-extra-extra-large`, then `accessibility-extra-extra-extra-large`); AX5 findings are confidence medium. Reset with `content_size large` after.

**Design reference**, only if agreed: compare against it, never against taste. Tokens or a brand guide: the measured colors, fonts and sizes against its values. Screenshots, design files or a URL: side-by-side screenshots, each difference named concretely ("the primary button's corner radius differs from the reference"), never "looks worse". No reference: no aesthetic findings.

## 4. Report

As **Probe** says, with:

- The worktree removed with `git worktree remove .claude/worktrees/<slug>`; the Simulator app stopped too.
- **設定與範圍** adds the interface, the agreed tasks and lenses, the design reference if any, and the visual lens's consistency counts. **觀察**: each friction point with its mark (UX or bug), where, what was expected, what happened, and its screenshot (`screenshots/<name>`) or the description that stands in for one; bugs first, so they can go to debugging instead of a redesign. **沒驗證到的地方** adds tasks, passes or lenses not reached and screenshots that could not be saved.
- The screenshots the report cites copied into `.scratch/<slug>/screenshots/` (the rest stay in the scratchpad directory) and committed with it, with any seed or example-config file that got generated test accounts.

Done when: **Probe**'s Done when holds, its screenshots committed with the report.
