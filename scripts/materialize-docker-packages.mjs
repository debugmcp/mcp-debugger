#!/usr/bin/env node
/**
 * Re-materialise workspace packages inside the Docker image (issue #811).
 *
 * pnpm links `@debugmcp/*` into node_modules with symlinks, which do not
 * survive a COPY between stages, so the builder copies each package's files
 * in for real. It used to copy a hand-listed set of subdirectories per
 * package, which is how the JavaScript adapter's exit-code shim was missing
 * from the image for the shim's whole life (#796). Now the package's own
 * package.json `files` field, the list npm publishes, decides what goes in.
 *
 * - package.json always goes; every `files` entry that exists is copied.
 * - A README or LICENSE the package names but does not have is skipped
 *   (npm skips them too, and nothing reads them at runtime); any other
 *   missing entry fails the build, so a renamed directory cannot silently
 *   ship an adapter without its runtime assets.
 * - Symlinks are copied as links, verbatim: the CodeLLDB vendor tree's
 *   relative `current` link must stay relative, or it would point into the
 *   builder's /app/packages tree, which the runtime stage does not have.
 * - Glob entries are refused; none of the packages uses one today.
 *
 * Which packages go into the image stays the Dockerfile's decision; what a
 * package consists of is the package's. Runtime dependencies (node_modules)
 * are not a `files` concern and stay the Dockerfile's too.
 *
 * Usage: node scripts/materialize-docker-packages.mjs <repoRoot> <destNodeModules> <package-dir>...
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OPTIONAL_DOCS = new Set(['README.md', 'LICENSE']);

function exists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy one workspace package (`packages/<dir>`) into
 * `<destNodeModules>/<package name>`. Returns the entries copied.
 */
export function materializePackage(repoRoot, destNodeModules, dir) {
  const source = path.join(repoRoot, 'packages', dir);
  const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
  const target = path.join(destNodeModules, ...pkg.name.split('/'));
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(path.join(source, 'package.json'), path.join(target, 'package.json'));

  const entries = ['package.json'];
  for (const entry of pkg.files ?? []) {
    if (/[*?[\]{}!]/.test(entry)) {
      throw new Error(`${pkg.name}: files entry "${entry}" is a glob, which this copy does not expand`);
    }
    const from = path.join(source, entry);
    if (!exists(from)) {
      if (OPTIONAL_DOCS.has(entry)) {
        continue;
      }
      throw new Error(`${pkg.name}: files entry "${entry}" does not exist at ${from} (was the package built?)`);
    }
    const to = path.join(target, entry);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
    entries.push(entry);
  }
  return { name: pkg.name, entries };
}

export function materializePackages(repoRoot, destNodeModules, dirs) {
  return dirs.map((dir) => materializePackage(repoRoot, destNodeModules, dir));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [repoRoot, destNodeModules, ...dirs] = process.argv.slice(2);
  if (!repoRoot || !destNodeModules || dirs.length === 0) {
    console.error('Usage: node scripts/materialize-docker-packages.mjs <repoRoot> <destNodeModules> <package-dir>...');
    process.exit(2);
  }
  try {
    for (const { name, entries } of materializePackages(repoRoot, destNodeModules, dirs)) {
      console.log(`${name}: ${entries.join(', ')}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
