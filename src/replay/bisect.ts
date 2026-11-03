import type { FindResult, FindStep, TestRunResult } from '../core/types.ts';
import {
  commitInfo,
  isAncestor,
  listFirstParent,
  resolveCommit,
} from '../git/repository.ts';
import { createRunContext } from './context.ts';
import type { RunContextOptions } from './context.ts';

export interface FindOptions extends RunContextOptions {
  good: string;
  bad: string;
  onProgress?: (message: string) => void;
}

const short = (sha: string): string => sha.slice(0, 7);

/**
 * Binary search for the first commit (first-parent history) at which the selected tests start failing.
 * Every claim in the result is backed by a test run that was actually executed.
 */
export async function find(o: FindOptions): Promise<FindResult> {
  const goodSha = await resolveCommit(o.repoRoot, o.good);
  const badSha = await resolveCommit(o.repoRoot, o.bad);
  if (goodSha === badSha) {
    throw new Error('good and bad resolve to the same commit; there is nothing to search');
  }
  if (!(await isAncestor(o.repoRoot, goodSha, badSha))) {
    throw new Error(`"${o.good}" is not an ancestor of "${o.bad}"; --good must be an older commit on the same history`);
  }
  const list = await listFirstParent(o.repoRoot, goodSha, badSha);

  const ctx = await createRunContext(o);
  const runs = new Map<string, TestRunResult>();
  const steps: FindStep[] = [];
  const progress = o.onProgress ?? (() => {});

  const test = async (sha: string): Promise<TestRunResult> => {
    const cached = runs.get(sha);
    if (cached) return cached;
    progress(`testing ${short(sha)} ...`);
    const r = await ctx.runAt(sha);
    runs.set(sha, r);
    steps.push({ sha, status: r.status });
    progress(`  ${short(sha)}: ${r.status.toUpperCase()}`);
    return r;
  };

  const goodRun = await test(goodSha);
  const badRun = await test(badSha);
  const base = {
    good: { ref: o.good, sha: goodSha, run: goodRun },
    bad: { ref: o.bad, sha: badSha, run: badRun },
    candidateCommits: list.length,
    steps,
    limitations: ctx.limitations,
  };

  if (goodRun.status === 'pass' && badRun.status === 'pass') {
    return {
      ...base,
      verdict: 'no-regression',
      explanation: 'The selected tests passed on both the good and the bad commit. No regression was observed with this selection.',
    };
  }
  if (goodRun.status !== 'pass' || badRun.status !== 'fail') {
    return {
      ...base,
      verdict: 'inconclusive',
      explanation:
        `Inconclusive: the good commit was ${goodRun.status} and the bad commit was ${badRun.status}. ` +
        'The search needs a real pass on the good commit and a real failure on the bad commit.',
    };
  }

  // Invariant: list[lo] passed (or lo === -1 meaning the good commit), list[hi] failed.
  let lo = -1;
  let hi = list.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const sha = list[mid] as string;
    const r = await test(sha);
    if (r.status === 'pass') lo = mid;
    else if (r.status === 'fail') hi = mid;
    else {
      const from = list[lo + 1] as string;
      const to = list[hi] as string;
      return {
        ...base,
        verdict: 'inconclusive',
        explanation:
          `Inconclusive: commit ${short(sha)} could not be tested (${r.status}${r.note ? `: ${r.note}` : ''}). ` +
          `The first failing commit is somewhere in the ${hi - lo} commits from ${short(from)} to ${short(to)}.`,
        untestedRange: { from, to, count: hi - lo },
      };
    }
  }

  const culpritSha = list[hi] as string;
  const parentSha = lo >= 0 ? (list[lo] as string) : goodSha;
  const info = await commitInfo(o.repoRoot, culpritSha, parentSha);
  const limitations = [
    ...ctx.limitations,
    'The search assumes the failure appeared once and stayed. A flaky test can point to the wrong commit.',
  ];
  if (info.isMerge) {
    limitations.push('The first failing commit is a merge commit: the cause is somewhere inside the merged branch.');
  }
  return {
    ...base,
    limitations,
    verdict: 'culprit-found',
    explanation:
      `Commit ${short(culpritSha)} is the first commit on the first-parent history where the selected tests fail: ` +
      `its predecessor ${short(parentSha)} passed and it failed, both observed by running them. ` +
      'A commit that flips the result is strong evidence, but it does not prove the cause by itself.',
    culprit: {
      ...info,
      parentSha,
      parentRun: runs.get(parentSha) as TestRunResult,
      run: runs.get(culpritSha) as TestRunResult,
    },
  };
}
