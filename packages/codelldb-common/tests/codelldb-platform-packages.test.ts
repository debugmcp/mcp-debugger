/**
 * Drift guards for the five @debugmcp/codelldb-<platform> packages (issue #383).
 *
 * These packages are binary payload shells: their committed content is only
 * package.json/README/LICENSE/.gitignore, with the CodeLLDB payload staged at
 * pack time by scripts/stage-codelldb-packages.mjs. The guards pin the
 * invariants the release pipeline and the resolver depend on.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { SUPPORTED_CODELLDB_PLATFORM_DIRS } from '../src/codelldb-resolver.js';

interface PlatformPackageJson {
  name: string;
  version: string;
  os: string[];
  cpu: string[];
  codelldbPlatform: string;
  files: string[];
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
  // Windows-on-ARM installs the x64 package and runs under emulation.
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

describe('codelldb platform packages', () => {
  it.each([...SUPPORTED_CODELLDB_PLATFORM_DIRS])('%s package.json invariants', (dir) => {
    const pkg = readPlatformPackage(dir);

    expect(pkg.name).toBe(`@debugmcp/codelldb-${dir}`);
    expect(pkg.codelldbPlatform).toBe(dir);
    // Versioned by CodeLLDB, not by the repo — sync-versions.cjs skips these.
    expect(pkg.version).toBe(manifest.codelldb.version);
    expect(pkg.os).toEqual(EXPECTED_OS_CPU[dir].os);
    expect(pkg.cpu).toEqual(EXPECTED_OS_CPU[dir].cpu);
    // The staged payload plus docs — nothing else may ship.
    expect(pkg.files).toEqual(['adapter', 'lldb', 'lang_support', 'version.json', 'README.md', 'LICENSE']);
    // Payload shells: no lifecycle scripts (postinstall must skip them), no deps.
    expect(pkg.scripts).toBeUndefined();
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.publishConfig?.access).toBe('public');
    // repository.directory is required for npm --provenance
    expect(pkg.repository?.url).toBe('git+https://github.com/debugmcp/mcp-debugger.git');
    expect(pkg.repository?.directory).toBe(`packages/codelldb-${dir}`);
  });

  it('codelldb-common declares no platform-package dependency (resolver hermeticity)', () => {
    // The resolver's default nodeRequire lookup must fail inside the monorepo
    // so the vendor tree keeps precedence and unit tests stay hermetic.
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dep of Object.keys(allDeps)) {
      expect(dep).not.toMatch(/^@debugmcp\/codelldb-(win32|darwin|linux)-/);
    }
  });

  it('plain node cannot resolve a platform package from codelldb-common (vendor tree wins in dev)', () => {
    // Vitest's own module resolution is workspace-aware, and pnpm-run
    // processes carry a NODE_PATH pointing at the hidden hoist dir, so this
    // invariant must be checked in a clean node process: production installs
    // of the monorepo never see the platform packages from codelldb-common.
    const srcDir = path.dirname(fileURLToPath(new URL('../src/x.js', import.meta.url)));
    const env = { ...process.env };
    delete env.NODE_PATH;
    const probe = execFileSync(
      process.execPath,
      [
        '-e',
        `const { createRequire } = require('module');
         const req = createRequire(${JSON.stringify(path.join(srcDir, 'x.js'))});
         try { req.resolve('@debugmcp/codelldb-linux-x64/package.json'); console.log('resolved'); }
         catch { console.log('unresolved'); }`
      ],
      { encoding: 'utf8', env }
    ).trim();
    expect(probe).toBe('unresolved');
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
