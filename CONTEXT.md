# kit

The owner's agent workflow: the rules, templates and skills every project and device shares.

## Language

**Owner**:
The one person who decides designs, reviews specs, and alone runs `git push`, production writes and SSH.
_Avoid_: user, maintainer

**Template**:
A file in `templates/` that `/init-workflow` copies into a repo; `workflow.md` is carried verbatim under a `Template: <sha>` line.

**Guard**:
The hook that mechanically enforces the owner boundary and the commit rules. The written rule stays the single source; the guard is its backstop.
_Avoid_: guardrail, git hook
