#!/usr/bin/env node
import { Command } from 'commander';
import { findRepoRoot } from '../git/repository.ts';
import { find } from '../replay/bisect.ts';
import { replay } from '../replay/replay.ts';
import { formatFindJson, formatFindTerminal } from '../reports/find-report.ts';
import { formatJson, formatTerminal } from '../reports/replay-report.ts';

interface CommonOptions {
  file?: string;
  test?: string;
  timeout: string;
  nodeModules?: string;
  json?: boolean;
  yes?: boolean;
}

interface ReplayCliOptions extends CommonOptions {
  base: string;
  head: string;
}

interface FindCliOptions extends CommonOptions {
  good: string;
  bad: string;
}

/** Shared validation. Returns the timeout in milliseconds, or null after printing an error. */
function checkCommon(opts: CommonOptions, action: string, refs: string[]): number | null {
  const timeoutSeconds = Number(opts.timeout);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    console.error('error: --timeout must be a positive number of seconds');
    process.exitCode = 2;
    return null;
  }
  if (!opts.yes) {
    console.error(
      `bugrewind ${action} will execute the project's test code from ${refs.map((r) => `"${r}"`).join(' and ')} on this machine.\n` +
        'Test code can run arbitrary commands. Re-run with --yes to confirm.',
    );
    process.exitCode = 2;
    return null;
  }
  if (!opts.file && !opts.test) {
    console.error('note: no --file or --test given; the whole vitest suite will run on every tested commit.');
  }
  return timeoutSeconds * 1000;
}

function fail(err: unknown): void {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 2;
}

function addCommon(cmd: Command): Command {
  return cmd
    .option('--file <path>', 'test file to run')
    .option('--test <pattern>', 'test name pattern (vitest -t)')
    .option('--timeout <seconds>', 'timeout per run, in seconds', '120')
    .option('--node-modules <path>', 'node_modules directory to link into the worktrees')
    .option('--json', 'print the result as JSON')
    .option('--yes', 'confirm that test code from the tested commits may be executed on this machine');
}

const program = new Command();

program.name('bugrewind').description('Every bug has a history. Rewind it.').version('0.2.0');

addCommon(
  program
    .command('replay')
    .description('Run the same vitest selection on a baseline and a head commit (isolated git worktrees) and compare the results')
    .option('--base <ref>', 'baseline commit or ref', 'HEAD~1')
    .option('--head <ref>', 'head commit or ref', 'HEAD'),
).action(async (opts: ReplayCliOptions) => {
  const timeoutMs = checkCommon(opts, 'replay', [opts.base, opts.head]);
  if (timeoutMs === null) return;
  try {
    const repoRoot = await findRepoRoot(process.cwd());
    const result = await replay({
      repoRoot,
      base: opts.base,
      head: opts.head,
      file: opts.file,
      testName: opts.test,
      timeoutMs,
      nodeModulesPath: opts.nodeModules,
    });
    console.log(opts.json ? formatJson(result) : formatTerminal(result));
    if (result.verdict === 'regression-reproduced') process.exitCode = 1;
    else if (result.verdict === 'inconclusive' || result.verdict === 'already-failing') process.exitCode = 3;
  } catch (err) {
    fail(err);
  }
});

addCommon(
  program
    .command('find')
    .description('Binary-search the history between a good and a bad commit for the first commit where the tests fail')
    .requiredOption('--good <ref>', 'an older commit where the tests pass')
    .option('--bad <ref>', 'a newer commit where the tests fail', 'HEAD'),
).action(async (opts: FindCliOptions) => {
  const timeoutMs = checkCommon(opts, 'find', [opts.good, opts.bad, 'the commits in between']);
  if (timeoutMs === null) return;
  try {
    const repoRoot = await findRepoRoot(process.cwd());
    const result = await find({
      repoRoot,
      good: opts.good,
      bad: opts.bad,
      file: opts.file,
      testName: opts.test,
      timeoutMs,
      nodeModulesPath: opts.nodeModules,
      onProgress: (m) => console.error(m),
    });
    console.log(opts.json ? formatFindJson(result) : formatFindTerminal(result));
    if (result.verdict === 'culprit-found') process.exitCode = 1;
    else if (result.verdict === 'inconclusive') process.exitCode = 3;
  } catch (err) {
    fail(err);
  }
});

await program.parseAsync(process.argv);
