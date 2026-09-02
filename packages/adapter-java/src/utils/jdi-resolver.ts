/**
 * Resolve the compiled JDI bridge class path.
 *
 * JdiDapServer.java compiles to java/out/JdiDapServer.class.
 * This module resolves that output directory for use by the adapter.
 */
import { existsSync, mkdirSync, statSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the JDI bridge class output directory (containing JdiDapServer.class).
 *
 * @returns Absolute path to the output directory, or null if not found
 */
export function resolveJdiBridgeClassDir(): string | null {
  const candidatePaths = [
    // When running from TypeScript source (ts-node, vitest)
    path.resolve(__dirname, '..', '..', 'java', 'out'),
    // When running from compiled dist/
    path.resolve(__dirname, '..', 'java', 'out'),
    // From compiled workspace distribution (dist/packages/adapter-java/src)
    path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'adapter-java', 'java', 'out'),
    // Bundled npx CLI: every module shares dist/ as __dirname, and the bridge
    // is copied to dist/packages/adapter-java/java by bundle-cli.js (#354)
    path.resolve(__dirname, 'packages', 'adapter-java', 'java', 'out'),
    // Fallback: workspace-relative from CWD
    path.resolve(process.cwd(), 'packages', 'adapter-java', 'java', 'out'),
  ];

  // Check environment variable override
  if (process.env.JDI_BRIDGE_DIR) {
    if (existsSync(path.join(process.env.JDI_BRIDGE_DIR, 'JdiDapServer.class'))) {
      return process.env.JDI_BRIDGE_DIR;
    }
  }

  for (const candidate of candidatePaths) {
    try {
      if (existsSync(path.join(candidate, 'JdiDapServer.class'))) {
        return candidate;
      }
    } catch {
      // Try next
    }
  }

  return null;
}

/**
 * Resolve the JDI bridge Java source directory.
 */
function resolveJdiBridgeSourceDir(): string | null {
  const candidatePaths = [
    path.resolve(__dirname, '..', '..', 'java'),
    path.resolve(__dirname, '..', 'java'),
    path.resolve(__dirname, '..', '..', '..', '..', 'packages', 'adapter-java', 'java'),
    // Bundled npx CLI layout (see resolveJdiBridgeClassDir)
    path.resolve(__dirname, 'packages', 'adapter-java', 'java'),
    path.resolve(process.cwd(), 'packages', 'adapter-java', 'java'),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (existsSync(path.join(candidate, 'JdiDapServer.java'))) {
        return candidate;
      }
    } catch {
      // Try next
    }
  }

  return null;
}

/**
 * What the launch path learned about the bridge (issue #646).
 */
export interface JdiBridgeStatus {
  /** Class directory to put on the JVM classpath, or null when nothing usable exists. */
  dir: string | null;
  /** Resolved JdiDapServer.java, or null when no source ships with this install. */
  sourceFile: string | null;
  /** True when `dir` holds a class older than `sourceFile` (a recompile was needed and did not happen). */
  stale: boolean;
  /** True when this call ran javac successfully. */
  recompiled: boolean;
  /** Why a needed recompile did not happen: no javac, or javac failed (its stderr, trimmed). */
  error?: string;
}

/**
 * Compare the shipped source against a compiled class directory without
 * compiling anything. `JDI_BRIDGE_DIR` is an explicit override and is never
 * reported stale — comparing it against an unrelated in-tree source would be
 * spurious.
 */
export function isJdiBridgeStale(): boolean {
  const classDir = resolveJdiBridgeClassDir();
  if (!classDir || isEnvOverride(classDir)) return false;
  const sourceDir = resolveJdiBridgeSourceDir();
  return sourceDir ? isClassStale(path.join(sourceDir, 'JdiDapServer.java'), classDir) : false;
}

/**
 * Ensure the JDI bridge is compiled. Compiles on-demand if needed, and also
 * recompiles when the .java source is newer than the cached .class — this
 * prevents stale bridge classes from silently dropping CLI args added in
 * newer versions (e.g. --owner-pid for the orphan-reap markers). Every
 * launch goes through here (issue #646): a fresh class costs two stats.
 */
