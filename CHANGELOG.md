# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- GitHub Actions CI (typecheck, tests, build, CLI smoke test) on Node 20, 22 and 24.
- `CONTRIBUTING.md` and `SECURITY.md`.

## [0.2.0] - 2026-11-03

### Added
- `bugrewind find`: binary search between a good and a bad commit for the first commit where the
  selected vitest tests fail. A culprit is reported only after its predecessor and the culprit
  itself were both executed.

### Changed
- `replay` and `find` share one run context.

## [0.1.0] - 2026-11-03

### Added
- `bugrewind replay`: runs the same vitest selection on a baseline and a head commit in isolated
  git worktrees and reports `regression-reproduced`, `not-reproduced`, `already-failing`,
  `fixed-in-head` or `inconclusive`.
