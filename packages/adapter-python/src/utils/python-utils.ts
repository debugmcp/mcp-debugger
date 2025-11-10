/**
 * Python executable detection utilities using the 'which' library.
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

// Local CommandFinder abstraction and which-based implementation

export class CommandNotFoundError extends Error {
  command: string;
  constructor(command: string) {
    super(command);
    this.name = 'CommandNotFoundError';
    this.command = command;
  }
}

export interface CommandFinder {
  find(cmd: string): Promise<string>;
}

class WhichCommandFinder implements CommandFinder {
  private cache = new Map<string, string>();
  constructor(private useCache = true) {}

  async find(cmd: string): Promise<string> {
    if (this.useCache && this.cache.has(cmd)) {
      return this.cache.get(cmd)!;
    }

    const isWindows = process.platform === 'win32';
    const verboseDiscovery = process.env.DEBUG_PYTHON_DISCOVERY === 'true';
    try {
      // Fix for Windows: which library fails if PATH is undefined but Path exists
      // Windows env vars are case-insensitive, but Node.js treats them as case-sensitive
      if (isWindows) {
        // Diagnostic logging in CI to understand the issue
        if (verboseDiscovery) {
          const pathEntries = process.env.PATH?.split(';') || [];
          console.error(`[Python Discovery] Looking for command: ${cmd}`);
          console.error(`[Python Discovery] Environment:`, {
            CI: process.env.CI,
            GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
            PATH: process.env.PATH ? `defined (${pathEntries.length} entries)` : 'undefined',
            Path: process.env.Path ? `defined (${process.env.Path?.split(';').length} entries)` : 'undefined',
            PATHEXT: process.env.PATHEXT,
          });

          // Show first 10 PATH entries to see what's being searched
          if (process.env.PATH) {
            console.error(`[Python Discovery] First 10 PATH entries:`);
            pathEntries.slice(0, 10).forEach((entry, idx) => {
              const info = entry.toLowerCase().includes('python') ? ' [CONTAINS PYTHON]' : '';
              console.error(`  ${idx}: ${entry}${info}`);
            });

            // Check for common PATH issues
            const pathIssues: string[] = [];
            if (process.env.PATH.includes(';;')) pathIssues.push('empty entries (;;)');
            if (process.env.PATH.includes('"')) pathIssues.push('contains quotes');
            if (process.env.PATH.trim() !== process.env.PATH) pathIssues.push('has leading/trailing spaces');
            if (pathIssues.length > 0) {
              console.error(`[Python Discovery] PATH issues found:`, pathIssues);
            }
          }
        }

        if (!process.env.PATH && process.env.Path) {
          process.env.PATH = process.env.Path;
          if (verboseDiscovery) {
            console.error(`[Python Discovery] Copied Path to PATH`);
          }
        }
      }

      const shimPattern = /\\microsoft\\windowsapps\\(python(\d+)?|py)\.exe$/;

      const filterWindowsStoreAliases = (candidates: string[]): string[] => {
        if (!isWindows) {
          return candidates;
        }
        return candidates.filter((candidate) => {
          const normalized = candidate.replace(/\//g, '\\').toLowerCase();
          const isShim = shimPattern.test(normalized);
          if (isShim && verboseDiscovery) {
            console.error(`[Python Discovery] Skipping Windows Store alias for ${cmd}: ${candidate}`);
          }
          return !isShim;
        });
      };

      const resolveAllCandidates = async (command: string): Promise<string[]> => {
        try {
          const result = await which(command, { all: true });
          const list = Array.isArray(result) ? result : [result];
          return filterWindowsStoreAliases(list);
        } catch (firstError) {
          if (isWindows && !command.endsWith('.exe')) {
            try {
              const exeResult = await which(`${command}.exe`, { all: true });
              const exeList = Array.isArray(exeResult) ? exeResult : [exeResult];
              return filterWindowsStoreAliases(exeList);
            } catch {
              throw firstError;
            }
          }
          throw firstError;
        }
      };

      const candidateSet = new Set<string>();
      const primaryCandidates = await resolveAllCandidates(cmd);
      primaryCandidates.forEach((candidate) => candidateSet.add(candidate));

      if (isWindows && !cmd.endsWith('.exe')) {
        try {
          const exeCandidates = await resolveAllCandidates(`${cmd}.exe`);
          exeCandidates.forEach((candidate) => candidateSet.add(candidate));
        } catch {
          // Ignore follow-up errors; the primary resolution already attempted logging
        }
      }

      const candidates = Array.from(candidateSet);
      const resolved = candidates[0];

      if (!resolved) {
        throw new CommandNotFoundError(cmd);
      }

      if (this.useCache) {
        this.cache.set(cmd, resolved);
      }
      return resolved;
    } catch (error) {
      if (verboseDiscovery) {
        const err = error as Error & {
          code?: string;
          errno?: number;
          syscall?: string;
          path?: string;
        };
        console.error(`[Python Discovery] which failed for ${cmd}:`, {
          message: err.message,
          code: err.code,
          errno: err.errno,
          syscall: err.syscall,
          path: err.path
        });

        // Test if we can spawn the command directly without 'which'
        if (process.platform === 'win32') {
          console.error(`[Python Discovery] Testing direct spawn of ${cmd}...`);
          const { spawn } = await import('child_process');
          const testResult = await new Promise<string>((resolve) => {
            const child = spawn(cmd, ['--version'], {
              stdio: 'pipe',
              shell: false,
              windowsHide: true
            });

            let output = '';
            let errorOutput = '';

            child.stdout?.on('data', (data) => { output += data.toString(); });
            child.stderr?.on('data', (data) => { errorOutput += data.toString(); });

            child.on('error', (spawnError) => {
              resolve(`spawn error: ${spawnError.message}`);
            });

            child.on('exit', (code) => {
              if (code === 0) {
                resolve(`SUCCESS: ${output.trim()}`);
              } else {
                resolve(`exit code ${code}: ${errorOutput || 'no output'}`);
              }
            });

            // Timeout after 2 seconds
            setTimeout(() => {
              child.kill();
              resolve('timeout after 2s');
            }, 2000);
          });

          console.error(`[Python Discovery] Direct spawn result: ${testResult}`);
        }
      }
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
 * Validate that a Python command is a real Python executable, not a Windows Store alias
 */
