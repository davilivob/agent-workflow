# Requests, Proposals included, are GitHub issues

A Proposal used to be a file committed straight onto the kit's `main` in `inbox/`. Every one moved the kit's `HEAD` on one device only, so devices' kits drifted apart and every project's next `/sync-workflow` produced a commit. Cross-repo requests between project repos needed a channel too. We made every cross-repo request, Proposals included, a GitHub issue in the repo it asks to change, and retired the Inbox, so filing one never commits anything anywhere.

## Considered Options

- **Keep the Inbox, add an inbox to every repo**: works offline and needs no `gh`, but each request stays a commit on someone's `main`, the very source of cross-device conflicts.
- **A central dispatcher repo** (or the kit as one): one place to look, but it duplicates what each repo's own issues already hold, and a dependency would point at the dispatcher instead of the repo that does the work.

## Consequences

- Filing or reading a Request needs network access and an authenticated `gh`; when it is unavailable, Continue shows the Requests group as Unknown, never as empty.
- The kit now depends on GitHub for its own change intake; moving the kit off GitHub means bringing this back.
