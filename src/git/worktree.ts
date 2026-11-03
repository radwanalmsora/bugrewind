import { lstat, mkdtemp, rm, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathExists } from '../utils/fs.ts';
import { git } from './exec.ts';

export interface WorktreeOptions {
  repoRoot: string;
  sha: string;
  /** Absolute path of a node_modules directory to link into the worktree. */
  nodeModulesPath?: string;
}

async function removeIfSymlink(p: string): Promise<void> {
  try {
    const st = await lstat(p);
    if (st.isSymbolicLink()) await unlink(p);
  } catch {
    // nothing to remove
  }
}

/**
 * Checks out `sha` into a temporary detached worktree, runs `fn`, then removes it.
 * The user's working tree and index are never touched.
 */
export async function withWorktree<T>(
  opts: WorktreeOptions,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const parent = await mkdtemp(join(tmpdir(), 'bugrewind-wt-'));
  const dir = join(parent, 'tree');
  let added = false;
  try {
    await git(opts.repoRoot, ['worktree', 'add', '--detach', dir, opts.sha]);
    added = true;
    if (opts.nodeModulesPath && (await pathExists(opts.nodeModulesPath))) {
      const link = join(dir, 'node_modules');
      if (!(await pathExists(link))) {
        await symlink(opts.nodeModulesPath, link, 'dir');
      }
    }
    return await fn(dir);
  } finally {
    // Remove only the symlink, never the directory it points to.
    await removeIfSymlink(join(dir, 'node_modules'));
    if (added) {
      try {
        await git(opts.repoRoot, ['worktree', 'remove', '--force', dir]);
      } catch {
        // fall through to manual cleanup below
      }
    }
    await rm(parent, { recursive: true, force: true });
    try {
      await git(opts.repoRoot, ['worktree', 'prune']);
    } catch {
      // best effort
    }
  }
}
