/**
 * Java executable detection utilities using the 'which' library.
 */
import { spawn } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';
import which from 'which';

// Simple logger interface (kept local to avoid external coupling)
interface Logger {
  error: (message: string) => void;
  debug?: (message: string) => void;
}

// Default no-op logger
const noopLogger: Logger = {
  error: () => {},
  debug: () => {}
};

export class CommandNotFoundError extends Error {
  command: string;
  constructor(command: string) {
    super(`Command not found: ${command}`);
    this.name = 'CommandNotFoundError';
    this.command = command;
  }
}

/**
 * Interface for resolving executable commands to their full paths
 */
export interface CommandFinder {
  find(cmd: string): Promise<string>;
}

/**
 * CommandFinder implementation using the 'which' library for PATH-based lookup
 */
class WhichCommandFinder implements CommandFinder {
  private cache = new Map<string, string>();
  constructor(private useCache = true) {}

  async find(cmd: string): Promise<string> {
    if (this.useCache && this.cache.has(cmd)) {
      return this.cache.get(cmd)!;
    }

    const isWindows = process.platform === 'win32';
    try {
      // On Windows, try both with and without .exe extension
      if (isWindows && !cmd.endsWith('.exe')) {
        try {
          const result = await which(`${cmd}.exe`);
          if (this.useCache) {
            this.cache.set(cmd, result);
          }
          return result;
        } catch {
          // Fall through to try without .exe
        }
      }

      const result = await which(cmd);
      if (this.useCache) {
        this.cache.set(cmd, result);
      }
      return result;
    } catch {
      throw new CommandNotFoundError(cmd);
    }
  }
}

// Default command finder instance for production use
let defaultCommandFinder: CommandFinder = new WhichCommandFinder();

/**
 * Set the default command finder (useful for testing)
 * @param finder The CommandFinder to use as default
 */
export function setDefaultCommandFinder(finder: CommandFinder): CommandFinder {
  const previous = defaultCommandFinder;
  defaultCommandFinder = finder;
  return previous;
}

/**
 * Validate that a Java command is a real Java executable
 */
