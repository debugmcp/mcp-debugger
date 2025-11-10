#!/usr/bin/env node
/**
 * Version synchronization script for monorepo packages
 * Dynamically discovers and syncs all workspace packages
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function discoverWorkspacePackages() {
  const workspacePath = path.join(__dirname, '..', 'pnpm-workspace.yaml');

  try {
    // Read pnpm workspace configuration
    const workspaceContent = fs.readFileSync(workspacePath, 'utf8');

    // Simple YAML parsing for pnpm-workspace.yaml
    // Extract patterns from lines like "  - 'packages/*'"
    const patterns = [];
    const lines = workspaceContent.split('\n');
    let inPackages = false;

    for (const line of lines) {
      if (line.trim() === 'packages:') {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        // Check for list item
        const match = line.match(/^\s*-\s*['"]?([^'"]+)['"]?/);
        if (match) {
          patterns.push(match[1]);
        } else if (line.trim() && !line.startsWith(' ')) {
          // End of packages section
          break;
        }
      }
    }

    // Collect all package paths from workspace patterns
    const allPackages = [];

    for (const pattern of patterns) {
      // Convert workspace pattern to glob pattern
      const globPattern = path.join(__dirname, '..', pattern, 'package.json').replace(/\\/g, '/');
      const matches = await glob(globPattern);

      // Extract directory paths from matched package.json files
      matches.forEach(match => {
        const pkgDir = path.dirname(match);
        const relativePath = path.relative(path.join(__dirname, '..'), pkgDir);
        allPackages.push(relativePath);
      });
    }

    return allPackages;
  } catch (err) {
    console.error(`❌ Error reading workspace configuration: ${err.message}`);
    process.exit(1);
  }
}

async function syncVersions() {
  // Target version - could be passed as argument or read from main package.json
  const targetVersion = process.argv[2] || require('../package.json').version;

  console.log(`📦 Syncing all packages to version: ${targetVersion}`);
  console.log();

  // Dynamically discover all workspace packages
  const packages = await discoverWorkspacePackages();

  console.log(`🔍 Discovered ${packages.length} workspace package(s):`);
  packages.forEach(pkg => console.log(`   - ${pkg}`));
  console.log();

  // Also include root package.json
  packages.unshift('.');

  let updatedCount = 0;
  const versionChanges = [];
  const ourPackages = new Set();

  // First pass: collect all our package names
  for (const pkgPath of packages) {
    const packageJsonPath = path.join(__dirname, '..', pkgPath, 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.name) {
        ourPackages.add(pkg.name);
      }
    } catch (err) {
      // Ignore errors in first pass
    }
  }

  // Second pass: update versions
  for (const pkgPath of packages) {
    const packageJsonPath = path.join(__dirname, '..', pkgPath, 'package.json');

    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const oldVersion = pkg.version;
      const packageName = path.basename(pkgPath) || 'root';

      let changed = false;

      if (oldVersion !== targetVersion) {
        pkg.version = targetVersion;
        changed = true;
      }

      // Update dependencies to workspace packages
      ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach(depType => {
        if (pkg[depType]) {
          Object.keys(pkg[depType]).forEach(dep => {
            // Update version for any package that's part of our workspace
            if (!ourPackages.has(dep)) {
              return;
            }

            const currentSpec = pkg[depType][dep];

            if (typeof currentSpec === 'string' && currentSpec.startsWith('workspace:')) {
              // Normalise workspace protocol without forcing a publishable version
              const normalized = currentSpec === 'workspace:*' ? currentSpec : 'workspace:*';
              if (pkg[depType][dep] !== normalized) {
                pkg[depType][dep] = normalized;
                changed = true;
              }
              return;
            }

            if (pkg[depType][dep] !== targetVersion) {
              pkg[depType][dep] = targetVersion;
              changed = true;
            }
          });
        }
      });

      if (changed) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
        versionChanges.push(`  ✅ ${packageName}: ${oldVersion} → ${targetVersion}`);
        updatedCount++;
      } else {
        versionChanges.push(`  ⏩ ${packageName}: already at ${targetVersion}`);
      }
    } catch (err) {
      console.error(`  ❌ Error updating ${pkgPath}: ${err.message}`);
    }
  }

  console.log('📋 Version changes:');
  versionChanges.forEach(change => console.log(change));

  if (updatedCount > 0) {
    console.log(`\n✨ Updated ${updatedCount} package(s) to version ${targetVersion}`);
    console.log('\n⚠️  Remember to:');
    console.log('  1. Run "pnpm install" to update lockfile');
    console.log('  2. Run tests to ensure everything works');
    console.log('  3. Update CHANGELOG.md with version notes');
    console.log('  4. Commit changes with message like: "chore: sync package versions to ' + targetVersion + '"');
  } else {
    console.log('\n✅ All packages already at version ' + targetVersion);
  }
}

// Check if glob is available (should be in devDependencies)
try {
  require('glob');
} catch (err) {
  console.error('❌ Missing required dependency: glob');
  console.error('   Please run: npm install --save-dev glob');
  process.exit(1);
}

// Run the sync
syncVersions().catch(err => {
  console.error(`❌ Fatal error: ${err.message}`);
  process.exit(1);
});
