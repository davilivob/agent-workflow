---
name: rule-audit
description: Run a Rule audit of this repo's own rule layer, find misplaced, duplicated, self-assigned and superseded rules, and apply the owner's marks.
disable-model-invocation: true
---

A **Rule audit** (`CONTEXT.md`) checks this repo's own rules, never the files the kit carries in, and ends with a smaller rule layer, not a to-do list. Read `docs/agents/workflow.md` and `docs/agents/project.md` first, where they exist. Set the Session title's Phase to `audit`.

## 1. Rule layer

List the files, with their character counts. The Drift hook (`hooks/drift.cjs`, `inRuleLayer`) sizes the same list for its reminder: change both together.

- Every `CLAUDE.md`, `AGENTS.md` and `CONTEXT.md` anywhere in the repo, outside `node_modules`, `.git` and `.claude/worktrees`.
- Everything under `docs/agents/` except the files the kit carries in: `workflow.md`, `issue-tracker.md`, `domain.md`. `project.md` is this repo's own and is in, except the `## Dev server` section `/sync-workflow` appends from the kit's `templates/dev-server.md`.
- `docs/silent-failures.md`, `docs/adr/`, `.claude/skills/*/SKILL.md`.
- In the kit itself (its git common dir is the one `~/.claude/kit` resolves to), also `templates/`, `skills/` and `global.md`.

Leave out the `## ` sections `/sync-workflow` writes into the root `CLAUDE.md` from the kit's `templates/claude-section.md` (outside the kit): they are the kit's. Code and other docs (README and the like) are out of scope; `ponytail-audit` covers code.

Done when: the list and its total are written in chat.

## 2. Find

One subagent reads the files in place, in this working directory: no copy, because an old copy is how stale findings start. It only analyses and changes nothing. Give it the list, the four kinds, the yardstick and the known false positives below, and ask for every finding with the fields of section 4.

**Kinds**:

- **A, misplaced**: content in a file whose job is something else, such as how to work written into a state file.
- **B, harmful duplicate**: one thing written in two places that disagree, or that will silently go stale when one is edited.
- **C, self-added rule**: a rule whose subject is the owner, or that hands the owner work, which the owner never asked for. Look for its origin in `git log -S`, the specs and grill records under `.scratch/`, and ADRs. None found: mark it "no source found" and delete it.
- **D, superseded**: a rule restating what the Guard, the Drift hook, a skill or a kit rule already does.

**Yardstick**: first the repo's own description of each file's job (for example what `workflow.md` says goes into `project.md` and into `docs/silent-failures.md`). Where it has none: a state file holds only how things are now; how to do something always belongs in a rule file; two files whose occasions to be read almost coincide are merged.

**Known false positives**, never reported:

- a self-check list that repeats its own main file;
- the same hard rule stated at different levels (global, repo, skill);
- an inline legend;
- a "read this only when" note beside a routing table;
- an operating rule tightly coupled to the data it sits next to;
- a deliberate summary plus a pointer to the full text;
- anything carrying a short note that it is deliberately kept (section 6).

Done when: the subagent has handed back its findings.

## 3. Check

Open every finding's file yourself and confirm the text is there and the finding holds; drop what does not. Keep a separate list of what looks like a problem but should stay, each with why (a deliberate summary plus pointer always goes here).

Done when: every finding left was confirmed against its file.

## 4. Table

Post the table in chat only; never write it to a file. One row per finding: kind; where (file and the first few words); characters; where it should go; why, citing the yardstick it fails; whether moving or deleting it breaks a pointer elsewhere; the mark: **delete**, **trim**, **keep** or **ask**, with a one-line reason.

Order by how likely the rule is to make someone act wrongly: duplicates that disagree on something that affects a decision, then dead pointers, then references by number, then plain misplacement. After the table, the list from section 3 under "Looks wrong, stays".

Done when: the table and the "stays" list are in chat.

## 5. Marks

You mark every row yourself; the owner asked to be asked little, so no grill. Two copies that disagree: keep the one that the latest commit, spec or ADR on it settled (`git log -S`), or failing that the one matching what the Guard, the Drift hook or the skill actually does, and trim the other to a pointer. Unsure between trim and keep: keep, since a kept rule costs only characters, a wrong delete costs behaviour. Every mark lands in a commit, so the owner overrules any of them afterwards with a revert.

Mark **ask** only where a wrong guess is costly and no source settles it: two copies that disagree on a decision with neither the record nor the tools siding with one, or a rule about the owner boundary, a push or a deploy. At most four per audit, the costliest first; the rest you decide. Ask them in one `AskUserQuestion` call, one question each, your recommendation as the first option.

Done when: every row has a mark and its reason, and every ask has the owner's answer.

## 6. Apply

Apply every row not marked ask right after the table, without waiting; each ask, once answered, as the answer's mark.

- **Delete, trim**: one commit per item or per group of related items, `[rule-audit] <delete|trim>: <item>`, the reason in the body. Commits land as `workflow.md` **Commits** says.
- **Keep, deliberate**: add one short line where it stands saying why it stays as it is, so the next audit does not report it; commit it as `[rule-audit] keep: <item>`.

Every commit message carries `[rule-audit]`: the Drift hook dates the last audit by it. The decisions live in those messages only; no audit file is committed.

Then grep the rule layer for every file name and heading the changes removed or moved, and fix any pointer left dangling, in the same kind of commit.

Done when: every delete, trim and keep is committed, no pointer dangles, and the report tells the owner any of them can be reverted on their word.
