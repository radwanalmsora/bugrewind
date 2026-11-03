# BugRewind

> Every bug has a history. Rewind it.

BugRewind investigates **why a test started failing between two commits**, using real test execution
instead of guesses.

**Status: early development (v0.1, phase 1).** Only `bugrewind replay` is implemented. Everything
else in the roadmap below is *not* implemented yet.

## What works today

`bugrewind replay` runs the same [vitest](https://vitest.dev) selection on a baseline commit and a
head commit, each in its own temporary `git worktree`, and compares the results:

| Baseline | Head | Verdict |
|----------|------|---------|
| pass | fail | `regression-reproduced` |
| pass | pass | `not-reproduced` |
| fail | fail | `already-failing` |
| fail | pass | `fixed-in-head` |
| anything else (no tests found, crash, timeout) | | `inconclusive` |

It never reports a pass it did not observe. `regression-reproduced` means the behavior differs
between the two commits; it does **not** say which change caused it.

## Requirements

- Node.js 20 or newer (Linux or macOS; Windows is not supported yet)
- git
- A project that uses vitest, with dependencies installed (`node_modules` is linked into the worktrees)

## Develop

```bash
npm install
npm test
npm run typecheck
```

## Usage

```bash
npm run dev -- replay --base HEAD~1 --head HEAD --file src/auth/session.test.ts --yes
npm run dev -- replay --base v1.2.0 --head main --test "refreshSession" --json --yes
```

| Option | Meaning |
|--------|---------|
| `--base <ref>` | baseline commit or ref (default `HEAD~1`) |
| `--head <ref>` | head commit or ref (default `HEAD`) |
| `--file <path>` | test file to run |
| `--test <pattern>` | test name pattern (vitest `-t`) |
| `--timeout <s>` | timeout per run (default 120) |
| `--node-modules <path>` | node_modules to link into the worktrees |
| `--json` | machine-readable output |
| `--yes` | required: confirms test code from both commits may run on this machine |

Exit codes: `0` no regression observed or fixed, `1` regression reproduced, `2` usage or runtime error,
`3` inconclusive or already failing.

## Safety

- Your working tree, index, and uncommitted changes are never modified.
- Test code is executed only with `--yes`. Test code can run arbitrary commands: use it on code you trust.
- Variables whose names look like secrets (`*API_KEY*`, `*TOKEN*`, `*SECRET*`, `*PASSWORD*`) are not passed to the test process.
- Nothing is sent over the network. There is no AI component in this version.

## Limitations

- vitest only.
- `node_modules` is shared from your project; dependency differences between commits are not reproduced.
- Environment variables, services, and data that tests need are not recreated.
- Uncommitted changes are not included in either run.

## Roadmap (not implemented)

Evidence engine and reports, AST-based impact analysis, optional AI analysis (OpenAI/Gemini),
MCP server, regression-test generation.

## License

MIT
