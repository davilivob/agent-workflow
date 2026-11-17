---
name: soak-tune
description: Tune a running project's parameters, or find its ceilings, under long or heavy load, unattended after one agreed plan, and leave a Probe report of observations and ranked recommendations, or numbers only.
disable-model-invocation: true
---

`/soak-tune` runs a project with different parameter values (pool sizes, timeouts, batch sizes, cache sizes, worker counts) under load or over a long soak, and ends in a **Probe report**: observations with their evidence and ranked recommendations, never a decision. Read `~/.claude/kit/skills/unattended-run.md` first and follow its **Unattended**, **End** and **Probe** sections; this file adds only what is the soak's own. What runs for hours is a background process, never a session.

**Environment**: locally, this machine, or a device reached from it (adb, USB, the LAN) that the owner names in Agree. Agree also settles which writes are allowed on that device (installing this run's build, changing load parameters, restarting the app); a factory reset, wiping data, or a device real users rely on, never. Measurements are always started from this machine.

## 1. Propose

Read the project's config, code and README, then write the proposal in chat:

- **Parameters**: each with where it is set, its current value and the range to try.
- **Metrics** that define "better": latency percentiles, throughput, error rate, memory, CPU; whichever fit.
- **Load**: how it is applied (the tool, the request mix, the concurrency), or a long soak instead of a burst when what matters is a slow leak or slowdown.
- **How it starts**: the project's `.claude/launch.json` or `run` skill; say which, or that neither exists.
- **Environment health**: the signals recorded alongside each round, so a broken environment is not read as the product: network reachability, system memory, free disk; for a device also its battery, temperature and link.
- **How it runs**: the session picks each round (section 3), or the night is handed to the project's own decision loop (**Handing it to a loop**), one already on `main` or one written this time as a **Probe harness**.
- **Strategy**: converge (a coarse sweep, then refine) or find a ceiling (**Ceiling**); for a ceiling, what counts as a failed step and how long the confirmation lasts.
- **Ideal duration**, with the reasoning: rounds, minutes per round, the coarse sweep and the refinement.

Pick the slug, `soak-tune-<topic>`, as **Probe** says.

Done when: the proposal and the slug are in chat.

## 2. Agree

As **Probe** says, settling parameters, ranges, metrics, load, duration, environment health, how it runs, strategy, any named test host, and any named device with the writes allowed on it.

Done when: the plan is agreed and the authorization line is written.

## 3. Run

The worktree, Claim, data, project files, harness, keep-awake, start and stop of **Probe**, and:

- **Parameters**: change them in the environment or launch arguments of the process you start, or in the worktree's config; on the main checkout a tracked file only as **Probe**'s **Project files** says. Never commit them.
- **Rounds**: each round is one background command (`run_in_background`): start the service with the round's values if it needs a restart, apply the load or the soak, and write the metrics and the Environment health to files in `.scratch/<slug>/`. You wake when it exits, read only the summary of its files, append one row to `runs.csv` and choose the next round. Never poll it or stream its output into the conversation.
- **Strategy**: converge: a coarse sweep first, a few points per parameter; then refine around the best region; stop when the agreed budget is spent or the results converge (the next round would not change the recommendation). Ceiling: as **Ceiling** says.
- **Builds**: the run never switches builds; the owner does that between nights.
- **A crash**: a parameter set that crashes or wedges the service is an observation, with its values and output. Restore the last values that worked, restart, confirm it serves, and go on. It cannot be restored: stop and write the report with what you have.
- **Context limit**: checked before each new round; the ranges not reached go where **Probe**'s **Stop** says.

`runs.csv`: one header row naming the round, `commit` (that round's `HEAD`), each parameter, each metric, each Environment health signal and `status` (`ok`, `error`, `crashed`), then one row per round, in `.scratch/<slug>/`.

**Handing it to a loop**: run the loop's self-check first, as **Probe harness** says. Start the loop detached (`setsid` or `nohup`; on Windows `Start-Process`), writing its pid and a heartbeat file into `.scratch/<slug>/` and `runs.csv` in this format. Then start a separate background command (`run_in_background`) that only waits: it exits when the pid is gone or the budget is spent. Never poll. Woken with the loop still alive: start a new waiter. The loop exits before the budget: if it can resume from its data, restart it once; it exits again, and stop and go to section 4. The Context limit is checked before each start.

**Ceiling**: per parameter, climb ×1.5 per step from the baseline; at the first failed step, bisect between it and the last passing one until they are under 10 % apart; then run the highest passing step for the long confirmation. The three numbers are defaults the owner may change in Agree. Several parameters: one at a time, the others at baseline, each with its own ceiling and confirmation.

Done when: the budget is spent, the results converged, the Context limit was reached (as **Probe**'s **Stop** says), or a crash could not be restored, and every round run has its row.

## 4. Report

As **Probe** says, with:

- Where a worktree exists, removed with `git worktree remove --force .claude/worktrees/<slug>` (`--force` because of the uncommitted parameter changes); with none, the project files restored as **Probe** says.
- **設定與範圍** adds the load, the agreed parameters, ranges and metrics. **觀察**: the evidence is the rounds of `runs.csv` each rests on, and output excerpts; for a ceiling, each ceiling, its confirmation and the readings of the first failed step. Windows where Environment health was bad are listed apart under 觀察, never used for a conclusion or a recommendation. **沒驗證到的地方** adds ranges not reached and metrics not measured.
- `runs.csv` beside the report, committed with it.

Done when: **Probe**'s Done when holds, `runs.csv` committed with the report, or with `progress.md` on a night that is not the last.
