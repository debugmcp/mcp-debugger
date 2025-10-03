/**
 * TypeScript runner detector for tsx and ts-node
 * - Local-first: <cwd>/node_modules/.bin/<name>[.cmd|.exe]
 * - PATH fallback: whichInPath with Windows suffix preference (.cmd -> .exe -> bare)
 * - Returns absolute paths, or undefined when not found
 * - Caches results module-wide; export clearCache() for tests
 *
 * @since 0.1.0
 */
import * as fs from 'fs';
import * as path from 'path';
import { whichInPath, isWindows } from './executable-resolver.js';

export type TsRunnerDetection = { tsx?: string; tsNode?: string };

let cached: TsRunnerDetection | null = null;

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
 */
export function detectBinary(name: 'tsx' | 'ts-node', cwd: string): string | undefined {
  const candidates = isWindows() ? [`${name}.cmd`, `${name}.exe`, `${name}`] : [name];

  // Local-first: <cwd>/node_modules/.bin/<candidate>
  const localBinDir = path.join(cwd, 'node_modules', '.bin');
  for (const n of candidates) {
    const localPath = path.join(localBinDir, n);
    try {
      if (fs.existsSync(localPath)) {
        return toAbs(localPath);
      }
    } catch {
      // ignore fs errors
    }
  }

  // PATH fallback
  const found = whichInPath(candidates);
  if (found) {
    return toAbs(found);
  }

  return undefined;
}

/**
 * Detects tsx and ts-node runners with process-level caching.
 * No throw; returns undefineds when not found.
 */
export async function detectTsRunners(cwd: string = process.cwd()): Promise<TsRunnerDetection> {
  if (cached) {
    return cached;
  }

  const tsx = detectBinary('tsx', cwd);
  const tsNode = detectBinary('ts-node', cwd);

  cached = { tsx, tsNode };
  return cached;
}
