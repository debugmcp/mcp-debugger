/**
 * Resolve the compiled JDI bridge class path.
 *
 * JdiDapServer.java compiles to java/out/JdiDapServer.class.
 * This module resolves that output directory for use by the adapter.
 */
import { existsSync, mkdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The build record the compile step leaves beside JdiDapServer.class (issue #1054):
 * `{ sourceSha256, release }`. Staleness is decided by content when it exists —
 * npm writes a package's files in tarball order, so on a fresh install the shipped
 * `.java` lands a few milliseconds after the shipped `.class` and an mtime comparison
 * calls every fresh install stale (doctor warns, the first launch recompiles into the
 * install dir). The same name and shape are written by
 * `packages/adapter-java/scripts/compile-jdi-bridge.js`, which cannot import this
 * module at postinstall time.
 */
export const JDI_BRIDGE_RECORD = 'jdi-bridge-build.json';
const JDI_BRIDGE_RELEASE = 21;

interface JdiBridgeBuildRecord {
  sourceSha256: string;
  release: number;
}

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
  /** True when `dir` holds a class not compiled from `sourceFile` (a recompile was needed and did not happen). */
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
 * recompiles when the .java source no longer matches the cached .class — this
 * prevents stale bridge classes from silently dropping CLI args added in
 * newer versions (e.g. --owner-pid for the orphan-reap markers). Every
 * launch goes through here (issue #646): a fresh class costs one record read
 * and one hash of the 155 KB source (or two stats where no record exists).
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
    execFileSync(javac, ['--release', String(JDI_BRIDGE_RELEASE), sourceFile, '-d', outDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: sourceDir,
      windowsHide: true
    });
  } catch (err) {
    return fallback(describeCompileFailure(err));
  }
  // Record what was compiled, or a record left by an older build would call this
  // fresh class stale on every launch. Best effort: a directory that refused the
  // write would have refused javac first; the one corner left — a record file
  // that is itself read-only while the class is not — keeps the old record and
  // recompiles on the next launch too, which is wrong permissions, not a verdict
  // this code can improve on.
  try {
    writeBuildRecord(outDir, sourceFile);
  } catch {
    // best effort
  }
  return { dir: outDir, sourceFile, stale: false, recompiled: true };
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
 * Returns true when the cached .class was not compiled from the .java source
 * beside it.
 *
 * With a build record beside the class the verdict is by content: the source's
 * sha256 against the one recorded when the class was compiled; mtimes play no
 * part (issue #1054). Without a record — a `JDI_BRIDGE_DIR` tree, the Docker
 * image's raw `javac` step, a build from before the record existed — the
 * source's mtime is compared with the class's as before. Read and stat failures
 * are treated as "not stale": a missing source shouldn't trigger a rebuild
 * attempt against a known-good cached class.
 */
function isClassStale(sourceFile: string, classDir: string): boolean {
  const record = readBuildRecord(classDir);
  if (record) {
    try {
      return hashSource(sourceFile) !== record.sourceSha256;
    } catch {
      return false;
    }
  }
  const classFile = path.join(classDir, 'JdiDapServer.class');
  try {
    const sourceMtime = statSync(sourceFile).mtimeMs;
    const classMtime = statSync(classFile).mtimeMs;
    return sourceMtime > classMtime;
  } catch {
    return false;
  }
}

function hashSource(sourceFile: string): string {
  return createHash('sha256').update(readFileSync(sourceFile)).digest('hex');
}

/** The build record beside the class, or null when there is none or it is unreadable. */
function readBuildRecord(classDir: string): JdiBridgeBuildRecord | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path.join(classDir, JDI_BRIDGE_RECORD), 'utf-8'));
    const sha = (parsed as { sourceSha256?: unknown } | null)?.sourceSha256;
    if (typeof sha !== 'string' || sha.length === 0) return null;
    return { sourceSha256: sha, release: Number((parsed as { release?: unknown }).release) || JDI_BRIDGE_RELEASE };
  } catch {
    return null;
  }
}

function writeBuildRecord(classDir: string, sourceFile: string): void {
  const record: JdiBridgeBuildRecord = { sourceSha256: hashSource(sourceFile), release: JDI_BRIDGE_RELEASE };
  writeFileSync(path.join(classDir, JDI_BRIDGE_RECORD), JSON.stringify(record, null, 2) + '\n');
}
