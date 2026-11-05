/**
 * CodeLLDB executable resolver
 *
 * Single home for the platform-dir mapping and vendor candidate-path walk
 * (issue #265). The sync entry point exists for callers that cannot await
 * (adapter command construction); both share the same candidate list.
 */

import * as fs from 'fs/promises';
import { constants as fsConstants, existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nodeRequire = createRequire(import.meta.url);

/** Keep in sync with the pinned version in vendor-manifest.json (the vendor script's default) */
export const DEFAULT_CODELLDB_VERSION = '1.12.3';

/**
 * The vendor directory names produced by scripts/vendor-codelldb.js.
 * Drift-guarded against the script's PLATFORMS table (and the root
 * scripts/check-adapters.js list) in codelldb-resolver.test.ts.
 */
export const SUPPORTED_CODELLDB_PLATFORM_DIRS = [
  'win32-x64',
  'darwin-x64',
  'darwin-arm64',
  'linux-x64',
  'linux-arm64'
] as const;

export type CodeLLDBPlatformDir = (typeof SUPPORTED_CODELLDB_PLATFORM_DIRS)[number];

/**
 * Map platform/arch to the vendored CodeLLDB directory name.
 * Windows always maps to x64 — there is no win32-arm64 vendor build.
 */
export function getCodeLLDBPlatformDir(
  platform: NodeJS.Platform,
  arch: string
): CodeLLDBPlatformDir | null {
  if (platform === 'win32') {
    return 'win32-x64';
  }
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  }
  if (platform === 'linux') {
    return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  }
  return null;
}

export function getCodeLLDBExecutableName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'codelldb.exe' : 'codelldb';
}

/**
 * Build the ordered candidate paths for a file under the vendored CodeLLDB
 * tree. `packageRoot` is the first root probed — callers pass their own
 * package root computed from their module location (source files sit at
 * different depths, so a shared __dirname-relative walk would resolve
 * differently per caller); the monorepo fallbacks land on this package's
 * vendor tree, which is the single vendored copy (issue #324).
 */
export function buildVendorCandidatePaths(
  packageRoot: string,
  platformDir: string,
  ...suffix: string[]
): string[] {
  return [
    // Package root (production install: vendor/ ships next to dist/)
    path.resolve(packageRoot, 'vendor', 'codelldb', platformDir, ...suffix),
    // Backward compatibility for older builds that expected vendor under dist/
    path.resolve(packageRoot, 'dist', 'vendor', 'codelldb', platformDir, ...suffix),
    // Monorepo source tree fallbacks
    path.resolve(packageRoot, '..', '..', 'packages', 'codelldb-common', 'vendor', 'codelldb', platformDir, ...suffix),
    path.resolve(process.cwd(), 'packages', 'codelldb-common', 'vendor', 'codelldb', platformDir, ...suffix)
  ];
}

/** Package root as seen from this compiled file (dist → one hop up). */
function defaultPackageRoot(): string {
  return path.resolve(__dirname, '..');
}

/** npm package name for a per-platform CodeLLDB binary payload (issue #383). */
export function getCodeLLDBPlatformPackageName(platformDir: string): string {
  return `@debugmcp/codelldb-${platformDir}`;
}

/**
 * Root directory of the installed @debugmcp/codelldb-<dir> platform package,
 * or null when it is not installed. These packages are optionalDependencies
 * of @debugmcp/mcp-debugger (npm installs exactly the os/cpu match), so this
 * resolves in npx/global installs. Resolving from codelldb-common inside the
 * monorepo fails (it declares no platform-package dependency, drift-guarded);
 * workspace-aware contexts (the bundled CLI's install root, pnpm NODE_PATH)
 * may resolve the payload-less workspace shells, which is harmless because
 * the resolvers probe this candidate LAST and its executable does not exist.
 * `resolvePkg` is injectable so tests stay hermetic; the default path is
 * memoized per platformDir (the answer cannot change within a process, and
 * a failed require.resolve walks node_modules up to the filesystem root).
 */
const platformPackageRootMemo = new Map<string, string | null>();

