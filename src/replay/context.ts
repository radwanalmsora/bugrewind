import { resolve } from 'node:path';
import type { TestRunResult } from '../core/types.ts';
import { hasUncommittedChanges } from '../git/repository.ts';
import { withWorktree } from '../git/worktree.ts';
import { pathExists } from '../utils/fs.ts';
import { runVitest } from './runner.ts';

export interface RunContextOptions {
  repoRoot: string;
  file?: string;
  testName?: string;
  timeoutMs: number;
  nodeModulesPath?: string;
}

const ALWAYS_LIMITATIONS = [
  'node_modules is shared from your working project; if dependencies differ between the commits, the runs do not reflect that.',
  'Only vitest is supported in this version.',
  'Environment variables, services, and data the tests depend on are not recreated.',
];

export interface RunContext {
  limitations: string[];
  runAt: (sha: string) => Promise<TestRunResult>;
}

export async function createRunContext(o: RunContextOptions): Promise<RunContext> {
  const nodeModules = resolve(o.nodeModulesPath ?? `${o.repoRoot}/node_modules`);
  const limitations = [...ALWAYS_LIMITATIONS];
  if (!(await pathExists(nodeModules))) {
    limitations.push(`no node_modules found at ${nodeModules}; the test runner will probably not be found.`);
  }
  if (await hasUncommittedChanges(o.repoRoot)) {
    limitations.push('Uncommitted changes in your working tree were not included in any run.');
  }
  const runAt = (sha: string): Promise<TestRunResult> =>
    withWorktree({ repoRoot: o.repoRoot, sha, nodeModulesPath: nodeModules }, (dir) =>
      runVitest({ cwd: dir, file: o.file, testName: o.testName, timeoutMs: o.timeoutMs }),
    );
  return { limitations, runAt };
}
