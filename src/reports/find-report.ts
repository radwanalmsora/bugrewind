import type { FindResult } from '../core/types.ts';

const short = (sha: string): string => sha.slice(0, 7);

export function formatFindTerminal(res: FindResult): string {
  const lines: string[] = ['BUGREWIND FIND', ''];
  lines.push(`Good: ${res.good.ref} (${short(res.good.sha)}): ${res.good.run.status.toUpperCase()}`);
  lines.push(`Bad:  ${res.bad.ref} (${short(res.bad.sha)}): ${res.bad.run.status.toUpperCase()}`);
  lines.push(`Commits in range: ${res.candidateCommits}, test runs: ${res.steps.length}`);
  lines.push('', `Verdict: ${res.verdict}`, res.explanation);

  if (res.culprit) {
    const c = res.culprit;
    lines.push('', 'First failing commit:');
    lines.push(`  ${short(c.sha)}  ${c.subject}`);
    lines.push(`  author: ${c.author}  date: ${c.date}`);
    lines.push(`  files changed since ${short(c.parentSha)}:`);
    for (const f of c.files.slice(0, 20)) lines.push(`    - ${f}`);
    if (c.files.length > 20) lines.push(`    ... and ${c.files.length - 20} more`);
    const fails = c.run.failures.slice(0, 5);
    if (fails.length > 0) {
      lines.push('  failures:');
      for (const f of fails) {
        const first = f.message.split('\n')[0] ?? '';
        lines.push(`    - ${f.name}${first ? `: ${first}` : ''}`);
      }
    }
  }

  lines.push('', 'Limitations:');
  for (const l of res.limitations) lines.push(`  - ${l}`);
  return lines.join('\n');
}

export function formatFindJson(res: FindResult): string {
  return JSON.stringify(res, null, 2);
}
