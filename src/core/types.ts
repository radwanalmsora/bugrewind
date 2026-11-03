export type RunStatus = 'pass' | 'fail' | 'no-tests' | 'error' | 'timeout';

export interface TestFailure {
  name: string;
  message: string;
}

export interface TestRunResult {
  status: RunStatus;
  exitCode: number | null;
  durationMs: number;
  passed: number;
  failed: number;
  failures: TestFailure[];
  outputTail: string;
  note?: string;
}

export type Verdict =
  | 'regression-reproduced'
  | 'not-reproduced'
  | 'already-failing'
  | 'fixed-in-head'
  | 'inconclusive';

export interface ReplayOptions {
  repoRoot: string;
  base: string;
  head: string;
  file?: string;
  testName?: string;
  timeoutMs: number;
  nodeModulesPath?: string;
}

export interface ReplaySide {
  ref: string;
  sha: string;
  run: TestRunResult;
}

export interface ReplayResult {
  base: ReplaySide;
  head: ReplaySide;
  verdict: Verdict;
  explanation: string;
  limitations: string[];
}

export type FindVerdict = 'culprit-found' | 'no-regression' | 'inconclusive';

export interface CommitInfo {
  sha: string;
  subject: string;
  author: string;
  date: string;
  /** Files that differ between the previous tested commit and this one. */
  files: string[];
  isMerge: boolean;
}

export interface FindStep {
  sha: string;
  status: RunStatus;
}

export interface FindCulprit extends CommitInfo {
  parentSha: string;
  parentRun: TestRunResult;
  run: TestRunResult;
}

export interface FindResult {
  good: ReplaySide;
  bad: ReplaySide;
  candidateCommits: number;
  steps: FindStep[];
  verdict: FindVerdict;
  explanation: string;
  culprit?: FindCulprit;
  untestedRange?: { from: string; to: string; count: number };
  limitations: string[];
}