async function isValidPythonExecutable(pythonCmd: string, logger: Logger = noopLogger): Promise<boolean> {
  logger.debug?.(`[Python Detection] Validating Python executable: ${pythonCmd}`);
  return new Promise((resolve) => {
    const child = spawn(pythonCmd, ['-c', 'import sys; sys.exit(0)'], {
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let stderrData = '';
    child.stderr?.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('error', () => resolve(false));
    child.on('exit', (code) => {
      const storeAlias =
        code === 9009 ||
        stderrData.includes('Microsoft Store') ||
        stderrData.includes('Windows Store') ||
        stderrData.includes('AppData\\Local\\Microsoft\\WindowsApps');
      if (storeAlias) {
        logger.error(`[Python Detection] ${pythonCmd} appears to be a Windows Store alias, skipping...`);
        resolve(false);
      } else {
        resolve(code === 0);
      }
    });
  });
}

/**
 * Check if a Python executable has debugpy installed
 */
async function hasDebugpy(pythonPath: string, logger: Logger = noopLogger): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(pythonPath, ['-c', 'import debugpy; print(debugpy.__version__)'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    child.stdout?.on('data', (data) => { output += data.toString(); });
    
    child.on('error', () => resolve(false));
    child.on('exit', (code) => {
      const hasIt = code === 0 && output.trim().length > 0;
      if (hasIt) {
        logger.debug?.(`[Python Detection] debugpy version: ${output.trim()}`);
      }
      resolve(hasIt);
    });
  });
}

/**
 * Find a working Python executable
 * @param preferredPath Optional preferred Python path to check first
 * @param logger Optional logger instance for logging detection info
 * @param commandFinder Optional CommandFinder instance (defaults to WhichCommandFinder)
 */
export async function findPythonExecutable(
  preferredPath?: string,
  logger: Logger = noopLogger,
  commandFinder: CommandFinder = defaultCommandFinder
): Promise<string> {
  const isWindows = process.platform === 'win32';
  const triedPaths: string[] = [];
  const validPythonPaths: string[] = [];

  logger.debug?.(`[Python Detection] Starting discovery...`);

  const verboseDiscovery = process.env.DEBUG_PYTHON_DISCOVERY === 'true';

  // Optional verbose logging in CI (disabled unless explicitly requested)
  if (verboseDiscovery && isWindows) {
    const pathEntries = process.env.PATH?.split(';') || [];
    const pythonPaths = pathEntries.filter(p => p.toLowerCase().includes('python'));

    const debugInfo = {
      platform: process.platform,
      CI: process.env.CI,
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
      PATH_defined: !!process.env.PATH,
      Path_defined: !!process.env.Path,
      PATH_entries: pathEntries.length,
      PATH_with_python: pythonPaths.length,
      preferredPath: preferredPath || 'none',
      cwd: process.cwd(),
      nodeVersion: process.version
    };
    console.log('[PYTHON_DISCOVERY_DEBUG]', JSON.stringify(debugInfo));
    console.error('[PYTHON_DISCOVERY_DEBUG]', JSON.stringify(debugInfo));
    logger.error?.('[PYTHON_DISCOVERY_DEBUG] ' + JSON.stringify(debugInfo));

    // Show Python-related PATH entries
    if (pythonPaths.length > 0) {
      console.error('[PYTHON_DISCOVERY_DEBUG] Python PATH entries found:');
      pythonPaths.forEach(p => console.error(`  - ${p}`));
    }
  }

  // 1. User-specified path (if provided, prefer it regardless of debugpy)
  if (preferredPath) {
    try {
      const resolved = await commandFinder.find(preferredPath);
      triedPaths.push(`${preferredPath} → ${resolved}`);
      if (!isWindows || await isValidPythonExecutable(resolved, logger)) {
        logger.debug?.(`[Python Detection] Using user-specified Python: ${resolved}`);
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

  // 2. Environment variable (also prefer if set)
  const envPython = process.env.PYTHON_PATH || process.env.PYTHON_EXECUTABLE;
  if (envPython) {
    try {
      const resolved = await commandFinder.find(envPython);
      triedPaths.push(`${envPython} → ${resolved}`);
      if (!isWindows || await isValidPythonExecutable(resolved, logger)) {
        logger.debug?.(`[Python Detection] Using environment variable Python: ${resolved}`);
        return resolved;
      }
    } catch (error) {
      if (error instanceof CommandNotFoundError) {
        triedPaths.push(`${envPython} → not found`);
      } else {
        throw error;
      }
    }
  }

  // 2.5. GitHub Actions exposes pythonLocation (and sometimes PythonLocation) for setup-python
  const pythonLocation = process.env.pythonLocation || process.env.PythonLocation;
  if (pythonLocation) {
    const locationCandidates = isWindows
      ? [
          path.join(pythonLocation, 'python.exe'),
          path.join(pythonLocation, 'python'),
        ]
      : [
          path.join(pythonLocation, 'bin', 'python3'),
          path.join(pythonLocation, 'python3'),
          path.join(pythonLocation, 'bin', 'python'),
          path.join(pythonLocation, 'python'),
        ];

    for (const candidate of locationCandidates) {
      if (!candidate) continue;

      if (!fs.existsSync(candidate)) {
        triedPaths.push(`${candidate} → not found`);
        continue;
      }

      triedPaths.push(`${candidate} → exists`);
      if (!isWindows || (await isValidPythonExecutable(candidate, logger))) {
        logger.debug?.(`[Python Detection] Using pythonLocation Python: ${candidate}`);
        return candidate;
      }
    }
  }

  // 3. Auto-detect - collect all valid Python executables
  const pythonCommands = isWindows
    ? ['py', 'python', 'python3']
    : ['python3', 'python'];

  for (const cmd of pythonCommands) {
    logger.debug?.(`[Python Detection] Trying command: ${cmd}`);
    try {
      const resolved = await commandFinder.find(cmd);
      triedPaths.push(`${cmd} → ${resolved}`);
      if (!isWindows || await isValidPythonExecutable(resolved, logger)) {
        // Don't return immediately, collect all valid ones
        validPythonPaths.push(resolved);
        logger.debug?.(`[Python Detection] Found valid Python: ${resolved}`);
      }
    } catch (error) {
      if (error instanceof CommandNotFoundError) {
        triedPaths.push(`${cmd} → not found`);
      } else {
        throw error;
      }
    }
  }


  // 4. Check each valid Python for debugpy and return the first one that has it
  logger.debug?.(`[Python Detection] Checking ${validPythonPaths.length} Python installations for debugpy...`);
  for (const pythonPath of validPythonPaths) {
    if (await hasDebugpy(pythonPath, logger)) {
      logger.debug?.(`[Python Detection] Found Python with debugpy installed: ${pythonPath}`);
      return pythonPath;
    } else {
      logger.debug?.(`[Python Detection] Python at ${pythonPath} does not have debugpy`);
    }
  }

  // 5. Fall back to first valid Python if none have debugpy
  if (validPythonPaths.length > 0) {
    logger.debug?.(`[Python Detection] No Python with debugpy found, using first valid: ${validPythonPaths[0]}`);
    logger.debug?.(`[Python Detection] Note: debugpy will need to be installed`);
    return validPythonPaths[0];
  }

  // No Python found at all
  const triedList = triedPaths.map(p => `  - ${p}`).join('\n');

  // Log failure details (keep concise by default in CI)
  if (process.env.CI === 'true') {
    const failureInfo = {
      platform: process.platform,
      triedPaths: triedPaths,
      validPythonPaths: validPythonPaths,
      PATH: process.env.PATH ? 'defined' : 'undefined',
      Path: process.env.Path ? 'defined' : 'undefined'
    };
    logger.error?.('[PYTHON_DISCOVERY_FAILED]' + JSON.stringify(failureInfo));
    if (verboseDiscovery) {
      console.log('[PYTHON_DISCOVERY_FAILED]', JSON.stringify(failureInfo, null, 2));
      console.error('[PYTHON_DISCOVERY_FAILED]', JSON.stringify(failureInfo, null, 2));
    }
  }

  throw new Error(
    `Python not found.\nTried:\n${triedList}\n` +
    'Please install Python 3 or specify the Python path.'
  );
}

/**
 * Get Python version for a given executable
 */
export async function getPythonVersion(pythonPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(pythonPath, ['--version'], { stdio: 'pipe' });
    let output = '';

    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });

    child.on('error', () => resolve(null));
    child.on('exit', (code) => {
      if (code === 0 && output) {
        const match = output.match(/Python (\d+\.\d+\.\d+)/);
        resolve(match ? match[1] : output.trim());
      } else {
        resolve(null);
      }
    });
  });
}
