#!/usr/bin/env node

/**
 * compile-jdi-bridge: Compiles JdiDapServer.java into java/out/
 *
 * Replaces vendor-kotlin-debug-adapter.js. Uses javac from the system JDK.
 * Skips compilation when the class was compiled from this very source — decided
 * by the build record it leaves beside the class (`jdi-bridge-build.json`, the
 * source's sha256), not by mtimes: npm writes a package's files in tarball order,
 * so on a fresh install the shipped `.java` lands a few milliseconds after the
 * shipped `.class` and an mtime comparison calls every fresh install stale
 * (issue #1054). Without a record the mtime comparison stands.
 * Fails gracefully if javac is not found.
 *
 * The adapter reads the same record at launch time:
 * `src/utils/jdi-resolver.ts` (`JDI_BRIDGE_RECORD`) — keep the name and shape in step.
 */

import { execFileSync, execSync } from 'child_process';
import { existsSync, statSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JAVA_DIR = resolve(__dirname, '..', 'java');
const SOURCE_FILE = resolve(JAVA_DIR, 'JdiDapServer.java');
const OUT_DIR = resolve(JAVA_DIR, 'out');
const CLASS_FILE = resolve(OUT_DIR, 'JdiDapServer.class');

export const TARGET_RELEASE = 21;
export const BUILD_RECORD = 'jdi-bridge-build.json';

function findJavac() {
  // Check JAVA_HOME first
  if (process.env.JAVA_HOME) {
    const javacPath = resolve(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
    if (existsSync(javacPath)) return javacPath;
  }

  // Try javac in PATH
  try {
    const cmd = process.platform === 'win32' ? 'where javac' : 'which javac';
    const result = execSync(cmd, { windowsHide: true, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (result) return result.split('\n')[0].trim();
  } catch {
    // not in PATH
  }

  return null;
}

function getJavacMajorVersion(javac) {
  try {
    // `javac -version` prints "javac <major>.<minor>.<patch>" on stdout (JDK 9+)
    const output = execFileSync(javac, ['-version'], {
      windowsHide: true,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const match = /javac\s+(\d+)/.exec(output);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/** sha256 (hex) of the file's bytes. */
export function sourceSha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** The record beside the class, or null when there is none or it is unreadable. */
function readBuildRecord(outDir) {
  try {
    const parsed = JSON.parse(readFileSync(join(outDir, BUILD_RECORD), 'utf8'));
    return typeof parsed?.sourceSha256 === 'string' && parsed.sourceSha256.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** Write `{ sourceSha256, release }` beside the class. */
export function writeBuildRecord(outDir, sourceFile) {
  const record = { sourceSha256: sourceSha256(sourceFile), release: TARGET_RELEASE };
  writeFileSync(join(outDir, BUILD_RECORD), JSON.stringify(record, null, 2) + '\n');
}

/**
 * Give a class that has no record one, naming the source beside it. A build from
 * before the record existed is current by mtime (that was the whole verdict then),
 * so recording the source it was compiled from changes nothing about what the
 * class is — it lets a fresh install of the bundle see that for itself.
 * Returns whether a record was written.
 */
export function ensureBuildRecord({ sourceFile, classFile, outDir }) {
  if (!existsSync(classFile) || !existsSync(sourceFile) || readBuildRecord(outDir)) return false;
  writeBuildRecord(outDir, sourceFile);
  return true;
}

/**
 * Whether the class must be (re)compiled: missing, or not compiled from this source.
 * With a record the verdict is by content; without one, by mtime.
 */
export function needsCompilation({ sourceFile, classFile, outDir }) {
  if (!existsSync(classFile)) return true;
  if (!existsSync(sourceFile)) return false; // nothing to compile

  const record = readBuildRecord(outDir);
  if (record) return sourceSha256(sourceFile) !== record.sourceSha256;

  const srcMtime = statSync(sourceFile).mtimeMs;
  const clsMtime = statSync(classFile).mtimeMs;
  return srcMtime > clsMtime;
}

function main() {
  if (process.env.SKIP_JDI_COMPILE) {
    console.log('[compile-jdi-bridge] Skipping (SKIP_JDI_COMPILE set)');
    return;
  }

  if ((process.env.SKIP_ADAPTER_VENDOR || '').trim().toLowerCase() === 'true') {
    console.log('[compile-jdi-bridge] Skipping (SKIP_ADAPTER_VENDOR=true)');
    return;
  }

  if (!existsSync(SOURCE_FILE)) {
    console.error(`[compile-jdi-bridge] Source not found: ${SOURCE_FILE}`);
    process.exit(1);
  }

  const paths = { sourceFile: SOURCE_FILE, classFile: CLASS_FILE, outDir: OUT_DIR };
  if (!needsCompilation(paths)) {
    console.log('[compile-jdi-bridge] JdiDapServer.class is up to date');
    if (ensureBuildRecord(paths)) {
      console.log(`[compile-jdi-bridge] Recorded the source hash in out/${BUILD_RECORD} for the existing class`);
    }
    return;
  }

  const javac = findJavac();
  if (!javac) {
    console.warn('[compile-jdi-bridge] javac not found. JDI bridge will not be available.');
    console.warn(`[compile-jdi-bridge] Install JDK ${TARGET_RELEASE}+ and ensure javac is on PATH or set JAVA_HOME.`);
    // Don't fail hard — adapter will report the error at runtime
    return;
  }

  const javacVersion = getJavacMajorVersion(javac);
  if (javacVersion !== null && javacVersion < TARGET_RELEASE) {
    console.warn(`[compile-jdi-bridge] javac ${javacVersion} is too old (need ${TARGET_RELEASE}+). JDI bridge will not be available.`);
    console.warn(`[compile-jdi-bridge] Install JDK ${TARGET_RELEASE}+ and ensure javac is on PATH or set JAVA_HOME.`);
    // Don't fail hard — adapter will report the error at runtime
    return;
  }

  // Ensure output directory exists
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[compile-jdi-bridge] Compiling JdiDapServer.java with ${javac}`);
  try {
    execFileSync(javac, [
      '--release', String(TARGET_RELEASE),
      SOURCE_FILE,
      '-d', OUT_DIR
    ], {
      windowsHide: true,
      stdio: 'inherit',
      cwd: JAVA_DIR
    });
    console.log('[compile-jdi-bridge] Compilation successful');
  } catch {
    console.error('[compile-jdi-bridge] Compilation failed');
    process.exit(1);
  }

  writeBuildRecord(OUT_DIR, SOURCE_FILE);
  console.log(`[compile-jdi-bridge] Recorded the source hash in out/${BUILD_RECORD}`);
}

// Run if called directly (the tests import the functions above instead)
if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main();
}
