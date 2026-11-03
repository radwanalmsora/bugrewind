import type { ReplayResult, ReplaySide } from '../core/types.ts';

function side(label: string, s: ReplaySide): string {
  const r = s.run;
  const seconds = (r.durationMs / 1000).toFixed(1);
  const counts = `${r.passed} passed, ${r.failed} failed`;
  const note = r.note ? ` - ${r.note}` : '';
  return `${label} ${s.ref} (${s.sha.slice(0, 7)}): ${r.status.toUpperCase()} (${counts}, ${seconds}s)${note}`;
}

export function formatTerminal(res: ReplayResult): string {
  const lines: string[] = ['BUGREWIND REPLAY', ''];
  lines.push(side('Baseline:', res.base));
  lines.push(side('Head:    ', res.head));
  lines.push('', `Verdict: ${res.verdict}`, res.explanation);

  const failing = res.head.run.failures.slice(0, 5);
  if (failing.length > 0) {
    lines.push('', 'Failures on head:');
    for (const f of failing) {
      const firstLine = f.message.split('\n')[0] ?? '';
      lines.push(`  - ${f.name}${firstLine ? `: ${firstLine}` : ''}`);
    }
  }

  lines.push('', 'Limitations:');
  for (const l of res.limitations) lines.push(`  - ${l}`);
  return lines.join('\n');
}

export function formatJson(res: ReplayResult): string {
  return JSON.stringify(res, null, 2);
}
