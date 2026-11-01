/**
 * `check-docs.mjs` enumerates markdown through `git ls-files`, which lists index entries
 * whether or not the file is still on disk. `pnpm changelog:collate` deletes the fragments
 * from disk but not from the index, so the next `check:docs` read the first fragment and
 * died with a raw ENOENT instead of its problem list (issue #1056). A real temp repo here;
 * the only mock-free way to produce a deleted-but-indexed file.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { trackedMarkdown } from '../../../scripts/check-docs.mjs';

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

describe('check-docs trackedMarkdown', () => {
  let repo: string;

  beforeEach(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'check-docs-'));
    git(repo, 'init', '-q');
    mkdirSync(path.join(repo, 'changelog.d'));
    mkdirSync(path.join(repo, 'docs', 'archive'), { recursive: true });
    writeFileSync(path.join(repo, 'README.md'), '# readme\n');
    writeFileSync(path.join(repo, 'changelog.d', '1.fixed.md'), 'entry\n');
    writeFileSync(path.join(repo, 'changelog.d', 'README.md'), 'about fragments\n');
    writeFileSync(path.join(repo, 'docs', 'archive', 'old.md'), 'frozen\n');
    writeFileSync(path.join(repo, 'notes.txt'), 'not markdown\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'seed');
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('lists tracked markdown outside the frozen trees', () => {
    expect(trackedMarkdown(repo).sort()).toEqual(['README.md', 'changelog.d/1.fixed.md', 'changelog.d/README.md']);
  });

  it('leaves out a file deleted from disk but still in the index (collate before git add)', () => {
    rmSync(path.join(repo, 'changelog.d', '1.fixed.md'));

    expect(trackedMarkdown(repo).sort()).toEqual(['README.md', 'changelog.d/README.md']);
    // The index still knows it: this is the state check:docs used to crash in.
    expect(git(repo, 'ls-files', 'changelog.d')).toContain('1.fixed.md');
  });
});
