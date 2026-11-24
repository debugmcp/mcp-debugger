import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const audit = fileURLToPath(new URL('../../../scripts/check-all-personal-paths.cjs', import.meta.url));
const stagedAudit = fileURLToPath(new URL('../../../scripts/check-personal-paths.cjs', import.meta.url));

function cleanGitEnv(): NodeJS.ProcessEnv {
  // A test run from a Git hook may inherit the real repository's index.
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
}

it('audits tracked files and untracked candidates while skipping a locally installed payload', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'personal-path-audit-'));
  const env = cleanGitEnv();
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

it('scans .env variants, uppercase extensions, non-ASCII staged paths, and nested working directories', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'personal-path-audit-edges-'));
  const env = cleanGitEnv();
  const options = { cwd, env, windowsHide: true, encoding: 'utf8' as const };
  try {
    execFileSync('git', ['init', '-q'], options);
    const nestedDir = path.join(cwd, 'packages', 'subpkg');
    const vendorDir = path.join(cwd, 'vendor');
    mkdirSync(nestedDir, { recursive: true });
    mkdirSync(vendorDir, { recursive: true });

    const personalPath = ['', 'home', 'example-developer', 'secret'].join('/');
    writeFileSync(path.join(cwd, '.env'), `DATA_DIR=${personalPath}\n`);
    writeFileSync(path.join(cwd, '.env.local'), `CACHE_DIR=${personalPath}\n`);
    writeFileSync(path.join(cwd, 'NOTES.MD'), personalPath);
    writeFileSync(path.join(cwd, 'café notes.ts'), `const p = "${personalPath}";\n`);
    writeFileSync(path.join(vendorDir, 'vendored.js'), `const p = "${personalPath}";\n`);

    // Running full audit from a nested directory still audits the entire repository.
    const nestedOptions = { ...options, cwd: nestedDir, windowsHide: true };
    const fullFromNested = spawnSync(process.execPath, [audit], nestedOptions);
    expect(fullFromNested.status, fullFromNested.stderr).toBe(1);
    expect(fullFromNested.stderr).toContain('.env');
    expect(fullFromNested.stderr).toContain('.env.local');
    expect(fullFromNested.stderr).toContain('NOTES.MD');
    expect(fullFromNested.stderr).toContain('café notes.ts');

    // Stage a non-ASCII filename, .env, and an excluded vendor/ file; run staged audit from nested cwd.
    execFileSync('git', ['add', '--', '.env', 'café notes.ts', 'vendor/vendored.js'], options);
    const stagedFromNested = spawnSync(process.execPath, [stagedAudit], nestedOptions);
    expect(stagedFromNested.status, stagedFromNested.stderr).toBe(1);
    expect(stagedFromNested.stderr).toContain('.env');
    expect(stagedFromNested.stderr).toContain('café notes.ts');
    // Excluded directories (forward-slash Git output on Windows and POSIX) stay excluded in staged scan.
    expect(stagedFromNested.stderr).not.toContain('vendored.js');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
