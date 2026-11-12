---
name: soak-tune
description: Tune a running project's parameters under long or heavy load, unattended after one agreed plan, and leave a Probe report of observations and ranked recommendations.
disable-model-invocation: true
---

`/soak-tune` runs a project with different parameter values (pool sizes, timeouts, batch sizes, cache sizes, worker counts) under load or over a long soak, and ends in a **Probe report**: observations with their evidence and ranked recommendations, never a decision. Read `~/.claude/kit/skills/unattended-run.md` first and follow its **Unattended**, **End** and **Probe** sections; this file adds only what is the soak's own. What runs for hours is a background process, never a session.

**Environment**: locally, only this machine.

## 1. Propose

Read the project's config, code and README, then write the proposal in chat:

- **Parameters**: each with where it is set, its current value and the range to try.
- **Metrics** that define "better": latency percentiles, throughput, error rate, memory, CPU; whichever fit.
- **Load**: how it is applied (the tool, the request mix, the concurrency), or a long soak instead of a burst when what matters is a slow leak or slowdown.
- **How it starts**: the project's `.claude/launch.json` or `run` skill; say which, or that neither exists.
- **Ideal duration**, with the reasoning: rounds, minutes per round, the coarse sweep and the refinement.

Pick the slug, `soak-tune-<topic>`, as **Probe** says.

Done when: the proposal and the slug are in chat.

## 2. Agree

As **Probe** says, settling parameters, ranges, metrics, load, duration and any named test host.

Done when: the plan is agreed and the authorization line is written.

## 3. Run

The worktree, keep-awake, start and stop of **Probe**, and:

- **Parameters**: change them only in the worktree, in its config or the environment of the process you start; never commit them.
- **Rounds**: each round is one background command (`run_in_background`): start the service with the round's values if it needs a restart, apply the load or the soak, and write the metrics to files in the session's scratchpad directory, never in the repo. You wake when it exits, read only the summary of its files, append one row to `runs.csv` and choose the next round. Never poll it or stream its output into the conversation.
- **Strategy**: a coarse sweep first, a few points per parameter; then refine around the best region. Stop when the agreed budget is spent or the results converge (the next round would not change the recommendation).
- **A crash**: a parameter set that crashes or wedges the service is an observation, with its values and output. Restore the last values that worked, restart, confirm it serves, and go on. It cannot be restored: stop and write the report with what you have.
- **Context limit**: checked before each new round; the ranges not reached go under 沒驗證到的地方.

`runs.csv`: one header row naming the round, each parameter, each metric and `status` (`ok`, `error`, `crashed`), then one row per round. Small enough to commit; raw output stays in the scratchpad directory. Keep `runs.csv` there too until section 4.

Done when: the budget is spent, the results converged, the Context limit was reached, or a crash could not be restored, and every round run has its row.

## 4. Report

As **Probe** says, with:

- The worktree removed with `git worktree remove --force .claude/worktrees/<slug>` (`--force` because of the uncommitted parameter changes).
- **設定與範圍** adds the load, the agreed parameters, ranges and metrics. **觀察**: the evidence is the rounds of `runs.csv` each rests on, and output excerpts. **沒驗證到的地方** adds ranges not reached and metrics not measured.
- `runs.csv` beside the report, committed with it.

Done when: **Probe**'s report is done, `runs.csv` included.
