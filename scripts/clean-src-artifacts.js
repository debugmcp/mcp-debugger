#!/usr/bin/env node

/**
 * Clean up stray compiled artifacts from src directory
 * Preserves proxy-bootstrap.js which is intentionally a JS file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

let removedCount = 0;
let skippedCount = 0;

function cleanDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      cleanDirectory(fullPath);
    } else if (stat.isFile()) {
      const relativePath = path.relative(srcDir, fullPath).replace(/\\/g, '/');
      
      // Skip proxy-bootstrap.js
      if (relativePath === 'proxy/proxy-bootstrap.js') {
        console.log(`  Preserving: ${relativePath}`);
        skippedCount++;
        continue;
      }
      
      // Remove compiled artifacts
      if (item.endsWith('.js') || item.endsWith('.js.map') || item.endsWith('.d.ts')) {
        console.log(`  Removing: ${relativePath}`);
        fs.unlinkSync(fullPath);
        removedCount++;
      }
    }
  }
}

console.log('Cleaning compiled artifacts from src directory...');
console.log('(Preserving proxy-bootstrap.js)');
console.log('');

try {
  cleanDirectory(srcDir);
  console.log('');
  console.log(`✓ Cleaned ${removedCount} file(s)`);
  if (skippedCount > 0) {
    console.log(`✓ Preserved ${skippedCount} intentional JS file(s)`);
  }
} catch (error) {
  console.error('Error cleaning src directory:', error);
  process.exit(1);
}
