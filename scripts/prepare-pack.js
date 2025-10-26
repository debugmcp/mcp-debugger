#!/usr/bin/env node
/**
 * Prepare package for packing by resolving workspace:* dependencies
 * This mimics what pnpm publish does automatically
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_DIR = path.resolve(__dirname, '../packages/mcp-debugger');
const PACKAGE_JSON = path.join(PACKAGE_DIR, 'package.json');
const BACKUP_JSON = path.join(PACKAGE_DIR, 'package.json.backup');

// Read workspace package versions
function getWorkspaceVersions() {
  const versions = {};
  const packagesDir = path.resolve(__dirname, '../packages');
  
  // Read each workspace package
  const workspaces = ['shared', 'adapter-javascript', 'adapter-python', 'adapter-mock'];
  
  for (const ws of workspaces) {
    const pkgPath = path.join(packagesDir, ws, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      versions[pkg.name] = pkg.version;
    }
  }
  
  return versions;
}

// Resolve workspace:* dependencies to concrete versions
function resolveWorkspaceDeps(pkg, versions) {
  const resolved = { ...pkg };
  
  // Helper to resolve a dependency object
  const resolveDeps = (deps) => {
    if (!deps) return deps;
    
    const result = {};
    for (const [name, version] of Object.entries(deps)) {
      if (version.startsWith('workspace:')) {
        // workspace:* or workspace:~ -> use exact version
        const concreteVersion = versions[name];
        if (!concreteVersion) {
          throw new Error(`Cannot resolve workspace dependency ${name}`);
        }
        result[name] = concreteVersion;
        console.log(`  ${name}: ${version} -> ${concreteVersion}`);
      } else {
        result[name] = version;
      }
    }
    return result;
  };
  
  console.log('Resolving workspace dependencies:');
  
  if (resolved.dependencies) {
    resolved.dependencies = resolveDeps(resolved.dependencies);
  }
  
  if (resolved.devDependencies) {
    resolved.devDependencies = resolveDeps(resolved.devDependencies);
  }
  
  if (resolved.peerDependencies) {
    resolved.peerDependencies = resolveDeps(resolved.peerDependencies);
  }
  
  return resolved;
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'prepare') {
    console.log('Preparing package.json for packing...\n');
    
    // Read original package.json
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    
    // Backup original
    fs.writeFileSync(BACKUP_JSON, JSON.stringify(pkg, null, 2));
    console.log('✓ Backed up original package.json\n');
    
    // Get workspace versions
    const versions = getWorkspaceVersions();
    console.log('Found workspace versions:');
    for (const [name, version] of Object.entries(versions)) {
      console.log(`  ${name}@${version}`);
    }
    console.log();
    
    // Resolve workspace dependencies
    const resolved = resolveWorkspaceDeps(pkg, versions);
    
    // Write resolved package.json
    fs.writeFileSync(PACKAGE_JSON, JSON.stringify(resolved, null, 2) + '\n');
    console.log('\n✓ Updated package.json with resolved versions');
    
  } else if (command === 'restore') {
    console.log('Restoring original package.json...');
    
    if (fs.existsSync(BACKUP_JSON)) {
      fs.copyFileSync(BACKUP_JSON, PACKAGE_JSON);
      fs.unlinkSync(BACKUP_JSON);
      console.log('✓ Restored original package.json');
    } else {
      console.log('⚠ No backup found');
    }
    
  } else {
    console.error('Usage: node scripts/prepare-pack.js [prepare|restore]');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
