/**
 * Types for `materialize-docker-packages.mjs`, so its TypeScript tests see a real API.
 */

/** What one package's copy took: its name and the entries copied (package.json first). */
export interface MaterializedPackage {
  name: string;
  entries: string[];
}

/**
 * Copy `packages/<dir>` into `<destNodeModules>/<package name>`: package.json plus every
 * `files` entry. Throws on a missing non-documentation entry or a glob entry.
 */
export function materializePackage(repoRoot: string, destNodeModules: string, dir: string): MaterializedPackage;

/** materializePackage for each named package directory, in order. */
export function materializePackages(repoRoot: string, destNodeModules: string, dirs: string[]): MaterializedPackage[];
