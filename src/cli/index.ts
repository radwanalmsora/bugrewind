#!/usr/bin/env node
import { Command } from 'commander';
import { findRepoRoot } from '../git/repository.ts';
import { replay } from '../replay/replay.ts';
import { formatJson, formatTerminal } from '../reports/replay-report.ts';

interface ReplayCliOptions {
  base: string;
  head: string;
  file?: string;
  test?: string;
  timeout: string;
  nodeModules?: string;
  json?: boolean;
  yes?: boolean;
}

const program = new Command();

program
  .name('bugrewind')
  .description('Every bug has a history. Rewind it.')
  .version('0.1.0');

program
  .command('replay')
  .description('Run the same vitest selection on a baseline and a head commit (isolated git worktrees) and compare the results')
  .option('--base <ref>', 'baseline commit or ref', 'HEAD~1')
  .option('--head <ref>', 'head commit or ref', 'HEAD')
  .option('--file <path>', 'test file to run')
  .option('--test <pattern>', 'test name pattern (vitest -t)')
  .option('--timeout <seconds>', 'timeout per run, in seconds', '120')
  .option('--node-modules <path>', 'node_modules directory to link into the worktrees')
  .option('--json', 'print the result as JSON')
  .option('--yes', 'confirm that test code from both commits may be executed on this machine')
  .action(async (opts: ReplayCliOptions) => {
    const timeoutSeconds = Number(opts.timeout);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      console.error('error: --timeout must be a positive number of seconds');
      process.exitCode = 2;
      return;
    }
    if (!opts.yes) {
      console.error(
        `bugrewind replay will execute the project's test code from "${opts.base}" and "${opts.head}" on this machine.\n` +
          'Test code can run arbitrary commands. Re-run with --yes to confirm.',
      );
      process.exitCode = 2;
      return;
    }
    if (!opts.file && !opts.test) {
      console.error('note: no --file or --test given; the whole vitest suite will run on both commits.');
    }

    try {
      const repoRoot = await findRepoRoot(process.cwd());
      const result = await replay({
        repoRoot,
        base: opts.base,
        head: opts.head,
        file: opts.file,
        testName: opts.test,
        timeoutMs: timeoutSeconds * 1000,
        nodeModulesPath: opts.nodeModules,
      });
      console.log(opts.json ? formatJson(result) : formatTerminal(result));
      if (result.verdict === 'regression-reproduced') process.exitCode = 1;
      else if (result.verdict === 'inconclusive' || result.verdict === 'already-failing') process.exitCode = 3;
    } catch (err) {
      console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
      process.exitCode = 2;
    }
  });

await program.parseAsync(process.argv);
