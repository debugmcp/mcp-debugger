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
  DEFAULT_CODELLDB_VERSION,
  getCodeLLDBPlatformDir,
  getCodeLLDBExecutableName,
  getCodeLLDBPlatformPackageName,
  resolveCodeLLDBPlatformPackageRoot,
  SUPPORTED_CODELLDB_PLATFORM_DIRS,
  buildVendorCandidatePaths,
  resolveCodeLLDBExecutableSyncImpl
} from '../src/codelldb-resolver.js';

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
      // Windows-on-ARM installs the x64 package (no upstream arm64 build)
      { platform: 'win32', arch: 'arm64', dir: 'win32-x64', exe: 'codelldb.exe' },
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

      await expect(
        resolveCodeLLDBExecutable({ resolvePlatformPackageRoot: () => null })
      ).resolves.toBeNull();

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

      await expect(
        resolveCodeLLDBExecutable({ resolvePlatformPackageRoot: () => null })
      ).resolves.toBe('/custom/codelldb');
      expect(accessMock).toHaveBeenCalledTimes(5); // 4 vendored candidates + env path
    });

    it('returns null when CODELLDB_PATH is set but does not exist', async () => {
      stubPlatform('darwin', 'x64');
      vi.stubEnv('CODELLDB_PATH', '/missing/codelldb');
      accessMock.mockRejectedValue(new Error('ENOENT'));

      await expect(
        resolveCodeLLDBExecutable({ resolvePlatformPackageRoot: () => null })
      ).resolves.toBeNull();
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

      await expect(
        getCodeLLDBVersion({ resolvePlatformPackageRoot: () => null })
      ).resolves.toBe(DEFAULT_CODELLDB_VERSION);
      // Sibling-of-resolved-binary candidate + the 4 vendor candidates
      expect(readFileMock).toHaveBeenCalledTimes(5);
    });

    it('falls back to DEFAULT_CODELLDB_VERSION when version.json lacks a version field', async () => {
      stubPlatform('darwin', 'arm64');
      accessMock.mockResolvedValue(undefined);
      readFileMock.mockResolvedValue('{}');

      await expect(getCodeLLDBVersion()).resolves.toBe(DEFAULT_CODELLDB_VERSION);
    });
  });

  describe('version drift guard', () => {
    it('keeps DEFAULT_CODELLDB_VERSION in sync with the pinned vendor-manifest version', () => {
      // The vendor script's default version comes from the committed digest
      // manifest; the resolver's compile-time default must match it.
      const manifest = JSON.parse(
        readFileSync(new URL('../vendor-manifest.json', import.meta.url), 'utf-8')
      ) as { codelldb: { version: string; assets: Record<string, string> } };

      expect(manifest.codelldb.version).toBe(DEFAULT_CODELLDB_VERSION);
      // Every pinned digest must look like a sha256 hex string.
      for (const [asset, digest] of Object.entries(manifest.codelldb.assets)) {
        expect(digest, `digest for ${asset}`).toMatch(/^[0-9a-f]{64}$/);
      }
    });
  });

  describe('getCodeLLDBPlatformDir', () => {
    it.each([
      ['win32', 'x64', 'win32-x64'],
      ['win32', 'arm64', 'win32-x64'], // win32 always maps to x64 (no arm64 vendor build)
      ['darwin', 'x64', 'darwin-x64'],
      ['darwin', 'arm64', 'darwin-arm64'],
      ['linux', 'x64', 'linux-x64'],
      ['linux', 'arm64', 'linux-arm64']
    ])('maps %s/%s to %s', (platform, arch, expected) => {
      expect(getCodeLLDBPlatformDir(platform as NodeJS.Platform, arch)).toBe(expected);
    });

    it('returns null for unsupported platforms', () => {
      expect(getCodeLLDBPlatformDir('freebsd' as NodeJS.Platform, 'x64')).toBeNull();
      expect(getCodeLLDBPlatformDir('aix' as NodeJS.Platform, 'ppc64')).toBeNull();
    });
  });

  describe('getCodeLLDBExecutableName', () => {
    it('appends .exe on Windows only', () => {
      expect(getCodeLLDBExecutableName('win32')).toBe('codelldb.exe');
      expect(getCodeLLDBExecutableName('linux')).toBe('codelldb');
      expect(getCodeLLDBExecutableName('darwin')).toBe('codelldb');
    });
  });

  describe('buildVendorCandidatePaths', () => {
    it('produces the four vendored candidates in precedence order', () => {
      const pkgRoot = path.resolve('/repo/packages/codelldb-common');
      const candidates = buildVendorCandidatePaths(pkgRoot, 'linux-x64', 'adapter', 'codelldb');

      expect(candidates).toEqual([
        path.join(pkgRoot, 'vendor', 'codelldb', 'linux-x64', 'adapter', 'codelldb'),
        path.join(pkgRoot, 'dist', 'vendor', 'codelldb', 'linux-x64', 'adapter', 'codelldb'),
        path.resolve(pkgRoot, '..', '..', 'packages', 'codelldb-common', 'vendor', 'codelldb', 'linux-x64', 'adapter', 'codelldb'),
        path.resolve(process.cwd(), 'packages', 'codelldb-common', 'vendor', 'codelldb', 'linux-x64', 'adapter', 'codelldb')
      ]);
    });

    it('supports arbitrary suffix segments (version.json)', () => {
      const candidates = buildVendorCandidatePaths(path.resolve('/pkg'), 'win32-x64', 'version.json');

      expect(candidates).toHaveLength(4);
      for (const candidate of candidates) {
        expect(candidate.endsWith(path.join('codelldb', 'win32-x64', 'version.json'))).toBe(true);
      }
    });
  });

  describe('resolveCodeLLDBExecutableSyncImpl', () => {
    it('returns null on unsupported platforms without probing', () => {
      const exists = vi.fn();

      expect(
        resolveCodeLLDBExecutableSyncImpl({ platform: 'freebsd' as NodeJS.Platform, exists })
      ).toBeNull();
      expect(exists).not.toHaveBeenCalled();
    });

    it('returns the first existing candidate', () => {
      const pkgRoot = path.resolve('/pkg');
      const expected = buildVendorCandidatePaths(pkgRoot, 'linux-x64', 'adapter', 'codelldb');
      const exists = vi.fn((p: string) => p === expected[1]);

      const result = resolveCodeLLDBExecutableSyncImpl({
        platform: 'linux',
        arch: 'x64',
        packageRoot: pkgRoot,
        exists
      });

      expect(result).toBe(expected[1]);
      expect(exists).toHaveBeenCalledTimes(2);
    });

    it('probes candidates rooted at the provided packageRoot', () => {
      const pkgRoot = path.resolve('/elsewhere/adapter-rust');
      const exists = vi.fn().mockReturnValue(false);

      resolveCodeLLDBExecutableSyncImpl({ platform: 'linux', arch: 'arm64', packageRoot: pkgRoot, exists });

      const probed = exists.mock.calls.map((c) => c[0] as string);
      expect(probed[0]).toBe(path.join(pkgRoot, 'vendor', 'codelldb', 'linux-arm64', 'adapter', 'codelldb'));
      expect(probed[1]).toBe(path.join(pkgRoot, 'dist', 'vendor', 'codelldb', 'linux-arm64', 'adapter', 'codelldb'));
    });

    it('probes codelldb.exe when the injected platform is win32', () => {
      const exists = vi.fn().mockReturnValue(true);

      const result = resolveCodeLLDBExecutableSyncImpl({ platform: 'win32', arch: 'x64', exists });

      expect(result?.endsWith(path.join('win32-x64', 'adapter', 'codelldb.exe'))).toBe(true);
    });

    it('falls back to CODELLDB_PATH only after all four candidates miss', () => {
      vi.stubEnv('CODELLDB_PATH', '/custom/sync/codelldb');
      const exists = vi.fn((p: string) => p === '/custom/sync/codelldb');

      const result = resolveCodeLLDBExecutableSyncImpl({
        platform: 'linux', arch: 'x64', exists, resolvePlatformPackageRoot: () => null
      });

      expect(result).toBe('/custom/sync/codelldb');
      expect(exists).toHaveBeenCalledTimes(5);
    });

    it('returns null when no candidate nor CODELLDB_PATH exists', () => {
      vi.stubEnv('CODELLDB_PATH', '/missing/codelldb');
      const exists = vi.fn().mockReturnValue(false);

      expect(resolveCodeLLDBExecutableSyncImpl({
        platform: 'linux', arch: 'x64', exists, resolvePlatformPackageRoot: () => null
      })).toBeNull();
      expect(exists).toHaveBeenCalledTimes(5);
    });

    it('defaults platform and arch from process at call time', () => {
      stubPlatform('darwin', 'arm64');
      const exists = vi.fn().mockReturnValue(true);

      const result = resolveCodeLLDBExecutableSyncImpl({ exists });

      expect(result).toContain('darwin-arm64');
    });
  });

  describe('platform package resolution (issue #383)', () => {
    const pkgRoot = path.resolve('/npx-install/node_modules/@debugmcp/codelldb-linux-x64');

    it('getCodeLLDBPlatformPackageName maps a platform dir to the npm package name', () => {
      expect(getCodeLLDBPlatformPackageName('linux-x64')).toBe('@debugmcp/codelldb-linux-x64');
      expect(getCodeLLDBPlatformPackageName('win32-x64')).toBe('@debugmcp/codelldb-win32-x64');
    });

    it('resolveCodeLLDBPlatformPackageRoot returns the package dir on success and null on failure', () => {
      const resolvePkg = vi.fn().mockReturnValue(path.join(pkgRoot, 'package.json'));
      expect(resolveCodeLLDBPlatformPackageRoot('linux-x64', resolvePkg)).toBe(pkgRoot);
      expect(resolvePkg).toHaveBeenCalledWith('@debugmcp/codelldb-linux-x64/package.json');

      const failing = vi.fn(() => {
        throw new Error('MODULE_NOT_FOUND');
      });
      expect(resolveCodeLLDBPlatformPackageRoot('linux-x64', failing)).toBeNull();
    });

    it('sync: resolves the installed platform package after the vendor candidates miss', () => {
      const expected = path.join(pkgRoot, 'adapter', 'codelldb');
      const exists = vi.fn((p: string) => p === expected);

      const result = resolveCodeLLDBExecutableSyncImpl({
        platform: 'linux',
        arch: 'x64',
        exists,
        resolvePlatformPackageRoot: () => pkgRoot
      });

      expect(result).toBe(expected);
      // 4 vendor candidates first, then the platform-package candidate
      expect(exists).toHaveBeenCalledTimes(5);
      expect(exists.mock.calls[4][0]).toBe(expected);
    });

    it('sync: the vendor tree wins without even resolving the platform package (lazy)', () => {
      const exists = vi.fn().mockReturnValue(true);
      const resolvePlatformPackageRoot = vi.fn().mockReturnValue(pkgRoot);

      const result = resolveCodeLLDBExecutableSyncImpl({
        platform: 'linux',
        arch: 'x64',
        exists,
        resolvePlatformPackageRoot
      });

      expect(exists).toHaveBeenCalledTimes(1);
      expect(result).not.toContain('@debugmcp');
      // Lazy: the require walk never runs when a vendor candidate hits.
      expect(resolvePlatformPackageRoot).not.toHaveBeenCalled();
    });

    it('sync: explicit CODELLDB_PATH beats the installed platform package', () => {
      vi.stubEnv('CODELLDB_PATH', '/custom/pkg/codelldb');
      const packageBinary = path.join(pkgRoot, 'adapter', 'codelldb');
      const exists = vi.fn((p: string) => p === '/custom/pkg/codelldb' || p === packageBinary);
      const resolvePlatformPackageRoot = vi.fn().mockReturnValue(pkgRoot);

      const result = resolveCodeLLDBExecutableSyncImpl({
        platform: 'linux',
        arch: 'x64',
        exists,
        resolvePlatformPackageRoot
      });

      expect(result).toBe('/custom/pkg/codelldb');
      // 4 vendor misses + env hit; the platform package is never consulted.
      expect(exists).toHaveBeenCalledTimes(5);
      expect(resolvePlatformPackageRoot).not.toHaveBeenCalled();
    });

    it('sync: platform package is the last resort when CODELLDB_PATH is set but missing', () => {
      vi.stubEnv('CODELLDB_PATH', '/missing/custom/codelldb');
      const packageBinary = path.join(pkgRoot, 'adapter', 'codelldb');
      const exists = vi.fn((p: string) => p === packageBinary);

      const result = resolveCodeLLDBExecutableSyncImpl({
        platform: 'linux',
        arch: 'x64',
        exists,
        resolvePlatformPackageRoot: () => pkgRoot
      });

      expect(result).toBe(packageBinary);
      // 4 vendor + env + platform package
      expect(exists).toHaveBeenCalledTimes(6);
      expect(exists.mock.calls[5][0]).toBe(packageBinary);
    });

    it('async: resolves the installed platform package after the vendor candidates miss', async () => {
      stubPlatform('linux', 'x64');
      const expected = path.join(pkgRoot, 'adapter', 'codelldb');
      accessMock.mockImplementation((p: string) =>
        p === expected ? Promise.resolve() : Promise.reject(new Error('ENOENT'))
      );

      await expect(
        resolveCodeLLDBExecutable({ resolvePlatformPackageRoot: () => pkgRoot })
      ).resolves.toBe(expected);
      expect(accessMock).toHaveBeenCalledTimes(5);
    });

  });

  describe('platform table drift guards', () => {
    it('matches the PLATFORMS keys in scripts/vendor-codelldb.js', () => {
      const source = readFileSync(new URL('../scripts/vendor-codelldb.js', import.meta.url), 'utf-8');
      const block = source.match(/const PLATFORMS = \{([\s\S]*?)\n\};/);

      expect(block).not.toBeNull();
      const keys = [...block![1].matchAll(/'([a-z0-9-]+)':\s*\{/g)].map((m) => m[1]);
      expect([...keys].sort()).toEqual([...SUPPORTED_CODELLDB_PLATFORM_DIRS].sort());
    });

    it('matches the Rust platforms list in scripts/check-adapters.js', () => {
      const source = readFileSync(new URL('../../../scripts/check-adapters.js', import.meta.url), 'utf-8');
      const match = source.match(/platforms:\s*\[([^\]]+)\]/);

      expect(match).not.toBeNull();
      const keys = match![1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
      expect([...keys].sort()).toEqual([...SUPPORTED_CODELLDB_PLATFORM_DIRS].sort());
    });
  });
});