export function ensureJdiBridge(): JdiBridgeStatus {
  // Find source first so we can compare against any cached .class
  const sourceDir = resolveJdiBridgeSourceDir();
  const sourceFile = sourceDir ? path.join(sourceDir, 'JdiDapServer.java') : null;

  const existing = resolveJdiBridgeClassDir();
  const fresh = (dir: string): JdiBridgeStatus => ({ dir, sourceFile, stale: false, recompiled: false });

  // An explicit JDI_BRIDGE_DIR is the user's business: never rebuilt, never stale.
  if (existing && isEnvOverride(existing)) return fresh(existing);

  // Already compiled and not stale?
  if (existing && (!sourceFile || !isClassStale(sourceFile, existing))) return fresh(existing);

  if (!sourceDir || !sourceFile) {
    return { dir: null, sourceFile: null, stale: false, recompiled: false };
  }

  const outDir = path.join(sourceDir, 'out');
  // Whatever we return short of a successful compile is the stale class (if any).
  const fallback = (error: string): JdiBridgeStatus => ({
    dir: existing,
    sourceFile,
    stale: existing !== null,
    recompiled: false,
    error
  });

  // Find javac
  let javac: string | null = null;
  if (process.env.JAVA_HOME) {
    /* istanbul ignore next -- platform-specific executable name */
    const javacExe = process.platform === 'win32' ? 'javac.exe' : 'javac';
    const candidate = path.resolve(process.env.JAVA_HOME, 'bin', javacExe);
    if (existsSync(candidate)) javac = candidate;
  }
  if (!javac) {
    try {
      /* istanbul ignore next -- platform-specific command */
      const finder = process.platform === 'win32' ? 'where' : 'which';
      const result = execFileSync(finder, ['javac'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
      if (result) javac = result.split('\n')[0].trim();
    } catch {
      // not found
    }
  }
  // No compiler, or compilation fails: a cached (possibly stale) class beats
  // nothing — e.g. a read-only global npm install dir where javac can't write.
  if (!javac) return fallback('javac not found (set JAVA_HOME or put javac on PATH)');

  // Compile. Capture the compiler's output instead of inheriting the proxy
  // worker's stdio, so a failure can say why.
  try {
    mkdirSync(outDir, { recursive: true });
    execFileSync(javac, ['--release', '21', sourceFile, '-d', outDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: sourceDir,
      windowsHide: true
    });
    return { dir: outDir, sourceFile, stale: false, recompiled: true };
  } catch (err) {
    return fallback(describeCompileFailure(err));
  }
}

/**
 * Ensure the JDI bridge is compiled; the class directory or null.
 * Thin wrapper over ensureJdiBridge() for callers that only need the path.
 */
export function ensureJdiBridgeCompiled(): string | null {
  return ensureJdiBridge().dir;
}

function isEnvOverride(classDir: string): boolean {
  return !!process.env.JDI_BRIDGE_DIR && classDir === process.env.JDI_BRIDGE_DIR;
}

function describeCompileFailure(err: unknown): string {
  const stderr = (err as { stderr?: unknown })?.stderr;
  const text = typeof stderr === 'string' ? stderr : Buffer.isBuffer(stderr) ? stderr.toString('utf-8') : '';
  const firstLines = text.trim().split('\n').slice(0, 5).join('\n').trim();
  const message = err instanceof Error ? err.message : String(err);
  return firstLines ? `javac failed: ${firstLines}` : `javac failed: ${message}`;
}

/**
 * Returns true when the .java source has a newer mtime than the cached
 * .class. Stat failures are treated as "not stale" — a missing source
 * shouldn't trigger a rebuild attempt against a known-good cached class.
 */
function isClassStale(sourceFile: string, classDir: string): boolean {
  const classFile = path.join(classDir, 'JdiDapServer.class');
  try {
    const sourceMtime = statSync(sourceFile).mtimeMs;
    const classMtime = statSync(classFile).mtimeMs;
    return sourceMtime > classMtime;
  } catch {
    return false;
  }
}
