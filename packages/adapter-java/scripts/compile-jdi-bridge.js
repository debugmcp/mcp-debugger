#!/usr/bin/env node

/**
 * compile-jdi-bridge: Compiles JdiDapServer.java into java/out/
 *
 * Replaces vendor-kotlin-debug-adapter.js. Uses javac from the system JDK.
 * Skips compilation if the .class file is newer than the .java source.
 * Fails gracefully if javac is not found.
 */

import { execFileSync, execSync } from 'child_process';
import { existsSync, statSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JAVA_DIR = resolve(__dirname, '..', 'java');
const SOURCE_FILE = resolve(JAVA_DIR, 'JdiDapServer.java');
const OUT_DIR = resolve(JAVA_DIR, 'out');
const CLASS_FILE = resolve(OUT_DIR, 'JdiDapServer.class');
const TARGET_RELEASE = 21;

function findJavac() {
  // Check JAVA_HOME first
  if (process.env.JAVA_HOME) {
    const javacPath = resolve(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
    if (existsSync(javacPath)) return javacPath;
  }

  // Try javac in PATH
  try {
    const cmd = process.platform === 'win32' ? 'where javac' : 'which javac';
    const result = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
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
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const match = /javac\s+(\d+)/.exec(output);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function needsCompilation() {
  if (!existsSync(CLASS_FILE)) return true;
  if (!existsSync(SOURCE_FILE)) return false; // nothing to compile

  const srcMtime = statSync(SOURCE_FILE).mtimeMs;
  const clsMtime = statSync(CLASS_FILE).mtimeMs;
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

  if (!needsCompilation()) {
    console.log('[compile-jdi-bridge] JdiDapServer.class is up to date');
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
      stdio: 'inherit',
      cwd: JAVA_DIR
    });
    console.log('[compile-jdi-bridge] Compilation successful');
  } catch (err) {
    console.error('[compile-jdi-bridge] Compilation failed');
    process.exit(1);
  }
}

main();
