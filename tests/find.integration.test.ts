import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { find } from '../src/replay/bisect.ts';

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
const shas: string[] = [];

async function commit(i: number, body?: string): Promise<void> {
  await writeFile(join(repo, 'notes.txt'), `${i}\n`);
  if (body !== undefined) await writeFile(join(repo, 'add.ts'), body);
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', `c${i}`);
  shas.push(git(repo, 'rev-parse', 'HEAD').trim());
}

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'bugrewind-find-'));
  git(repo, 'init', '-q', '-b', 'main');
  await writeFile(join(repo, 'add.test.ts'), TEST);
  await commit(1, GOOD);
  await commit(2);
  await commit(3);
  await commit(4, BAD); // the culprit
  await commit(5);
  await commit(6);
  await commit(7);
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

describe('find (real vitest, real git worktrees)', () => {
  it('finds the first failing commit, verified by running its parent and itself', async () => {
    const r = await find({ ...opts(), good: shas[0] as string, bad: shas[6] as string });
    expect(r.verdict).toBe('culprit-found');
    expect(r.culprit?.sha).toBe(shas[3]);
    expect(r.culprit?.subject).toBe('c4');
    expect(r.culprit?.files).toContain('add.ts');
    expect(r.culprit?.parentRun.status).toBe('pass');
    expect(r.culprit?.run.status).toBe('fail');
    expect(r.steps.length).toBeLessThan(r.candidateCommits + 2);
  });

  it('reports no regression when the tests pass on both ends', async () => {
    const r = await find({ ...opts(), good: shas[0] as string, bad: shas[2] as string });
    expect(r.verdict).toBe('no-regression');
    expect(r.culprit).toBeUndefined();
  });

  it('is inconclusive when the "good" commit does not actually pass', async () => {
    const r = await find({ ...opts(), good: shas[4] as string, bad: shas[6] as string });
    expect(r.verdict).toBe('inconclusive');
    expect(r.culprit).toBeUndefined();
  });

  it('rejects a reversed range', async () => {
    await expect(find({ ...opts(), good: shas[5] as string, bad: shas[1] as string })).rejects.toThrow(/not an ancestor/);
  });

  it('leaves no worktrees behind', () => {
    expect(git(repo, 'worktree', 'list').trim().split('\n')).toHaveLength(1);
  });
});
