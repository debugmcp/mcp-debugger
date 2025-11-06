/**
 * TypeScript runner detector for tsx and ts-node
 * - Local-first: <cwd>/node_modules/.bin/<name>[.cmd|.exe]
 * - PATH fallback: whichInPath with Windows suffix preference (.cmd -> .exe -> bare)
 * - Returns absolute paths, or undefined when not found
 * - Caches results module-wide; export clearCache() for tests
 *
 * @since 0.1.0
 */
import * as path from 'path';
import { FileSystem, NodeFileSystem } from '@debugmcp/shared';
import { whichInPath, isWindows } from './executable-resolver.js';

export type TsRunnerDetection = { tsx?: string; tsNode?: string };

let cached: TsRunnerDetection | null = null;

// Default filesystem instance for production use
let defaultFileSystem: FileSystem = new NodeFileSystem();

/**
 * Set the default filesystem implementation (useful for testing)
 * @param fileSystem The FileSystem to use as default
 */
export function setDefaultFileSystem(fileSystem: FileSystem): void {
  defaultFileSystem = fileSystem;
}

export function clearCache(): void {
  cached = null;
}

function toAbs(p: string): string {
  return path.resolve(p);
}

/**
 * Detects a single TS runner binary.
 * - name: 'tsx' or 'ts-node'
 * - cwd: directory to check for local node_modules/.bin first
 * - fileSystem: optional filesystem implementation for testing
 */
export function detectBinary(
  name: 'tsx' | 'ts-node',
  cwd: string,
  fileSystem: FileSystem = defaultFileSystem
): string | undefined {
  const candidates = isWindows() ? [`${name}.cmd`, `${name}.exe`, `${name}`] : [name];

  // Local-first: <cwd>/node_modules/.bin/<candidate>
  const localBinDir = path.join(cwd, 'node_modules', '.bin');
  for (const n of candidates) {
    const localPath = path.join(localBinDir, n);
    try {
      if (fileSystem.existsSync(localPath)) {
        return toAbs(localPath);
      }
    } catch {
      // ignore fs errors
    }
  }

  // PATH fallback
  const found = whichInPath(candidates, fileSystem);
  if (found) {
    return toAbs(found);
  }

  return undefined;
}

/**
 * Detects tsx and ts-node runners with process-level caching.
 * No throw; returns undefineds when not found.
 */
export async function detectTsRunners(
  cwd: string = process.cwd(),
  fileSystem: FileSystem = defaultFileSystem
): Promise<TsRunnerDetection> {
  if (cached) {
    return cached;
  }

  const tsx = detectBinary('tsx', cwd, fileSystem);
  const tsNode = detectBinary('ts-node', cwd, fileSystem);

  cached = { tsx, tsNode };
  return cached;
}
