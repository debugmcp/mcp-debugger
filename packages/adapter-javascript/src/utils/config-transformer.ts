/**
 * Launch configuration transformation helpers for JavaScript/TypeScript.
 *
 * Synchronous, no-throw helpers designed for cheap fs checks.
 * Keep .js suffix for all local imports across the codebase.
 *
 * @since 0.1.0
 */
import * as path from 'path';
import { FileSystem, NodeFileSystem } from '@debugmcp/shared';

// Default filesystem instance for production use
let defaultFileSystem: FileSystem = new NodeFileSystem();

/**
 * Set the default filesystem implementation (useful for testing)
 * @param fileSystem The FileSystem to use as default
 */
export function setDefaultFileSystem(fileSystem: FileSystem): void {
  defaultFileSystem = fileSystem;
}

/**
 * Determine outFiles to use for js-debug.
 * - If userOutFiles provided and non-empty, return it as-is.
 * - Else default to the common JS pattern including all .js files and excluding node_modules.
 */
export function determineOutFiles(_programPath: string, userOutFiles?: string[]): string[] {
  if (Array.isArray(userOutFiles) && userOutFiles.length > 0) {
    return userOutFiles;
  }
  return ['**/*.js', '!**/node_modules/**'];
}

/**
 * Safe JSON parse helper.
 */
function safeJsonParse<T = unknown>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

type PkgJson = { type?: string };
type TsConfig = { compilerOptions?: { module?: string; paths?: Record<string, string[] | string> } };

/**
 * Detect whether a project should be treated as ESM.
 * Heuristics:
 * - .mjs or .mts extension -> true
 * - package.json with "type": "module" in program dir or cwd -> true
 * - tsconfig.json with compilerOptions.module in ['ESNext', 'NodeNext'] in program dir or cwd -> true (heuristic)
 */
export function isESMProject(
  programPath: string,
  cwd?: string,
  fileSystem: FileSystem = defaultFileSystem
): boolean {
  try {
    const programExt = path.extname(programPath || '');
    const extLower = programExt.toLowerCase();

    if (extLower === '.mjs' || extLower === '.mts') {
      return true;
    }

    const programDir = programPath ? path.dirname(path.resolve(programPath)) : undefined;
    const dirsToCheck: string[] = [];
    if (programDir) dirsToCheck.push(programDir);
    if (cwd) dirsToCheck.push(path.resolve(cwd));

    // package.json "type": "module"
    for (const dir of dirsToCheck) {
      const pj = path.join(dir, 'package.json');
      try {
        if (fileSystem.existsSync(pj)) {
          const raw = fileSystem.readFileSync(pj, 'utf8');
          const pkg = safeJsonParse<PkgJson>(raw);
          if (pkg && typeof pkg.type === 'string' && pkg.type === 'module') {
            return true;
          }
        }
      } catch {
        // ignore fs errors
      }
    }

    // tsconfig.json module ESNext/NodeNext (heuristic)
    for (const dir of dirsToCheck) {
      const tc = path.join(dir, 'tsconfig.json');
      try {
        if (fileSystem.existsSync(tc)) {
          const raw = fileSystem.readFileSync(tc, 'utf8');
          const ts = safeJsonParse<TsConfig>(raw);
          const mod = ts?.compilerOptions?.module;
          if (typeof mod === 'string') {
            const m = mod.toLowerCase();
            if (m === 'esnext' || m === 'nodenext') {
              return true;
            }
          }
        }
      } catch {
        // ignore fs errors
      }
    }
  } catch {
    // no-throw policy
  }
  return false;
}

/**
 * Detect whether tsconfig has non-empty compilerOptions.paths.
 * - Looks for tsconfig.json in the provided directory.
 */
export function hasTsConfigPaths(
  cwdOrProgramDir: string,
  fileSystem: FileSystem = defaultFileSystem
): boolean {
  try {
    const dir = path.resolve(cwdOrProgramDir || process.cwd());
    const tc = path.join(dir, 'tsconfig.json');
    try {
      if (fileSystem.existsSync(tc)) {
        const raw = fileSystem.readFileSync(tc, 'utf8');
        const ts = safeJsonParse<TsConfig>(raw);
        const paths = ts?.compilerOptions?.paths;
        if (paths && typeof paths === 'object') {
          // Non-empty object check
          return Object.keys(paths).length > 0;
        }
      }
    } catch {
      // ignore fs errors
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Back-compat placeholder: returns config unchanged.
 * Kept to satisfy existing exports until consumers migrate to specific helpers.
 */
export function transformConfig(config: Record<string, unknown>): Record<string, unknown> {
  return { ...config };
}
