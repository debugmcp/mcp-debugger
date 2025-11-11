#!/usr/bin/env node

/**
 * Clean TypeScript/JavaScript build artifacts from package source directories
 * 
 * This prevents stale build artifacts in src/ from interfering with TypeScript
 * module resolution, which can cause confusing build errors.
 * 
 * Exceptions:
 * - proxy-bootstrap.js is a legitimate JavaScript source file
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning build artifacts from package source directories...');

// Legitimate JavaScript source files that should NOT be deleted
const exceptions = [
  'proxy-bootstrap.js'
];

function shouldDelete(filename) {
  return !exceptions.includes(path.basename(filename));
}

function cleanDirectory(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  
  let deletedCount = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      deletedCount += cleanDirectory(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.js', '.d.ts', '.map'].includes(ext) || entry.name.endsWith('.d.ts')) {
        if (shouldDelete(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            deletedCount++;
          } catch (err) {
            console.warn(`Warning: Could not delete ${fullPath}:`, err.message);
          }
        }
      }
    }
  }
  
  return deletedCount;
}

try {
  const packagesDir = path.join(__dirname, '..', 'packages');
  
  if (!fs.existsSync(packagesDir)) {
    console.log('✅ No packages directory found, nothing to clean');
    process.exit(0);
  }
  
  let totalDeleted = 0;
  const packages = fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  
  for (const pkg of packages) {
    const srcDir = path.join(packagesDir, pkg, 'src');
    const deleted = cleanDirectory(srcDir);
    if (deleted > 0) {
      console.log(`   Cleaned ${deleted} artifact(s) from ${pkg}/src`);
      totalDeleted += deleted;
    }
  }
  
  if (totalDeleted > 0) {
    console.log(`✅ Cleaned ${totalDeleted} build artifact(s) from source directories`);
  } else {
    console.log('✅ No build artifacts found in source directories');
  }
} catch (error) {
  console.error('❌ Error cleaning source directories:', error.message);
  process.exit(1);
}
