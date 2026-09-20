/**
 * Shared toolchain probe + prebuilt-fixture builder for the COBOL examples (issue #759).
 *
 * The adapter's own source-launch path compiles into examples/cobol/.debug-mcp/;
 * fixtures built here go to examples/cobol/.debug-mcp-test/ so the two never
 * collide (the cpp precedent). cobc is found like the adapter finds it:
 * COBC_PATH, PATH, then the MSYS2/Homebrew install dirs.
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');
export const COBOL_EXAMPLES_DIR = path.join(ROOT, 'examples', 'cobol');
const BUILD_DIR = path.join(COBOL_EXAMPLES_DIR, '.debug-mcp-test');

export type CobolExampleName = 'hello' | 'calls' | 'copybook' | 'rterror' | 's0c7' | 'sysin' | 'pause' | 'dyn';

/** Main source (relative to examples/cobol) plus extra statically linked sources and dynamically CALLed modules. */
const SOURCES: Record<CobolExampleName, { main: string; extra?: string[]; modules?: string[]; copybookDir?: string; runtimeChecks?: boolean }> = {
  hello: { main: 'hello.cob' },
  calls: { main: 'calls/main.cob', extra: ['calls/sub.cob'] },
  copybook: { main: 'copybook/main.cob', copybookDir: 'copybook' },
  rterror: { main: 'rterror.cob', runtimeChecks: true },
  s0c7: { main: 's0c7.cob', runtimeChecks: true },
  sysin: { main: 'sysin.cob' },
  pause: { main: 'pause.cob' },
  dyn: { main: 'dyn/main.cob', modules: ['dyn/mod1.cob'] }
};

export function cobolSourcePath(name: CobolExampleName): string {
  return path.join(COBOL_EXAMPLES_DIR, SOURCES[name].main);
}

export function cobolExtraSources(name: CobolExampleName): string[] {
  return (SOURCES[name].extra ?? []).map((p) => path.join(COBOL_EXAMPLES_DIR, p));
}

/** Sources the example CALLs dynamically (built with `cobc -m` through the `modules` launch option). */
export function cobolModuleSources(name: CobolExampleName): string[] {
  return (SOURCES[name].modules ?? []).map((p) => path.join(COBOL_EXAMPLES_DIR, p));
}

export function cobolCopybookDir(name: CobolExampleName): string | undefined {
  const dir = SOURCES[name].copybookDir;
  return dir ? path.join(COBOL_EXAMPLES_DIR, dir) : undefined;
}

const CANDIDATES = process.platform === 'win32'
  ? ['C:\\msys64\\mingw64\\bin\\cobc.exe', 'C:\\msys64\\ucrt64\\bin\\cobc.exe']
  : ['/opt/homebrew/bin/cobc', '/usr/local/bin/cobc', '/usr/bin/cobc'];

let cachedCobc: string | null | undefined;

function commandWorks(command: string): boolean {
  try {
    return spawnSync(command, ['--version'], { stdio: 'ignore', timeout: 5000, windowsHide: true }).status === 0;
  } catch {
    return false;
  }
}

/** `cobc` resolved to an absolute path through PATH (so the install prefix can be derived), or null. */
function cobcOnPath(): string | null {
  const names = process.platform === 'win32' ? ['cobc.exe', 'cobc'] : ['cobc'];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter((d) => d.length > 0)) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

/** The cobc executable this machine has (absolute path), or null. */
export function findCobcSync(): string | null {
  if (cachedCobc === undefined) {
    const explicit = process.env.COBC_PATH;
    const onPath = cobcOnPath();
    const tried = [...(explicit ? [explicit] : []), ...(onPath ? [onPath] : []), ...CANDIDATES];
    cachedCobc = tried.find((c) => existsSync(c) && commandWorks(c)) ?? null;
  }
  return cachedCobc;
}

export function hasCobolToolchain(): boolean {
  return findCobcSync() !== null;
}

/**
 * Environment for running cobc (and the binaries it builds) outside an MSYS2
 * shell: the install's bin dir on PATH (gcc, libcob DLL) and the dialect
 * config dir, which MSYS2's cobc otherwise looks for at an MSYS-rooted path.
 */
export function cobcEnv(): NodeJS.ProcessEnv {
  const cobc = findCobcSync();
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (!cobc) {
    return env;
  }
  const binDir = path.dirname(cobc);
  const prefix = path.dirname(binDir);
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  env[pathKey] = `${binDir}${path.delimiter}${env[pathKey] ?? ''}`;
  const configDir = path.join(prefix, 'share', 'gnucobol', 'config');
  if (existsSync(configDir) && !env.COB_CONFIG_DIR) {
    env.COB_CONFIG_DIR = configDir;
  }
  const copyDir = path.join(prefix, 'share', 'gnucobol', 'copy');
  if (existsSync(copyDir) && !env.COB_COPY_DIR) {
    env.COB_COPY_DIR = copyDir;
  }
  return env;
}

const buildCache = new Map<CobolExampleName, { sourcePath: string; binaryPath: string }>();

/**
 * Compile an example to a prebuilt executable (memoized; skipped when fresh).
 * Uses the same DWARF-4 flags the adapter uses, but NOT `-fdump=ALL`: the
 * prebuilt-launch e2e proves the adapter regenerates the manifest from
 * `sources` by itself. Throws without cobc — gate callers with hasCobolToolchain().
 */
export function prepareCobolExample(name: CobolExampleName): { sourcePath: string; binaryPath: string } {
  const cached = buildCache.get(name);
  if (cached) {
    return cached;
  }
  const cobc = findCobcSync();
  if (!cobc) {
    throw new Error('GnuCOBOL (cobc) not available. Gate tests with hasCobolToolchain().');
  }
  const spec = SOURCES[name];
  const sourcePath = cobolSourcePath(name);
  if (!existsSync(sourcePath)) {
    throw new Error(`COBOL example source missing: ${sourcePath}`);
  }
  const exeSuffix = process.platform === 'win32' ? '.exe' : '';
  const binaryPath = path.join(BUILD_DIR, `${name}${exeSuffix}`);
  const inputs = [sourcePath, ...cobolExtraSources(name)];
  const fresh = existsSync(binaryPath) && inputs.every((src) => statSync(binaryPath).mtimeMs > statSync(src).mtimeMs);

  if (!fresh) {
    mkdirSync(BUILD_DIR, { recursive: true });
    const args = ['-x', '-g', '-A', '-O0 -gdwarf-4'];
    if (spec.copybookDir) {
      args.push('-I', path.join(COBOL_EXAMPLES_DIR, spec.copybookDir));
    }
    if (spec.runtimeChecks) {
      args.push('--debug');
    }
    args.push('-o', binaryPath, ...inputs);
    const result = spawnSync(cobc, args, { encoding: 'utf-8', timeout: 180_000, windowsHide: true, cwd: BUILD_DIR, env: cobcEnv() });
    if (result.status !== 0) {
      throw new Error(`Failed to compile ${spec.main} with ${cobc} (exit ${result.status}):\n${result.stderr ?? ''}`);
    }
  }
  const entry = { sourcePath, binaryPath };
  buildCache.set(name, entry);
  return entry;
}
