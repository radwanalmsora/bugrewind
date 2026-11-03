import type { CommitInfo } from '../core/types.ts';
import { git } from './exec.ts';

export async function findRepoRoot(cwd: string): Promise<string> {
  const out = await git(cwd, ['rev-parse', '--show-toplevel']);
  return out.trim();
}

export async function resolveCommit(repoRoot: string, ref: string): Promise<string> {
  if (ref.startsWith('-')) {
    throw new Error(`invalid git ref: ${ref}`);
  }
  try {
    const out = await git(repoRoot, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    const sha = out.trim();
    if (!sha) throw new Error('empty result');
    return sha;
  } catch {
    throw new Error(`cannot resolve "${ref}" to a commit in this repository`);
  }
}

export async function hasUncommittedChanges(repoRoot: string): Promise<boolean> {
  const out = await git(repoRoot, ['status', '--porcelain']);
  return out.trim().length > 0;
}

export async function isAncestor(repoRoot: string, ancestor: string, descendant: string): Promise<boolean> {
  try {
    await git(repoRoot, ['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

/** Commits after `good` up to and including `bad`, oldest first, following first parents only. */
export async function listFirstParent(repoRoot: string, good: string, bad: string): Promise<string[]> {
  const out = await git(repoRoot, ['rev-list', '--first-parent', '--reverse', `${good}..${bad}`]);
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function commitInfo(repoRoot: string, sha: string, prevSha: string): Promise<CommitInfo> {
  const meta = await git(repoRoot, ['show', '-s', '--format=%an%x1f%aI%x1f%s', sha]);
  const [author = '', date = '', ...rest] = meta.trim().split('\x1f');
  const parents = (await git(repoRoot, ['rev-list', '--parents', '-n', '1', sha])).trim().split(/\s+/);
  const diff = await git(repoRoot, ['diff', '--name-only', prevSha, sha]);
  const files = diff
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return { sha, author, date, subject: rest.join('\x1f'), files, isMerge: parents.length > 2 };
}