async function isValidJavaExecutable(javaCmd: string, logger: Logger = noopLogger): Promise<boolean> {
  logger.debug?.(`[Java Detection] Validating Java executable: ${javaCmd}`);
  return new Promise((resolve) => {
    const child = spawn(javaCmd, ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(false));
    child.on('exit', (code) => {
      // Java -version outputs to stderr and exits with 0
      const hasJavaOutput = output.includes('java version') ||
                           output.includes('openjdk version') ||
                           output.includes('Java(TM)');
      resolve(code === 0 && hasJavaOutput);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Find JAVA_HOME directory
 */
export function findJavaHome(): string | null {
  const javaHome = process.env.JAVA_HOME;
  if (javaHome && fs.existsSync(javaHome)) {
    return javaHome;
  }
  return null;
}

/**
 * Find a working Java executable
 * @param preferredPath Optional preferred Java path to check first
 * @param logger Optional logger instance for logging detection info
 * @param commandFinder Optional CommandFinder instance (defaults to WhichCommandFinder)
 */
export async function findJavaExecutable(
  preferredPath?: string,
  logger: Logger = noopLogger,
  commandFinder: CommandFinder = defaultCommandFinder
): Promise<string> {
  const isWindows = process.platform === 'win32';
  const triedPaths: string[] = [];

  logger.debug?.(`[Java Detection] Starting discovery...`);

  // 1. User-specified path (if provided, prefer it)
  if (preferredPath) {
    try {
      const resolved = await commandFinder.find(preferredPath);
      triedPaths.push(`${preferredPath} → ${resolved}`);
      if (await isValidJavaExecutable(resolved, logger)) {
        logger.debug?.(`[Java Detection] Using user-specified Java: ${resolved}`);
        return resolved;
      }
    } catch (error) {
      if (error instanceof CommandNotFoundError) {
        triedPaths.push(`${preferredPath} → not found`);
      } else {
        throw error;
      }
    }
  }

  // 2. Environment variable JAVA_HOME
  const javaHome = findJavaHome();
  if (javaHome) {
    const javaCandidates = isWindows
      ? [path.join(javaHome, 'bin', 'java.exe'), path.join(javaHome, 'bin', 'java')]
      : [path.join(javaHome, 'bin', 'java')];

    for (const candidate of javaCandidates) {
      if (fs.existsSync(candidate)) {
        triedPaths.push(`${candidate} → exists`);
        if (await isValidJavaExecutable(candidate, logger)) {
          logger.debug?.(`[Java Detection] Using JAVA_HOME Java: ${candidate}`);
          return candidate;
        }
      } else {
        triedPaths.push(`${candidate} → not found`);
      }
    }
  }

  // 3. Auto-detect from PATH
  const javaCommands = ['java'];

  for (const cmd of javaCommands) {
    logger.debug?.(`[Java Detection] Trying command: ${cmd}`);
    try {
      const resolved = await commandFinder.find(cmd);
      triedPaths.push(`${cmd} → ${resolved}`);
      if (await isValidJavaExecutable(resolved, logger)) {
        logger.debug?.(`[Java Detection] Found valid Java: ${resolved}`);
        return resolved;
      }
    } catch (error) {
      if (error instanceof CommandNotFoundError) {
        triedPaths.push(`${cmd} → not found`);
      } else {
        throw error;
      }
    }
  }

  // No Java found at all
  const triedList = triedPaths.map(p => `  - ${p}`).join('\n');
  throw new Error(
    `Java not found.\nTried:\n${triedList}\n` +
    'Please install Java JDK 8 or higher, or set JAVA_HOME environment variable.'
  );
}

/**
 * Get Java version for a given executable
 * @returns Version string like "17.0.1" or "1.8.0_392" or full version string
 */
export async function getJavaVersion(javaPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(javaPath, ['-version'], { stdio: 'pipe' });
    let output = '';

    // Java outputs version info to stderr
    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(null));
    child.on('exit', (code) => {
      if (code === 0 && output) {
        // Match patterns like:
        // java version "1.8.0_392"
        // openjdk version "17.0.1" 2021-10-19
        // java version "21.0.1" 2023-10-17 LTS
        const match = output.match(/(java|openjdk) version "([^"]+)"/);
        resolve(match ? match[2] : output.trim());
      } else {
        resolve(null);
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(null);
    }, 5000);
  });
}

/**
 * Parse Java major version from version string
 * @param versionString Version string like "17.0.1" or "1.8.0_392"
 * @returns Major version number (e.g., 17 or 8)
 */
export function parseJavaMajorVersion(versionString: string): number {
  // Handle old versioning (1.8.x) and new versioning (9+)
  if (versionString.startsWith('1.')) {
    // Old format: 1.8.0_392 → 8
    const match = versionString.match(/^1\.(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } else {
    // New format: 17.0.1 → 17
    const match = versionString.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

/**
 * Find jdb (Java Debugger) executable
 * @param javaPath Optional Java path to derive jdb location from
 * @param logger Optional logger instance
 * @param commandFinder Optional CommandFinder instance
 */
export async function findJdb(
  javaPath?: string,
  logger: Logger = noopLogger,
  commandFinder: CommandFinder = defaultCommandFinder
): Promise<string> {
  const isWindows = process.platform === 'win32';
  const triedPaths: string[] = [];

  logger.debug?.(`[JDB Detection] Starting discovery...`);

  // 1. If javaPath is provided, try to find jdb in the same bin directory
  if (javaPath) {
    const javaBinDir = path.dirname(javaPath);
    const jdbCandidates = isWindows
      ? [path.join(javaBinDir, 'jdb.exe'), path.join(javaBinDir, 'jdb')]
      : [path.join(javaBinDir, 'jdb')];

    for (const candidate of jdbCandidates) {
      if (fs.existsSync(candidate)) {
        triedPaths.push(`${candidate} → exists`);
        logger.debug?.(`[JDB Detection] Found jdb in Java bin directory: ${candidate}`);
        return candidate;
      } else {
        triedPaths.push(`${candidate} → not found`);
      }
    }
  }

  // 2. Try JAVA_HOME
  const javaHome = findJavaHome();
  if (javaHome) {
    const jdbCandidates = isWindows
      ? [path.join(javaHome, 'bin', 'jdb.exe'), path.join(javaHome, 'bin', 'jdb')]
      : [path.join(javaHome, 'bin', 'jdb')];

    for (const candidate of jdbCandidates) {
      if (fs.existsSync(candidate)) {
        triedPaths.push(`${candidate} → exists`);
        logger.debug?.(`[JDB Detection] Found jdb in JAVA_HOME: ${candidate}`);
        return candidate;
      } else {
        triedPaths.push(`${candidate} → not found`);
      }
    }
  }

  // 3. Try PATH
  try {
    const resolved = await commandFinder.find('jdb');
    triedPaths.push(`jdb → ${resolved}`);
    logger.debug?.(`[JDB Detection] Found jdb in PATH: ${resolved}`);
    return resolved;
  } catch (error) {
    if (error instanceof CommandNotFoundError) {
      triedPaths.push(`jdb → not found`);
    } else {
      throw error;
    }
  }

  // jdb not found
  const triedList = triedPaths.map(p => `  - ${p}`).join('\n');
  throw new Error(
    `jdb (Java Debugger) not found.\nTried:\n${triedList}\n` +
    'jdb is part of the Java JDK. Please install a Java JDK (not just JRE) or set JAVA_HOME.'
  );
}

/**
 * Validate that jdb is working
 */
export async function validateJdb(jdbPath: string, logger: Logger = noopLogger): Promise<boolean> {
  logger.debug?.(`[JDB Validation] Validating jdb: ${jdbPath}`);
  return new Promise((resolve) => {
    const child = spawn(jdbPath, ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(false));
    child.on('exit', (code) => {
      // jdb -version exits with 0 and outputs version info
      // Note: Some older jdb versions may not support -version
      // In that case, we just check if it executes without error
      resolve(code === 0 || output.includes('jdb') || output.includes('Java'));
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
  });
}
