## Workflow

Before any work, read `docs/agents/workflow.md` and `docs/agents/project.md`. `workflow.md` is identical in every project and synced with `/init-workflow`; everything particular to this repo is in `project.md`.

## Agent skills

### Issue tracker

Issues and specs are markdown files in `.scratch/<feature-slug>/`, one directory per feature. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical role names, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the root plus `docs/adr/`. See `docs/agents/domain.md`.
