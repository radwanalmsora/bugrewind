import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestFailure, TestRunResult } from '../core/types.ts';
import { pathExists } from '../utils/fs.ts';

const OUTPUT_TAIL_CHARS = 8000;
const SECRET_ENV = /(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;

/** Environment for the child process: secrets are not passed on to repository test code. */
export function sanitizedEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (!SECRET_ENV.test(key)) out[key] = value;
  }
  out.CI = '1';
  return out;
}

interface VitestAssertion {
  status?: string;
  fullName?: string;
  title?: string;
  failureMessages?: string[];
}

interface VitestFileResult {
  name?: string;
  status?: string;
  message?: string;
  assertionResults?: VitestAssertion[];
}

interface VitestJson {
  numPassedTests?: number;
  numFailedTests?: number;
  numFailedTestSuites?: number;
  testResults?: VitestFileResult[];
}

export interface ClassifyInput {
  json: string | null;
  exitCode: number | null;
  timedOut: boolean;
  output: string;
  durationMs: number;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Pure function: turns what vitest produced into an honest result. */
export function classifyRun(i: ClassifyInput): TestRunResult {
  const common = {
    exitCode: i.exitCode,
    durationMs: i.durationMs,
    outputTail: i.output.slice(-OUTPUT_TAIL_CHARS),
  };
  const empty = { passed: 0, failed: 0, failures: [] as TestFailure[] };

  if (i.timedOut) {
    return { ...common, ...empty, status: 'timeout', note: 'the run was killed after exceeding the timeout' };
  }

  if (i.json === null) {
    if (/no test files found|no tests found/i.test(i.output)) {
      return { ...common, ...empty, status: 'no-tests', note: 'vitest found no test files matching the selection' };
    }
    return { ...common, ...empty, status: 'error', note: 'vitest produced no JSON report; see the output' };
  }

  let report: VitestJson;
  try {
    report = JSON.parse(i.json) as VitestJson;
  } catch {
    return { ...common, ...empty, status: 'error', note: 'could not parse the vitest JSON report' };
  }

  const failures: TestFailure[] = [];
  let failedAssertions = 0;
  for (const file of report.testResults ?? []) {
    const asserts = file.assertionResults ?? [];
    const failedHere = asserts.filter((a) => a.status === 'failed');
    failedAssertions += failedHere.length;
    for (const a of failedHere) {
      failures.push({
        name: a.fullName ?? a.title ?? '(unnamed test)',
        message: (a.failureMessages ?? []).join('\n').slice(0, 600),
      });
    }
    if (failedHere.length === 0 && file.status === 'failed') {
      failures.push({
        name: file.name ?? '(test file)',
        message: (file.message ?? '').slice(0, 600),
      });
    }
  }

  const passed = num(report.numPassedTests);
  const failed = Math.max(num(report.numFailedTests), failedAssertions);
  const failedSuites = num(report.numFailedTestSuites);
  const counts = { passed, failed, failures };

  if (failed > 0) return { ...common, ...counts, status: 'fail' };
  if (failedSuites > 0) {
    return { ...common, ...counts, status: 'error', note: 'a test file failed to load or compile, so no test result exists for it' };
  }
  if (passed > 0) {
    if (i.exitCode !== 0) {
      return { ...common, ...counts, status: 'error', note: `tests passed but vitest exited with code ${String(i.exitCode)}` };
    }
    return { ...common, ...counts, status: 'pass' };
  }
  return { ...common, ...counts, status: 'no-tests', note: 'no test was executed (all skipped or none matched)' };
}

export interface RunVitestOptions {
  cwd: string;
  file?: string;
  testName?: string;
  timeoutMs: number;
}

function killTree(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}

export async function runVitest(o: RunVitestOptions): Promise<TestRunResult> {
  const started = Date.now();
  const bin = join(o.cwd, 'node_modules', '.bin', 'vitest');
  const fail = (note: string): TestRunResult => ({
    status: 'error',
    exitCode: null,
    durationMs: Date.now() - started,
    passed: 0,
    failed: 0,
    failures: [],
    outputTail: '',
    note,
  });

  if (!(await pathExists(bin))) {
    return fail('vitest executable not found at node_modules/.bin/vitest');
  }
  if (o.file?.startsWith('-')) return fail(`invalid test file argument: ${o.file}`);

  const outDir = await mkdtemp(join(tmpdir(), 'bugrewind-out-'));
  const jsonPath = join(outDir, 'result.json');
  const args = ['run'];
  if (o.file) args.push(o.file);
  if (o.testName) args.push('-t', o.testName);
  args.push('--reporter=json', `--outputFile=${jsonPath}`);

  let output = '';
  const push = (chunk: Buffer): void => {
    output = (output + chunk.toString()).slice(-OUTPUT_TAIL_CHARS * 2);
  };

  try {
    const { exitCode, timedOut } = await new Promise<{ exitCode: number | null; timedOut: boolean }>(
      (resolve) => {
        let timedOut = false;
        const child = spawn(bin, args, {
          cwd: o.cwd,
          env: sanitizedEnv(process.env),
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout.on('data', push);
        child.stderr.on('data', push);
        const timer = setTimeout(() => {
          timedOut = true;
          killTree(child.pid);
        }, o.timeoutMs);
        child.on('error', (e: Error) => {
          clearTimeout(timer);
          output += String(e);
          resolve({ exitCode: null, timedOut });
        });
        child.on('close', (code: number | null) => {
          clearTimeout(timer);
          resolve({ exitCode: code, timedOut });
        });
      },
    );

    let json: string | null = null;
    if (await pathExists(jsonPath)) json = await readFile(jsonPath, 'utf8');
    return classifyRun({ json, exitCode, timedOut, output, durationMs: Date.now() - started });
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}
