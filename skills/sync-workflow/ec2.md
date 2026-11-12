# EC2 deploy

`/sync-workflow`'s extra steps when the owner answers yes to "Does it deploy to EC2?". Each section here adds to the `SKILL.md` section of the same name.

## Project values

`DEPLOY_WF` is `.github/workflows/deploy.yml` if it exists, else the first workflow that builds an image or runs compose (`grep -lE 'docker/build-push-action|docker compose|docker-compose' .github/workflows/* 2>/dev/null | head -n 1`); empty means none.

- `DEPLOY_WF` empty: one more `AskUserQuestion` for the template's parameters: each image's name and build context (default: the repo's directory name and `.`; "Other" lists several, one `<name> <context>` per line — names lowercase, as GHCR wants), the liveness port, and the host (a name the owner recognises it by, e.g. the EC2 instance's; not its address — that goes into the `VPS_HOST` secret). The workflow ships `compose.yaml` on every deploy, so the Deploy paths take `compose.yaml` and `.github/workflows/deploy.yml` too: add whichever is missing and say so. Section 5 writes the workflow.
- `DEPLOY_WF` set: never overwrite it. Ask only the liveness port and the host, for `project.md`, and keep `diff -u ~/.claude/kit/templates/deploy-ec2.yml "$DEPLOY_WF"` for the report: the owner decides whether to align it by hand. The repo's own growth (two images, a subdirectory) stays.

The template carries no `Template:` line, and no later run of this skill compares or rewrites the written workflow: it is the repo's from then on.

## Write

One more file:

| Repo file | Content |
| --- | --- |
| `.github/workflows/deploy.yml` | EC2 with `DEPLOY_WF` empty only: `templates/deploy-ec2.yml` with `{{DEPLOY_PATHS}}` → one `      - <path>` line per Deploy path, quoted when it starts with `!` or `*`; `{{VERIFY_STEPS}}` → steps indented like the others that set up the stack's toolchain on the runner, install, and run the verification command (e.g. `oven-sh/setup-bun@v2`, `bun install --frozen-lockfile`, the command), each with `working-directory:` when the project sits in a subdirectory, or, when there is none or it cannot run on a Linux runner (Unity, an OS-bound command), these placeholder lines and the comment above them removed; the `Build and push {{IMAGE}}` step (not the comment above it) repeated once per image, `{{IMAGE}}` → its name, `{{CONTEXT}}` → its context; `{{PORT}}` → the liveness port. No `{{UPPERCASE}}` placeholder may remain (`grep -E '\{\{[A-Z_]+\}\}'` prints nothing; `${{ ... }}` is GitHub's own) |

## Commit and report

- EC2 with the workflow written: hand over the four repo secrets, each command in its own `bash` block, with `<repo>` the `Remote:` value. The owner runs them and types each value; a secret's value never passes through you. `SSH_KEY` is multi-line, so it reads the key file the owner names:
  - `gh secret set SSH_KEY -R <repo> < ~/.ssh/<key file>`
  - `gh secret set VPS_HOST -R <repo>`
  - `gh secret set VPS_USER -R <repo>`
  - `gh secret set DEPLOY_PATH -R <repo>`

  Then say that the repo's `compose.yaml`, copied to the host on every deploy, must name its images `ghcr.io/<owner, lowercase>/<name>:latest`, and that the host needs the `DEPLOY_PATH` directory and its own `.env` there, both the owner's. With `DEPLOY_WF` set, give the kept diff instead, and no secret commands.
