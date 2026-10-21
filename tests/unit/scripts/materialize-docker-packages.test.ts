/**
 * The Docker image re-materialises each workspace package from its own
 * package.json `files` field (issue #811) instead of a hand-listed cp set,
 * which is how the JavaScript adapter's exit-code shim went missing (#796).
 */
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { materializePackage, materializePackages } from '../../../scripts/materialize-docker-packages.mjs';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'materialize-'));
  tempDirs.push(dir);
  return dir;
}

function writeFile(file: string, content = ''): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function fakePackage(root: string, dir: string, pkg: Record<string, unknown>, files: string[]): void {
  writeFile(path.join(root, 'packages', dir, 'package.json'), JSON.stringify(pkg));
  for (const file of files) {
    writeFile(path.join(root, 'packages', dir, file), file);
  }
}

/** Whether this platform lets an unprivileged process create a relative symlink. */
function canSymlink(): boolean {
  const dir = tempDir();
  try {
    fs.mkdirSync(path.join(dir, 'target'));
    fs.symlinkSync('target', path.join(dir, 'link'), 'dir');
    return true;
  } catch {
    return false;
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('materializePackage', () => {
  it('copies package.json and every files entry, nested paths included, and nothing else', () => {
    const root = tempDir();
    const dest = tempDir();
    fakePackage(
      root,
      'adapter-javascript',
      { name: '@debugmcp/adapter-javascript', files: ['dist', 'vendor/js-debug', 'vendor-manifest.json', 'assets'] },
      [
        'dist/index.js',
        'vendor/js-debug/vsDebugServer.cjs',
        'vendor/other/unrelated.txt',
        'vendor-manifest.json',
        'assets/exitcode-shim.cjs',
        'src/index.ts',
        'tsconfig.json'
      ]
    );

    materializePackage(root, dest, 'adapter-javascript');

    const out = path.join(dest, '@debugmcp', 'adapter-javascript');
    for (const file of ['package.json', 'dist/index.js', 'vendor/js-debug/vsDebugServer.cjs', 'vendor-manifest.json', 'assets/exitcode-shim.cjs']) {
      expect(fs.existsSync(path.join(out, file)), file).toBe(true);
    }
    for (const file of ['vendor/other/unrelated.txt', 'src/index.ts', 'tsconfig.json']) {
      expect(fs.existsSync(path.join(out, file)), file).toBe(false);
    }
  });

  it('skips a README or LICENSE the package names but does not have', () => {
    const root = tempDir();
    const dest = tempDir();
    fakePackage(root, 'shared', { name: '@debugmcp/shared', files: ['dist', 'README.md', 'LICENSE'] }, ['dist/index.js']);

    expect(() => materializePackage(root, dest, 'shared')).not.toThrow();
    expect(fs.existsSync(path.join(dest, '@debugmcp', 'shared', 'dist', 'index.js'))).toBe(true);
  });

  it('fails the build when a runtime files entry is missing', () => {
    const root = tempDir();
    const dest = tempDir();
    fakePackage(root, 'adapter-java', { name: '@debugmcp/adapter-java', files: ['dist', 'java'] }, ['dist/index.js']);

    expect(() => materializePackage(root, dest, 'adapter-java')).toThrow(/@debugmcp\/adapter-java.*"java"/);
  });

  it('refuses a glob entry rather than copying it literally', () => {
    const root = tempDir();
    const dest = tempDir();
    fakePackage(root, 'adapter-mock', { name: '@debugmcp/adapter-mock', files: ['dist/*.js'] }, ['dist/index.js']);

    expect(() => materializePackage(root, dest, 'adapter-mock')).toThrow(/glob/);
  });

  // The CodeLLDB vendor tree carries a relative `current` link; a copy that
  // resolves it into an absolute /app/packages/... path breaks the runtime
  // stage (canary docker-build-guard checks the link).
  it.runIf(canSymlink())('keeps a relative symlink relative', () => {
    const root = tempDir();
    const dest = tempDir();
    fakePackage(root, 'codelldb-common', { name: '@debugmcp/codelldb-common', files: ['dist', 'vendor'] }, [
      'dist/index.js',
      'vendor/codelldb/linux-x64/adapter/codelldb'
    ]);
    fs.symlinkSync('linux-x64', path.join(root, 'packages', 'codelldb-common', 'vendor', 'codelldb', 'current'), 'dir');

    materializePackage(root, dest, 'codelldb-common');

    const link = path.join(dest, '@debugmcp', 'codelldb-common', 'vendor', 'codelldb', 'current');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(link)).toBe('linux-x64');
    expect(fs.existsSync(path.join(link, 'adapter', 'codelldb'))).toBe(true);
  });
});

describe('materializePackages', () => {
  it('materialises each named package and reports what it copied', () => {
    const root = tempDir();
    const dest = tempDir();
    fakePackage(root, 'adapter-mock', { name: '@debugmcp/adapter-mock', files: ['dist'] }, ['dist/index.js']);
    fakePackage(root, 'adapter-ruby', { name: '@debugmcp/adapter-ruby', files: ['dist'] }, ['dist/index.js']);

    const report = materializePackages(root, dest, ['adapter-mock', 'adapter-ruby']);

    expect(report).toEqual([
      { name: '@debugmcp/adapter-mock', entries: ['package.json', 'dist'] },
      { name: '@debugmcp/adapter-ruby', entries: ['package.json', 'dist'] }
    ]);
  });
});
