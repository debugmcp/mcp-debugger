/**
 * Unit tests for the CodeLLDB executable resolver.
 *
 * fs/promises is fully mocked — these tests must stay hermetic and never
 * depend on whether the local vendor/ directory has been populated.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as path from 'path';
import { readFileSync } from 'node:fs';

const accessMock: Mock = vi.fn();
const readFileMock: Mock = vi.fn();

vi.mock('fs/promises', () => ({
  access: (...args: unknown[]) => accessMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args)
}));

import {
  resolveCodeLLDBExecutable,
  getCodeLLDBVersion,
  DEFAULT_CODELLDB_VERSION
} from '../src/utils/codelldb-resolver.js';

const realProcess = process;

// The resolver reads process.platform/arch/cwd at call time, so a global stub
// is enough — no need to re-import the module per platform.
function stubPlatform(platform: string, arch = 'x64'): void {
  vi.stubGlobal('process', {
    ...realProcess,
    platform,
    arch,
    cwd: realProcess.cwd.bind(realProcess),
    env: realProcess.env
  });
}

describe('codelldb-resolver', () => {
  beforeEach(() => {
    accessMock.mockReset();
    readFileMock.mockReset();
    // Hermetic: never let the host machine's CODELLDB_PATH leak into tests
    vi.stubEnv('CODELLDB_PATH', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('resolveCodeLLDBExecutable', () => {
    describe.each([
      { platform: 'win32', arch: 'x64', dir: 'win32-x64', exe: 'codelldb.exe' },
      { platform: 'darwin', arch: 'x64', dir: 'darwin-x64', exe: 'codelldb' },
      { platform: 'darwin', arch: 'arm64', dir: 'darwin-arm64', exe: 'codelldb' },
      { platform: 'linux', arch: 'x64', dir: 'linux-x64', exe: 'codelldb' },
      { platform: 'linux', arch: 'arm64', dir: 'linux-arm64', exe: 'codelldb' }
    ])('on $platform/$arch', ({ platform, arch, dir, exe }) => {
      it(`returns the first existing candidate under ${dir}`, async () => {
        stubPlatform(platform, arch);
        accessMock.mockResolvedValue(undefined);

        const result = await resolveCodeLLDBExecutable();

        expect(accessMock).toHaveBeenCalledTimes(1);
        const probed = accessMock.mock.calls[0][0] as string;
        expect(result).toBe(probed);
        expect(probed.endsWith(path.join(dir, 'adapter', exe))).toBe(true);
      });
    });

    it('returns null on unsupported platforms without touching the filesystem', async () => {
      stubPlatform('freebsd');

      await expect(resolveCodeLLDBExecutable()).resolves.toBeNull();
      expect(accessMock).not.toHaveBeenCalled();
    });

    it('falls through to the next candidate when the first does not exist', async () => {
      stubPlatform('linux', 'x64');
      accessMock
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(undefined);

      const result = await resolveCodeLLDBExecutable();

      expect(accessMock).toHaveBeenCalledTimes(2);
      expect(result).toBe(accessMock.mock.calls[1][0]);
    });

    it('probes all four vendored candidates before giving up', async () => {
      stubPlatform('linux', 'x64');
      accessMock.mockRejectedValue(new Error('ENOENT'));

      await expect(resolveCodeLLDBExecutable()).resolves.toBeNull();

      expect(accessMock).toHaveBeenCalledTimes(4);
      const suffix = path.join('vendor', 'codelldb', 'linux-x64', 'adapter', 'codelldb');
      for (const call of accessMock.mock.calls) {
        expect(call[0] as string).toMatch(new RegExp(`${suffix.replace(/\\/g, '\\\\')}$`));
      }
    });

    it('falls back to CODELLDB_PATH when no vendored candidate exists', async () => {
      stubPlatform('darwin', 'arm64');
      vi.stubEnv('CODELLDB_PATH', '/custom/codelldb');
      accessMock.mockImplementation((p: string) =>
        p === '/custom/codelldb' ? Promise.resolve() : Promise.reject(new Error('ENOENT'))
      );

      await expect(resolveCodeLLDBExecutable()).resolves.toBe('/custom/codelldb');
      expect(accessMock).toHaveBeenCalledTimes(5); // 4 vendored candidates + env path
    });

    it('returns null when CODELLDB_PATH is set but does not exist', async () => {
      stubPlatform('darwin', 'x64');
      vi.stubEnv('CODELLDB_PATH', '/missing/codelldb');
      accessMock.mockRejectedValue(new Error('ENOENT'));

      await expect(resolveCodeLLDBExecutable()).resolves.toBeNull();
      expect(accessMock).toHaveBeenCalledTimes(5);
    });
  });

  describe('getCodeLLDBVersion', () => {
    it('returns null when the executable cannot be resolved', async () => {
      stubPlatform('win32');
      accessMock.mockRejectedValue(new Error('ENOENT'));

      await expect(getCodeLLDBVersion()).resolves.toBeNull();
      expect(readFileMock).not.toHaveBeenCalled();
    });

    it('reads the version from the vendored version.json', async () => {
      stubPlatform('linux', 'x64');
      accessMock.mockResolvedValue(undefined);
      readFileMock.mockResolvedValue(JSON.stringify({ version: '1.12.3', platform: 'linux-x64' }));

      await expect(getCodeLLDBVersion()).resolves.toBe('1.12.3');

      const versionFile = readFileMock.mock.calls[0][0] as string;
      expect(versionFile.endsWith(path.join('linux-x64', 'version.json'))).toBe(true);
    });

    it('skips a malformed version.json and reads the next candidate', async () => {
      stubPlatform('linux', 'x64');
      accessMock.mockResolvedValue(undefined);
      readFileMock
        .mockResolvedValueOnce('not-json{')
        .mockResolvedValueOnce(JSON.stringify({ version: '9.9.9' }));

      await expect(getCodeLLDBVersion()).resolves.toBe('9.9.9');
      expect(readFileMock).toHaveBeenCalledTimes(2);
    });

    it('falls back to DEFAULT_CODELLDB_VERSION when no version.json is readable', async () => {
      stubPlatform('win32');
      accessMock.mockResolvedValue(undefined);
      readFileMock.mockRejectedValue(new Error('ENOENT'));

      await expect(getCodeLLDBVersion()).resolves.toBe(DEFAULT_CODELLDB_VERSION);
      expect(readFileMock).toHaveBeenCalledTimes(4);
    });

    it('falls back to DEFAULT_CODELLDB_VERSION when version.json lacks a version field', async () => {
      stubPlatform('darwin', 'arm64');
      accessMock.mockResolvedValue(undefined);
      readFileMock.mockResolvedValue('{}');

      await expect(getCodeLLDBVersion()).resolves.toBe(DEFAULT_CODELLDB_VERSION);
    });
  });

  describe('version drift guard', () => {
    it('keeps DEFAULT_CODELLDB_VERSION in sync with the vendor script default', () => {
      const source = readFileSync(new URL('../scripts/vendor-codelldb.js', import.meta.url), 'utf-8');
      const match = source.match(/CODELLDB_VERSION\s*=\s*process\.env\.CODELLDB_VERSION\s*\|\|\s*'([^']+)'/);

      expect(match).not.toBeNull();
      expect(match![1]).toBe(DEFAULT_CODELLDB_VERSION);
    });
  });
});
