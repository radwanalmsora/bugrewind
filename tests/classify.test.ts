import { describe, expect, it } from 'vitest';
import type { RunStatus, TestRunResult } from '../src/core/types.ts';
import { classify } from '../src/replay/regression.ts';
import { classifyRun, sanitizedEnv } from '../src/replay/runner.ts';

const base = { exitCode: 0, timedOut: false, output: '', durationMs: 5 };
const passJson = JSON.stringify({ numPassedTests: 2, numFailedTests: 0, numFailedTestSuites: 0, testResults: [] });
const failJson = JSON.stringify({
  numPassedTests: 1,
  numFailedTests: 1,
  testResults: [
    {
      name: 'a.test.ts',
      status: 'failed',
      assertionResults: [{ status: 'failed', fullName: 'adds', failureMessages: ['expected 3 to be 1'] }],
    },
  ],
});

describe('classifyRun', () => {
  it('reports pass only with passed tests and exit code 0', () => {
    expect(classifyRun({ ...base, json: passJson }).status).toBe('pass');
    expect(classifyRun({ ...base, json: passJson, exitCode: 1 }).status).toBe('error');
  });

  it('reports failures with their names', () => {
    const r = classifyRun({ ...base, exitCode: 1, json: failJson });
    expect(r.status).toBe('fail');
    expect(r.failures[0]?.name).toBe('adds');
  });

  it('never reports pass when there is no usable report', () => {
    expect(classifyRun({ ...base, json: null }).status).toBe('error');
    expect(classifyRun({ ...base, json: '{oops' }).status).toBe('error');
    expect(classifyRun({ ...base, json: null, output: 'No test files found' }).status).toBe('no-tests');
    expect(classifyRun({ ...base, json: JSON.stringify({ numPassedTests: 0, numFailedTests: 0 }) }).status).toBe('no-tests');
  });

  it('reports timeouts and suite load failures', () => {
    expect(classifyRun({ ...base, json: passJson, timedOut: true }).status).toBe('timeout');
    const suiteFail = JSON.stringify({ numPassedTests: 0, numFailedTests: 0, numFailedTestSuites: 1, testResults: [] });
    expect(classifyRun({ ...base, json: suiteFail }).status).toBe('error');
  });
});

describe('classify', () => {
  const mk = (status: RunStatus): TestRunResult => ({
    status,
    exitCode: 0,
    durationMs: 1,
    passed: 0,
    failed: 0,
    failures: [],
    outputTail: '',
  });

  it.each([
    ['pass', 'fail', 'regression-reproduced'],
    ['pass', 'pass', 'not-reproduced'],
    ['fail', 'fail', 'already-failing'],
    ['fail', 'pass', 'fixed-in-head'],
    ['error', 'fail', 'inconclusive'],
    ['pass', 'timeout', 'inconclusive'],
    ['no-tests', 'pass', 'inconclusive'],
  ] as const)('%s -> %s = %s', (a, b, verdict) => {
    expect(classify(mk(a), mk(b)).verdict).toBe(verdict);
  });
});

describe('sanitizedEnv', () => {
  it('drops secret-looking variables and sets CI', () => {
    const env = sanitizedEnv({ PATH: '/bin', OPENAI_API_KEY: 'x', GITHUB_TOKEN: 'y', DB_PASSWORD: 'z' });
    expect(env.PATH).toBe('/bin');
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.DB_PASSWORD).toBeUndefined();
    expect(env.CI).toBe('1');
  });
});
