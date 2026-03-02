/**
 * Resolve the compiled JDI bridge class path.
 *
 * JdiDapServer.java compiles to java/out/JdiDapServer.class.
 * This module resolves that output directory for use by the adapter.
 */
import { existsSync, mkdirSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, execSync } from 'child_process';

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
 * Ensure the JDI bridge is compiled. Compiles on-demand if needed.
 *
 * @returns Path to the output directory, or null if compilation fails
 */
export function ensureJdiBridgeCompiled(): string | null {
  // Already compiled?
  const existing = resolveJdiBridgeClassDir();
  if (existing) return existing;

  // Find source
  const sourceDir = resolveJdiBridgeSourceDir();
  if (!sourceDir) return null;

  const sourceFile = path.join(sourceDir, 'JdiDapServer.java');
  const outDir = path.join(sourceDir, 'out');

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
      const cmd = process.platform === 'win32' ? 'where javac' : 'which javac';
      const result = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (result) javac = result.split('\n')[0].trim();
    } catch {
      // not found
    }
  }
  if (!javac) return null;

  // Compile
  try {
    mkdirSync(outDir, { recursive: true });
    execFileSync(javac, ['--release', '21', sourceFile, '-d', outDir], {
      stdio: 'inherit',
      cwd: sourceDir
    });
    return outDir;
  } catch {
    return null;
  }
}
