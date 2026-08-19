#!/usr/bin/env node
/**
 * Resolve `workspace:*` protocol dependencies to concrete pinned versions
 * before `npm publish`.
 *
 * npm (unlike pnpm) does NOT rewrite the workspace: protocol at publish time,
 * so a tarball published straight from the pnpm workspace carries a literal
 * "workspace:*" dependency that npm cannot install (EUNSUPPORTEDPROTOCOL).
 * The release workflow runs this script in the runner checkout right before
 * publishing; the rewrite is never committed.
 *
 * Usage: node scripts/resolve-workspace-deps.cjs
 */
const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '..', 'packages');
const pkgJsonPaths = fs
  .readdirSync(packagesDir)
  .map((dir) => path.join(packagesDir, dir, 'package.json'))
  .filter((p) => fs.existsSync(p));

// name -> version map for every workspace package
const versions = {};
for (const p of pkgJsonPaths) {
  const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
  versions[pkg.name] = pkg.version;
}

let rewrites = 0;
for (const p of pkgJsonPaths) {
  const raw = fs.readFileSync(p, 'utf8');
  const pkg = JSON.parse(raw);
  let changed = false;
  // devDependencies never ship in the published manifest; leave them alone.
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        const resolved = versions[name];
        if (!resolved) {
          console.error(`ERROR: ${p}: ${field}.${name} is "${range}" but ${name} is not a workspace package`);
          process.exit(1);
        }
        deps[name] = resolved;
        changed = true;
        rewrites++;
        console.log(`${pkg.name}: ${field}.${name} workspace:* -> ${resolved}`);
      }
    }
  }
  if (changed) {
    fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
  }
}
console.log(`Resolved ${rewrites} workspace dependency range(s) across ${pkgJsonPaths.length} packages.`);
