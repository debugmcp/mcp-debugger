/**
 * Drift guards for the five @debugmcp/codelldb-<platform> packages (issue #383).
 *
 * These packages are binary payload shells: their committed content is only
 * package.json/README/LICENSE/.gitignore, with the CodeLLDB payload staged at
 * pack time by scripts/stage-codelldb-packages.mjs. The guards pin the
 * invariants the release pipeline and the resolver depend on — including the
 * hardcoded five-platform lists in release.yml and release-dry-run.sh, which
 * nothing else ties to SUPPORTED_CODELLDB_PLATFORM_DIRS.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SUPPORTED_CODELLDB_PLATFORM_DIRS,
  getCodeLLDBPlatformDir
} from '../src/codelldb-resolver.js';

interface PlatformPackageJson {
  name: string;
  version: string;
  os: string[];
  cpu: string[];
  files: string[];
  exports?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  publishConfig?: { access?: string };
  repository?: { url?: string; directory?: string };
}

const manifest = JSON.parse(
  readFileSync(new URL('../vendor-manifest.json', import.meta.url), 'utf-8')
) as { codelldb: { version: string } };

const EXPECTED_OS_CPU: Record<string, { os: string[]; cpu: string[] }> = {
  // win32 allows arm64 too: no upstream win32-arm64 build exists, so
  // Windows-on-ARM installs the x64 package and runs it under emulation.
  'win32-x64': { os: ['win32'], cpu: ['x64', 'arm64'] },
  'darwin-x64': { os: ['darwin'], cpu: ['x64'] },
  'darwin-arm64': { os: ['darwin'], cpu: ['arm64'] },
  'linux-x64': { os: ['linux'], cpu: ['x64'] },
  'linux-arm64': { os: ['linux'], cpu: ['arm64'] }
};

function readPlatformPackage(dir: string): PlatformPackageJson {
  return JSON.parse(
    readFileSync(new URL(`../../codelldb-${dir}/package.json`, import.meta.url), 'utf-8')
  ) as PlatformPackageJson;
}

/** All codelldb-<os>-<arch> dirs a source text mentions. */
function extractPlatformDirs(source: string): Set<string> {
  return new Set(
    [...source.matchAll(/codelldb-((?:win32|darwin|linux)-[a-z0-9]+)/g)].map((m) => m[1])
  );
}

describe('codelldb platform packages', () => {
  it.each([...SUPPORTED_CODELLDB_PLATFORM_DIRS])('%s package.json invariants', (dir) => {
    const pkg = readPlatformPackage(dir);

    expect(pkg.name).toBe(`@debugmcp/codelldb-${dir}`);
    // Versioned by CodeLLDB, not by the repo — sync-versions.cjs writes the
    // pin into any workspace package declaring os/cpu.
    expect(pkg.version).toBe(manifest.codelldb.version);
    expect(pkg.os).toEqual(EXPECTED_OS_CPU[dir].os);
    expect(pkg.cpu).toEqual(EXPECTED_OS_CPU[dir].cpu);
    // The staged payload plus docs — nothing else may ship.
    expect(pkg.files).toEqual(['adapter', 'lldb', 'lang_support', 'version.json', 'README.md', 'LICENSE']);
    // Payload shells: no lifecycle scripts (postinstall must skip them), no
    // deps, and no exports map — the resolver require.resolve()s
    // '<pkg>/package.json', which an exports field would break with
    // ERR_PACKAGE_PATH_NOT_EXPORTED that the resolver swallows into null.
    expect(pkg.scripts).toBeUndefined();
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.exports).toBeUndefined();
    expect(pkg.publishConfig?.access).toBe('public');
    // repository.directory is required for npm --provenance
    expect(pkg.repository?.url).toBe('git+https://github.com/debugmcp/mcp-debugger.git');
    expect(pkg.repository?.directory).toBe(`packages/codelldb-${dir}`);
  });

  it('every declared os/cpu combination maps back to the package via the resolver', () => {
    // npm's install selection (os/cpu fields) and the resolver's lookup
    // (getCodeLLDBPlatformDir) must agree, or a platform gets the package
    // installed but never resolved — e.g. win32/arm64 must map to win32-x64.
    for (const dir of SUPPORTED_CODELLDB_PLATFORM_DIRS) {
      const pkg = readPlatformPackage(dir);
      for (const os of pkg.os) {
        for (const cpu of pkg.cpu) {
          expect(
            getCodeLLDBPlatformDir(os as NodeJS.Platform, cpu),
            `getCodeLLDBPlatformDir('${os}', '${cpu}')`
          ).toBe(dir);
        }
      }
    }
  });

  it('codelldb-common declares no platform-package dependency (resolver precedence)', () => {
    // The platform-package candidate must stay the LAST resort: the vendor
    // tree and CODELLDB_PATH win in dev/Docker because resolution from
    // codelldb-common finds no platform package (only workspace-aware
    // contexts see the payload-less shells, whose executable never exists).
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dep of Object.keys(allDeps)) {
      expect(dep).not.toMatch(/^@debugmcp\/codelldb-(win32|darwin|linux)-/);
    }
  });

  it('release.yml covers exactly the supported platforms (pack, publish, provenance)', () => {
    const yml = readFileSync(new URL('../../../.github/workflows/release.yml', import.meta.url), 'utf-8');
    expect(extractPlatformDirs(yml)).toEqual(new Set(SUPPORTED_CODELLDB_PLATFORM_DIRS));
    for (const dir of SUPPORTED_CODELLDB_PLATFORM_DIRS) {
      // dry-run pack + publish loop + provenance pack
      const occurrences = yml.split(`codelldb-${dir}`).length - 1;
      expect(occurrences, `release.yml mentions of codelldb-${dir}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('release-dry-run.sh covers exactly the supported platforms', () => {
    const sh = readFileSync(new URL('../../../scripts/release-dry-run.sh', import.meta.url), 'utf-8');
    expect(extractPlatformDirs(sh)).toEqual(new Set(SUPPORTED_CODELLDB_PLATFORM_DIRS));
  });

  it('@debugmcp/mcp-debugger lists all five platform packages as optionalDependencies', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../mcp-debugger/package.json', import.meta.url), 'utf-8')
    ) as { optionalDependencies?: Record<string, string> };
    const expected = [...SUPPORTED_CODELLDB_PLATFORM_DIRS].map((d) => `@debugmcp/codelldb-${d}`).sort();
    expect(Object.keys(pkg.optionalDependencies ?? {}).sort()).toEqual(expected);
    for (const spec of Object.values(pkg.optionalDependencies ?? {})) {
      expect(spec).toBe('workspace:*');
    }
  });
});
