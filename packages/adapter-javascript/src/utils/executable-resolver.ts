/**
 * Node.js executable resolver
 * Cross-platform, deterministic, no-spawn utility.
 *
 * Exports:
 *  - findNode(preferredPath?, fileSystem?): Promise<string>
 *  - whichInPath(names, fileSystem?): string | undefined
 *  - isWindows(): boolean
 *
 * Behavior:
 *  - Precedence: preferredPath (if exists) -> process.execPath (if exists) -> PATH search -> fallback to process.execPath.
 *  - PATH iteration is dir-first (respect PATH order), then candidate name order.
 *  - Windows candidates: ['node.exe', 'node']
 *  - POSIX candidates: ['node']
 *  - Always returns an absolute path.
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

export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Searches the PATH for the first existing binary among the provided names.
 * - Respects PATH ordering by iterating directories first, then candidate names.
 * - Returns the absolute path of the first match, or undefined if none found.
 */
export function whichInPath(names: string[], fileSystem: FileSystem = defaultFileSystem): string | undefined {
  const envPath = process.env.PATH || '';
  if (!envPath) return undefined;

  const dirs = envPath.split(path.delimiter).filter(Boolean);

  // PATH precedence: directory-first, then candidate name order
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (fileSystem.existsSync(candidate)) {
          return path.resolve(candidate);
        }
      } catch {
        // ignore fs errors to keep behavior hermetic in tests
      }
    }
  }

  return undefined;
}

/**
 * Finds a Node.js executable path according to the following precedence:
 * 1) preferredPath (if provided and exists)
 * 2) process.execPath (if exists)
 * 3) First match on PATH (Windows: node.exe, node; POSIX: node)
 * 4) Deterministic fallback to process.execPath if nothing else was verified
 *
 * Always returns an absolute path.
 */
export async function findNode(
  preferredPath?: string,
  fileSystem: FileSystem = defaultFileSystem
): Promise<string> {
  const toAbs = (p: string) => path.resolve(p);

  // 1) Preferred path override (bypasses/overwrites adapter cache)
  if (preferredPath) {
    try {
      if (fileSystem.existsSync(preferredPath)) {
        return toAbs(preferredPath);
      }
    } catch {
      // ignore fs errors
    }
  }

  // 2) Current process.execPath
  try {
    if (fileSystem.existsSync(process.execPath)) {
      return toAbs(process.execPath);
    }
  } catch {
    // ignore
  }

  // 3) PATH fallback
  const candidates = isWindows() ? ['node.exe', 'node'] : ['node'];
  const found = whichInPath(candidates, fileSystem);
  if (found) {
    return toAbs(found);
  }

  // 4) Deterministic fallback even if execPath wasn't verified
  return toAbs(process.execPath);
}

export async function resolveNodeExecutable(preferredPath?: string): Promise<string> {
  return findNode(preferredPath);
}
