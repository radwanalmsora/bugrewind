import type { ReplayOptions, ReplayResult } from '../core/types.ts';
import { resolveCommit } from '../git/repository.ts';
import { classify } from './regression.ts';
import { createRunContext } from './context.ts';

export async function replay(o: ReplayOptions): Promise<ReplayResult> {
  const baseSha = await resolveCommit(o.repoRoot, o.base);
  const headSha = await resolveCommit(o.repoRoot, o.head);
  if (baseSha === headSha) {
    throw new Error('base and head resolve to the same commit; there is nothing to compare');
  }

  const ctx = await createRunContext(o);
  const baseRun = await ctx.runAt(baseSha);
  const headRun = await ctx.runAt(headSha);
  const { verdict, explanation } = classify(baseRun, headRun);

  return {
    base: { ref: o.base, sha: baseSha, run: baseRun },
    head: { ref: o.head, sha: headSha, run: headRun },
    verdict,
    explanation,
    limitations: ctx.limitations,
  };
}
