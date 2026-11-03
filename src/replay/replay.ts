import { resolve } from 'node:path';
import type { ReplayOptions, ReplayResult } from '../core/types.ts';
import { hasUncommittedChanges, resolveCommit } from '../git/repository.ts';
import { withWorktree } from '../git/worktree.ts';
import { pathExists } from '../utils/fs.ts';
import { classify } from './regression.ts';
import { runVitest } from './runner.ts';

const ALWAYS_LIMITATIONS = [
  'node_modules is shared from your working project; if dependencies differ between the two commits, the runs do not reflect that.',
  'Only vitest is supported in this version.',
  'Environment variables, services, and data the tests depend on are not recreated.',
];

export async function replay(o: ReplayOptions): Promise<ReplayResult> {
  const baseSha = await resolveCommit(o.repoRoot, o.base);
  const headSha = await resolveCommit(o.repoRoot, o.head);
  if (baseSha === headSha) {
    throw new Error('base and head resolve to the same commit; there is nothing to compare');
  }

  const nodeModules = resolve(o.nodeModulesPath ?? `${o.repoRoot}/node_modules`);
  const limitations = [...ALWAYS_LIMITATIONS];
  if (!(await pathExists(nodeModules))) {
    limitations.push(`no node_modules found at ${nodeModules}; the test runner will probably not be found.`);
  }
  if (await hasUncommittedChanges(o.repoRoot)) {
    limitations.push('Uncommitted changes in your working tree were not included in either run.');
  }

  const runAt = (sha: string) =>
    withWorktree({ repoRoot: o.repoRoot, sha, nodeModulesPath: nodeModules }, (dir) =>
      runVitest({ cwd: dir, file: o.file, testName: o.testName, timeoutMs: o.timeoutMs }),
    );

  const baseRun = await runAt(baseSha);
  const headRun = await runAt(headSha);
  const { verdict, explanation } = classify(baseRun, headRun);

  return {
    base: { ref: o.base, sha: baseSha, run: baseRun },
    head: { ref: o.head, sha: headSha, run: headRun },
    verdict,
    explanation,
    limitations,
  };
}
