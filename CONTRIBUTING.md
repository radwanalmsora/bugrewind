# Contributing to BugRewind

Thanks for helping. This project has one rule above all: **never report something that was not
observed.** A pass, a failure, or a culprit must come from a test run that actually happened.
When the evidence is not enough, the answer is `inconclusive`.

## Setup

```bash
git clone https://github.com/radwanalmsora/bugrewind.git
cd bugrewind
npm install
npm test
npm run typecheck
```

Requirements: Node.js 20 or newer, git, Linux or macOS.

During development the CLI runs the TypeScript sources directly (this needs a Node version that can
strip types, such as Node 22.18+ or 24):

```bash
npm run dev -- replay --base HEAD~1 --head HEAD --file tests/classify.test.ts --yes
```

## Guidelines

- **Tests are required** for behavior changes. Prefer tests that run the real thing (real git,
  real vitest) over mocks; see `tests/*.integration.test.ts`.
- **Keep pure logic separate** from process and git calls so it can be unit-tested
  (see `classifyRun` and `classify`).
- **Use `import type`** for type-only imports and write imports with the `.ts` extension. The build
  rewrites them to `.js`.
- **Erasable TypeScript only**: no enums, namespaces or constructor parameter properties.
- **Never run repository scripts or test code without the user's explicit consent.**
- **Never modify the user's working tree.**
- Be honest in the README: do not list a feature as available before it works and is tested.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).
- Describe what you ran to verify the change.
- CI (typecheck, tests, build, CLI smoke test) must pass.
- Add an entry to `CHANGELOG.md` under `[Unreleased]`.
