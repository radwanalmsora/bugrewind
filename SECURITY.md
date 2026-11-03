# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Use GitHub's private reporting: open the repository's **Security** tab and choose
**Report a vulnerability**. Include what you found, how to reproduce it, and the version
(`bugrewind --version`).

This is a small open-source project maintained by one person. There is no guaranteed response time,
but reports are read and taken seriously.

## What to know when using BugRewind

- `bugrewind replay` and `bugrewind find` **execute the test code** of the commits they check out.
  Test code can run arbitrary commands. Only run them on repositories you trust. This is why the
  `--yes` flag is required.
- Commits are checked out into temporary `git worktree` directories. Your working tree, index and
  uncommitted changes are not modified, and the worktrees are removed afterwards.
- Environment variables whose names contain `API_KEY`, `TOKEN`, `SECRET`, `PASSWORD` or `CREDENTIAL`
  are not passed to the test process. This is a name-based filter, not a guarantee: a secret stored
  in a variable with another name is still inherited.
- BugRewind makes no network requests of its own.

## Supported versions

Only the latest released version receives fixes.
