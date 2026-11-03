import { execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { replay } from '../src/replay/replay.ts';

// These tests run the REAL vitest inside temporary git worktrees.
const ourNodeModules = join(process.cwd(), 'node_modules');

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

const GOOD = 'export const add = (a: number, b: number): number => a + b;\n';
const BAD = 'export const add = (a: number, b: number): number => a - b;\n';
const TEST = `import { expect, test } from 'vitest';
import { add } from './add.ts';
test('adds', () => {
  expect(add(1, 2)).toBe(3);
});
`;

let repo = '';
let c1 = '';
let c2 = '';
let c3 = '';

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'bugrewind-it-'));
  git(repo, 'init', '-q', '-b', 'main');
  await writeFile(join(repo, 'add.ts'), GOOD);
  await writeFile(join(repo, 'add.test.ts'), TEST);
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'good');
  c1 = git(repo, 'rev-parse', 'HEAD').trim();
  await writeFile(join(repo, 'add.ts'), BAD);
  git(repo, 'commit', '-qam', 'break');
  c2 = git(repo, 'rev-parse', 'HEAD').trim();
  await writeFile(join(repo, 'add.ts'), GOOD);
  git(repo, 'commit', '-qam', 'fix');
  c3 = git(repo, 'rev-parse', 'HEAD').trim();
});

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

const opts = () => ({
  repoRoot: repo,
  file: 'add.test.ts',
  timeoutMs: 90_000,
  nodeModulesPath: ourNodeModules,
});

describe('replay (real vitest, real git worktrees)', () => {
  it('reproduces a regression', async () => {
    const r = await replay({ ...opts(), base: c1, head: c2 });
    expect(r.base.run.status).toBe('pass');
    expect(r.head.run.status).toBe('fail');
    expect(r.verdict).toBe('regression-reproduced');
  });

  it('detects a fix and a non-regression', async () => {
    expect((await replay({ ...opts(), base: c2, head: c3 })).verdict).toBe('fixed-in-head');
    expect((await replay({ ...opts(), base: c1, head: c3 })).verdict).toBe('not-reproduced');
  });

  it('is inconclusive when the test file does not exist', async () => {
    const r = await replay({ ...opts(), file: 'missing.test.ts', base: c1, head: c2 });
    expect(r.verdict).toBe('inconclusive');
  });

  it('leaves the user working tree alone and cleans up', async () => {
    await writeFile(join(repo, 'wip.txt'), 'unsaved work\n');
    const r = await replay({ ...opts(), base: c1, head: c2 });
    expect(r.limitations.some((l) => l.includes('Uncommitted'))).toBe(true);
    expect(await readFile(join(repo, 'wip.txt'), 'utf8')).toBe('unsaved work\n');
    expect(git(repo, 'worktree', 'list').trim().split('\n')).toHaveLength(1);
    await access(ourNodeModules);
    await rm(join(repo, 'wip.txt'));
  });

  it('rejects unknown refs and identical commits', async () => {
    await expect(replay({ ...opts(), base: 'no-such-ref', head: c2 })).rejects.toThrow(/cannot resolve/);
    await expect(replay({ ...opts(), base: c2, head: c2 })).rejects.toThrow(/same commit/);
  });
});