export function resolveCodeLLDBPlatformPackageRoot(
  platformDir: string,
  resolvePkg?: (id: string) => string
): string | null {
  if (resolvePkg === undefined && platformPackageRootMemo.has(platformDir)) {
    return platformPackageRootMemo.get(platformDir) ?? null;
  }
  const resolve = resolvePkg ?? ((id: string) => nodeRequire.resolve(id));
  let root: string | null;
  try {
    root = path.dirname(resolve(`${getCodeLLDBPlatformPackageName(platformDir)}/package.json`));
  } catch {
    root = null;
  }
  if (resolvePkg === undefined) {
    platformPackageRootMemo.set(platformDir, root);
  }
  return root;
}

/**
 * Synchronous resolver core. Platform/arch default to the live process values
 * READ AT CALL TIME (tests stub the process global; RustDebugAdapter injects
 * its constructor platform override, issue #186). The existence probe is
 * injectable so tests stay hermetic without mocking `fs`.
 */
export function resolveCodeLLDBExecutableSyncImpl(options?: {
  platform?: NodeJS.Platform;
  arch?: string;
  packageRoot?: string;
  exists?: (p: string) => boolean;
  resolvePlatformPackageRoot?: (platformDir: string) => string | null;
}): string | null {
  const platform = options?.platform ?? process.platform;
  const arch = options?.arch ?? process.arch;
  const packageRoot = options?.packageRoot ?? defaultPackageRoot();
  const exists = options?.exists ?? existsSync;
  const resolvePlatformPackageRoot =
    options?.resolvePlatformPackageRoot ?? resolveCodeLLDBPlatformPackageRoot;

  const platformDir = getCodeLLDBPlatformDir(platform, arch);
  if (!platformDir) {
    return null;
  }

  const candidatePaths = buildVendorCandidatePaths(
    packageRoot,
    platformDir,
    'adapter',
    getCodeLLDBExecutableName(platform)
  );

  for (const candidate of candidatePaths) {
    try {
      if (exists(candidate)) {
        return candidate;
      }
    } catch {
      // Try next candidate
    }
  }

  // Explicit CODELLDB_PATH beats the auto-installed platform package (it is
  // deliberate user configuration) but not a vendored copy — the pre-existing
  // documented order for dev checkouts and the Docker image.
  if (process.env.CODELLDB_PATH) {
    try {
      if (exists(process.env.CODELLDB_PATH)) {
        return process.env.CODELLDB_PATH;
      }
    } catch {
      // Fall through
    }
  }

  // Last resort: the installed @debugmcp/codelldb-<dir> platform package
  // (npx/global installs). Resolved lazily — the require walk only runs when
  // everything above missed.
  const platformPackageRoot = resolvePlatformPackageRoot(platformDir);
  if (platformPackageRoot) {
    const candidate = path.join(platformPackageRoot, 'adapter', getCodeLLDBExecutableName(platform));
    try {
      if (exists(candidate)) {
        return candidate;
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

/**
 * Which resolution stage produced the CodeLLDB executable (issue #423).
 * Reported by `mcp-debugger doctor` so users can see whether they are running
 * a vendored copy, an explicit CODELLDB_PATH override, or a platform package.
 */
export type CodeLLDBSource = 'vendored' | 'env:CODELLDB_PATH' | 'platform-package';

/**
 * Resolve the CodeLLDB executable and report which stage of the documented
 * order (vendored → CODELLDB_PATH → platform package) produced it.
 */
export async function resolveCodeLLDBExecutableWithSource(options?: {
  resolvePlatformPackageRoot?: (platformDir: string) => string | null;
}): Promise<{ path: string; source: CodeLLDBSource } | null> {
  const resolvePlatformPackageRoot =
    options?.resolvePlatformPackageRoot ?? resolveCodeLLDBPlatformPackageRoot;

  const platformDir = getCodeLLDBPlatformDir(process.platform, process.arch);
  if (!platformDir) {
    return null;
  }

  const candidatePaths = buildVendorCandidatePaths(
    defaultPackageRoot(),
    platformDir,
    'adapter',
    getCodeLLDBExecutableName(process.platform)
  );

  for (const candidate of candidatePaths) {
    try {
      await fs.access(candidate, fsConstants.F_OK);
      return { path: candidate, source: 'vendored' };
    } catch {
      // Try next candidate
    }
  }

  // Explicit CODELLDB_PATH beats the auto-installed platform package (it is
  // deliberate user configuration) but not a vendored copy — same order as
  // the sync impl above.
  if (process.env.CODELLDB_PATH) {
    try {
      await fs.access(process.env.CODELLDB_PATH, fsConstants.F_OK);
      return { path: process.env.CODELLDB_PATH, source: 'env:CODELLDB_PATH' };
    } catch {
      // Fall through
    }
  }

  // Last resort: the installed @debugmcp/codelldb-<dir> platform package
  // (npx/global installs). Resolved lazily — the require walk only runs when
  // everything above missed.
  const platformPackageRoot = resolvePlatformPackageRoot(platformDir);
  if (platformPackageRoot) {
    const candidate = path.join(platformPackageRoot, 'adapter', getCodeLLDBExecutableName(process.platform));
    try {
      await fs.access(candidate, fsConstants.F_OK);
      return { path: candidate, source: 'platform-package' };
    } catch {
      // Fall through
    }
  }

  return null;
}

/**
 * Resolve the CodeLLDB executable path based on platform
 */
export async function resolveCodeLLDBExecutable(options?: {
  resolvePlatformPackageRoot?: (platformDir: string) => string | null;
}): Promise<string | null> {
  const resolved = await resolveCodeLLDBExecutableWithSource(options);
  return resolved?.path ?? null;
}

/** The `name` of the upstream VSIX manifest (vadimcn/codelldb's package.json). */
const CODELLDB_VSIX_MANIFEST_NAME = 'vscode-lldb';

/** A parsed JSON object file, or null when it is unreadable, not JSON, or not an object. */
async function readJsonObject(file: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf-8'));
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The object's `version` when it is a non-empty string. */
function versionField(data: Record<string, unknown> | null): string | undefined {
  const version = data?.version;
  return typeof version === 'string' && version.length > 0 ? version : undefined;
}

/**
 * The version of the CodeLLDB that resolves, read from that binary's own root
 * and nowhere else (<root>/adapter/codelldb → <root>): `version.json` — the
 * vendor script writes it, the platform packages ship it — then the upstream
 * VSIX manifest `package.json` when it is CodeLLDB's own, which is what a raw
 * extraction under CODELLDB_PATH carries (issue #1066). Another install's
 * metadata is never consulted, so the reported version cannot be
 * misattributed: not a stale vendor tree under the cwd fallback, not the
 * platform package's version.json when CODELLDB_PATH won, not a project's
 * package.json above a hand-placed binary. A vendored copy with no readable metadata keeps the
 * pin the vendor script fetched; any other source reports no version (null)
 * rather than the compiled default.
 */
export async function getCodeLLDBVersion(options?: {
  resolvePlatformPackageRoot?: (platformDir: string) => string | null;
}): Promise<string | null> {
  const resolved = await resolveCodeLLDBExecutableWithSource(options);
  if (!resolved) {
    return null;
  }

  // A symlinked CODELLDB_PATH (~/.local/bin/codelldb → the extraction) keeps
  // its metadata where it points.
  let binary = resolved.path;
  try {
    binary = await fs.realpath(resolved.path);
  } catch {
    // Read beside the path as given
  }
  const root = path.resolve(path.dirname(binary), '..');

  const fromVersionJson = versionField(await readJsonObject(path.join(root, 'version.json')));
  if (fromVersionJson) {
    return fromVersionJson;
  }
  const manifest = await readJsonObject(path.join(root, 'package.json'));
  const fromManifest = manifest?.name === CODELLDB_VSIX_MANIFEST_NAME ? versionField(manifest) : undefined;
  if (fromManifest) {
    return fromManifest;
  }

  return resolved.source === 'vendored' ? DEFAULT_CODELLDB_VERSION : null;
}
