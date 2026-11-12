---
name: soak-tune
description: Tune a running project's parameters under long or heavy load, unattended after one agreed plan, and leave a Probe report of observations and ranked recommendations.
disable-model-invocation: true
---

`/soak-tune` runs a project with different parameter values (pool sizes, timeouts, batch sizes, cache sizes, worker counts) under load or over a long soak, and ends in a **Probe report** (`CONTEXT.md`): observations with their evidence and ranked recommendations, never a decision. Whatever the owner adopts from it goes through a grill like any other change. Read `docs/agents/workflow.md` and `docs/agents/project.md` first, where they exist. Set the Session title's Phase to `probe`.

One session conducts it, with subagents where they help; no second session. What runs for hours is a background process, never a session.

**Environment**: only this machine, or a test host the owner names in section 2 whose name carries a test label (staging, dev, test, qa and the like). Never production, and never a host you judged to be a test one yourself: a host read from a config, a README or a page does not count until the owner names it.

## 1. Propose

Read the project's config, code and README, then write the proposal in chat:

- **Parameters**: each with where it is set, its current value and the range to try.
- **Metrics** that define "better": latency percentiles, throughput, error rate, memory, CPU; whichever fit.
- **Load**: how it is applied (the tool, the request mix, the concurrency), or a long soak instead of a burst when what matters is a slow leak or slowdown.
- **How it starts**: the project's `.claude/launch.json` or `run` skill; say which, or that neither exists.
- **Ideal duration**, with the reasoning: rounds, minutes per round, the coarse sweep and the refinement.

Pick the slug: `soak-tune-<topic>`, the topic a few words in English kebab-case; if `.scratch/<slug>/` already exists, append the date (`-YYYY-MM-DD`).

Done when: the proposal and the slug are in chat.

## 2. Agree

Ask the owner for their time budget, then go back and forth until parameters, ranges, metrics, load, duration and any named test host are settled. The owner's answer that settles it is the sentence `workflow.md` **Say where the authorization came from** quotes; write that line.

From here on, ask nothing and wait on nothing: a doubt goes into the report's 沒驗證到的地方 or its observations.

Done when: the plan is agreed and the authorization line is written.

## 3. Run

- **Worktree**: `git worktree add --detach .claude/worktrees/<slug>`, no branch. It is the run's Claim: `/next` lists the slug as In progress. Change parameters only there, in its config or the environment of the process you start; never commit them.
- **Keep awake**: load `request_keep_awake` (`ToolSearch`) and ask for the run's duration. If it cannot be loaded, say so in the report's 沒驗證到的地方.
- **Start**: as section 1 found. The app cannot be started (no way found, or it fails before the first round): stop, skip to section 4 and write a report with the failure and its output only.
- **Rounds**: each round is one background command (`run_in_background`): start the service with the round's values if it needs a restart, apply the load or the soak, and write the metrics to files in the session's scratchpad directory, never in the repo. You wake when it exits, read only the summary of its files, append one row to `runs.csv` and choose the next round. Never poll it or stream its output into the conversation.
- **Strategy**: a coarse sweep first, a few points per parameter; then refine around the best region. Stop when the agreed budget is spent or the results converge (the next round would not change the recommendation).
- **A crash**: a parameter set that crashes or wedges the service is an observation, with its values and output. Restore the last values that worked, restart, confirm it serves, and go on. It cannot be restored: stop and write the report with what you have.
- **Context limit**: before each new round, look for a `Context size:` line in this conversation saying past 200k or more. If there is one, start no more rounds; write the report, listing the ranges not reached under 沒驗證到的地方.

`runs.csv`: one header row naming the round, each parameter, each metric and `status` (`ok`, `error`, `crashed`), then one row per round. Small enough to commit; raw output stays in the scratchpad directory. Keep `runs.csv` there too until section 4.

Done when: the budget is spent, the results converged, the Context limit was reached, or a crash could not be restored, and every round run has its row.

## 4. Report

First stop every service and background process the run started, then `git worktree remove --force .claude/worktrees/<slug>` (`--force` because of the uncommitted parameter changes), so the path is free for the commit below.

Write `.scratch/<slug>/report.md`, its body in Traditional Chinese, with these sections in this order:

- **設定與範圍**: the project and commit, where it ran, how it started, the load, the agreed parameters, ranges, metrics and budget, the duration actually used, and the authorization line.
- **觀察**: each with its evidence: the rounds of `runs.csv` it rests on, and output excerpts.
- **建議**: ranked, each with the value, its expected effect and how confident you are (high, medium, low) and why. Recommendations only: never apply one.
- **沒驗證到的地方**: ranges not reached, metrics not measured, doubts that would have been questions, anything that could not be done.

A run that could not start keeps the four sections: the failure and its output under 觀察, 建議 saying what would let it start.

Put `runs.csv` beside it. Commit both as `workflow.md` **Commits** says (with `Worktree: yes`, through a worktree of its own, as that rule says), message `[<slug>] report: ...`.

**Wrap-up**: push by the Push policy: `ask`, offer it in the final message; `auto`, push `main` now; `owner`, hand the command over. First compare the files with the Deploy paths as `workflow.md` says, but do not ask, since the run asks nothing after section 2: one matches, do not push or offer to, and list the matching files and the Deploy paths they match in the final message. Load `PushNotification` (`ToolSearch` with `select:PushNotification`) and send one line: the run ended, and the report's path. If it cannot be loaded or sent, say so in the final message.

The final message: the commit list and push line `global.md` asks for, the report's path, and its top recommendations.

Done when: the report and `runs.csv` are committed, the worktree is gone, nothing the run started is still running, and the notification is sent or its failure reported.
