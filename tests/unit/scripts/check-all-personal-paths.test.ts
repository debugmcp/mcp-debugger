import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const audit = fileURLToPath(new URL('../../../scripts/check-all-personal-paths.cjs', import.meta.url));

it('audits tracked files and untracked candidates while skipping a locally installed payload', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'personal-path-audit-'));
  // A test run from a Git hook may inherit the real repository's index.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const options = { cwd, env, windowsHide: true, encoding: 'utf8' as const };
  try {
    execFileSync('git', ['init', '-q'], options);
    const pkg = path.join(cwd, 'packages', 'adapter');
    const payload = path.join(pkg, 'lldb');
    mkdirSync(payload, { recursive: true });
    const personalPath = ['', 'home', 'example-developer', 'file'].join('/');
    writeFileSync(path.join(pkg, '.gitignore'), 'lldb/\n');
    writeFileSync(path.join(payload, 'installed.py'), personalPath);
    const clean = spawnSync(process.execPath, [audit], options);
    expect(clean.status, clean.stderr).toBe(0);

    // Even a path matching an ignore rule is in scope once Git tracks it.
    writeFileSync(path.join(payload, 'tracked.py'), personalPath);
    execFileSync('git', ['add', '-f', '--', 'packages/adapter/lldb/tracked.py'], options);
    writeFileSync(path.join(cwd, 'new source.ts'), personalPath);
    const dirty = spawnSync(process.execPath, [audit], options);
    expect(dirty.status, dirty.stderr).toBe(1);
    expect(dirty.stderr).toContain('tracked.py');
    expect(dirty.stderr).toContain('new source.ts');
    expect(dirty.stderr).not.toContain('installed.py');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
