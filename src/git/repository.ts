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
