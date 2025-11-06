#!/usr/bin/env node
/**
 * Check bundle size to ensure it stays reasonable
 * Warns if the npm package exceeds size thresholds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Size thresholds in MB
const WARN_SIZE_MB = 8;
const ERROR_SIZE_MB = 15;

async function checkBundleSize() {
  const packageDir = path.join(ROOT, 'packages', 'mcp-debugger');
  const distDir = path.join(packageDir, 'dist');
  
  // Check if dist exists
  if (!fs.existsSync(distDir)) {
    console.log('⚠️  No dist directory found. Run `pnpm build` first.');
    process.exit(0);
  }
  
  // Get cli.mjs size (the main bundle)
  const cliPath = path.join(distDir, 'cli.mjs');
  if (!fs.existsSync(cliPath)) {
    console.log('⚠️  No cli.mjs found. Bundle may not have been created.');
    process.exit(0);
  }
  
  const stats = fs.statSync(cliPath);
  const sizeKB = stats.size / 1024;
  const sizeMB = sizeKB / 1024;
  
  console.log('📦 Bundle Size Check');
  console.log('===================');
  console.log(`Bundle: ${cliPath}`);
  console.log(`Size: ${sizeMB.toFixed(2)} MB (${sizeKB.toFixed(2)} KB)`);
  console.log('');
  
  if (sizeMB > ERROR_SIZE_MB) {
    console.log(`❌ ERROR: Bundle exceeds ${ERROR_SIZE_MB} MB!`);
    console.log('This is too large for the "batteries included" approach.');
    console.log('Consider:');
    console.log('  - Splitting into separate packages');
    console.log('  - Moving to dynamic loading');
    console.log('  - Removing unnecessary dependencies');
    process.exit(1);
  } else if (sizeMB > WARN_SIZE_MB) {
    console.log(`⚠️  WARNING: Bundle exceeds ${WARN_SIZE_MB} MB`);
    console.log('Still acceptable, but getting large.');
    console.log('Monitor future additions carefully.');
    console.log('');
  } else {
    console.log(`✅ Bundle size is good (< ${WARN_SIZE_MB} MB)`);
    console.log('');
  }
  
  // Show what's in the bundle (if metafile exists)
  const metaPath = path.join(distDir, 'bundle-meta.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const inputs = Object.keys(meta.inputs || {});
    
    console.log('📄 Bundle Contents:');
    console.log(`  Total inputs: ${inputs.length} files`);
    
    // Check for adapter presence
    const hasJS = inputs.some(f => f.includes('adapter-javascript'));
    const hasPython = inputs.some(f => f.includes('adapter-python'));
    const hasMock = inputs.some(f => f.includes('adapter-mock'));
    
    console.log('  Adapters included:');
    console.log(`    ${hasJS ? '✅' : '❌'} JavaScript`);
    console.log(`    ${hasPython ? '✅' : '❌'} Python`);
    console.log(`    ${hasMock ? '✅' : '❌'} Mock`);
    
    if (!hasJS) {
      console.log('');
      console.log('⚠️  WARNING: JavaScript adapter not found in bundle!');
      console.log('This will break npx distribution.');
    }
  }
  
  console.log('');
  console.log('Thresholds:');
  console.log(`  Warning: ${WARN_SIZE_MB} MB`);
  console.log(`  Error: ${ERROR_SIZE_MB} MB`);
}

checkBundleSize().catch(error => {
  console.error('Error checking bundle size:', error);
  process.exit(1);
});
