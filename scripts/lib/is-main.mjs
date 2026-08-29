/**
 * Entry-point detection for this repo's CLI scripts (issue #562).
 *
 * The idiom these scripts used — `import.meta.url === pathToFileURL(process.argv[1]).href` —
 * silently fails whenever the repo is reached through a symlink or a Windows directory
 * junction: Node reports `import.meta.url` with symlinks already resolved but leaves
 * `process.argv[1]` exactly as it was typed, so the two never match, `main()` never runs, and
 * the script exits 0 as though it had passed. For a gate like the test-typing ratchet that
 * turns the whole check into a silent no-op.
 *
 * Resolving both sides through `fs.realpathSync` before comparing fixes it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/** Resolve symlinks/junctions; fall back to a plain resolve for a path that does not exist. */
function realpath(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

/**
 * Pure core of {@link isMain}: do these two paths name the same file once symlinks resolve?
 *
 * @param {string} moduleUrl the module's `import.meta.url`
 * @param {string | undefined} entry the process entry point, i.e. `process.argv[1]`
 * @param {(target: string) => string} resolve symlink resolver, injected so tests need no junction
 * @returns {boolean}
 */
export function isSameEntry(moduleUrl, entry, resolve) {
  if (!entry) return false;
  return resolve(fileURLToPath(moduleUrl)) === resolve(entry);
}

/**
 * Was this module the one Node was started with?
 *
 * @param {string} moduleUrl the caller's `import.meta.url`
 * @param {string} [entry] entry point to compare against; defaults to `process.argv[1]`
 * @returns {boolean}
 */
export function isMain(moduleUrl, entry = process.argv[1]) {
  return isSameEntry(moduleUrl, entry, realpath);
}
