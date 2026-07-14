import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('which', () => ({ default: vi.fn() }));

import which from 'which';
import {
  getRubySearchPaths,
  getRdbgSearchPaths,
  findRubyExecutable,
  findRdbgExecutable,
  getRubyVersion,
  getRdbgVersion,
  buildRdbgInvocation
} from '../../src/utils/ruby-utils.js';

const whichMock = vi.mocked(which) as unknown as ReturnType<typeof vi.fn>;

describe('search paths', () => {
  it('includes RubyInstaller bin dirs for both ruby and rdbg on Windows', () => {
    // Regression: rdbg search paths originally omitted the RubyInstaller dirs,
    // so a standard install found ruby but not rdbg.
    expect(getRubySearchPaths('win32')).toContain('C:\\Ruby34-x64\\bin');
    expect(getRdbgSearchPaths('win32')).toContain('C:\\Ruby34-x64\\bin');
  });

  it('includes Homebrew paths on macOS', () => {
    expect(getRubySearchPaths('darwin')).toContain('/opt/homebrew/bin');
  });

  it('includes system and gem paths on Linux', () => {
    expect(getRubySearchPaths('linux')).toContain('/usr/bin');
    expect(getRdbgSearchPaths('linux')).toContain('/usr/local/bin');
  });

  it('appends PATH entries and de-duplicates', () => {
    const paths = getRubySearchPaths('linux');
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('findRubyExecutable / findRdbgExecutable', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruby-utils-test-'));
    whichMock.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('prefers the explicitly provided path when resolvable via which', async () => {
    whichMock.mockResolvedValueOnce('/resolved/ruby');
    await expect(findRubyExecutable('/custom/ruby')).resolves.toBe('/resolved/ruby');
  });

  it('accepts an explicit file path that exists but is not on PATH', async () => {
    whichMock.mockRejectedValue(new Error('not found'));
    const rubyFile = path.join(tmpDir, 'ruby');
    fs.writeFileSync(rubyFile, '', { mode: 0o755 });
    await expect(findRubyExecutable(rubyFile)).resolves.toBe(rubyFile);
  });

  it('honors the RDBG_PATH environment variable', async () => {
    whichMock.mockRejectedValue(new Error('not found'));
    const rdbgFile = path.join(tmpDir, 'rdbg');
    fs.writeFileSync(rdbgFile, '', { mode: 0o755 });
    vi.stubEnv('RDBG_PATH', rdbgFile);
    await expect(findRdbgExecutable()).resolves.toBe(rdbgFile);
  });

  it('falls back to PATH candidates via which', async () => {
    whichMock.mockResolvedValueOnce('/usr/bin/rdbg');
    await expect(findRdbgExecutable()).resolves.toBe('/usr/bin/rdbg');
  });

  it('throws with the list of tried locations when nothing is found', async () => {
    whichMock.mockRejectedValue(new Error('not found'));
    // Make fileExists deterministic regardless of what's installed locally
    const accessSpy = vi.spyOn(fs.promises, 'access').mockRejectedValue(new Error('ENOENT'));
    try {
      await expect(findRdbgExecutable()).rejects.toThrow(/rdbg not found\. Tried:/);
    } finally {
      accessSpy.mockRestore();
    }
  });
});

describe('version probes', () => {
  it('returns trimmed output when the version pattern does not match', async () => {
    // node --version exits 0 and prints something un-ruby-like
    const version = await getRubyVersion(process.execPath);
    expect(version).toBeTruthy();
  });

  it('returns null when the executable cannot be spawned', async () => {
    await expect(getRubyVersion('/definitely/not/a/real/ruby')).resolves.toBeNull();
    await expect(getRdbgVersion('/definitely/not/a/real/rdbg')).resolves.toBeNull();
  });

  it('uses the .bat-safe invocation for rdbg version probes', async () => {
    // On non-Windows this is a passthrough; the call must still work.
    const version = await getRdbgVersion(process.execPath);
    expect(version).toBeTruthy();
  });
});

describe('buildRdbgInvocation platform behavior', () => {
  it('returns the command unchanged for non-shim paths on Windows', () => {
    expect(buildRdbgInvocation('C:\\tools\\rdbg.exe', ['--version'], undefined, 'win32')).toEqual({
      command: 'C:\\tools\\rdbg.exe',
      args: ['--version']
    });
  });
});
