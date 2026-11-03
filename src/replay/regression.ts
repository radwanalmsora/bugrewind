import type { TestRunResult, Verdict } from '../core/types.ts';

function describe(r: TestRunResult): string {
  return r.note ? `${r.status} (${r.note})` : r.status;
}

/** Compares a baseline run with a head run. Never claims more than the two runs show. */
export function classify(
  base: TestRunResult,
  head: TestRunResult,
): { verdict: Verdict; explanation: string } {
  if (base.status === 'pass' && head.status === 'fail') {
    return {
      verdict: 'regression-reproduced',
      explanation:
        'The selected tests passed on the baseline commit and failed on the head commit. ' +
        'This shows a behavior difference between the two commits; it does not by itself identify which change caused it.',
    };
  }
  if (base.status === 'pass' && head.status === 'pass') {
    return {
      verdict: 'not-reproduced',
      explanation: 'The selected tests passed on both commits. No regression was observed with this selection.',
    };
  }
  if (base.status === 'fail' && head.status === 'fail') {
    return {
      verdict: 'already-failing',
      explanation: 'The selected tests failed on both commits, so this is not a regression between them. Try an older baseline.',
    };
  }
  if (base.status === 'fail' && head.status === 'pass') {
    return {
      verdict: 'fixed-in-head',
      explanation: 'The selected tests failed on the baseline commit and pass on the head commit.',
    };
  }
  return {
    verdict: 'inconclusive',
    explanation:
      `Inconclusive: baseline was ${describe(base)}; head was ${describe(head)}. ` +
      'A comparison needs a real pass or fail on both sides.',
  };
}
