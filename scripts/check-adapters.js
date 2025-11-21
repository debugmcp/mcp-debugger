#!/usr/bin/env node

/**
 * Check which adapters are vendored and ready
 * Provides a unified status report for all debug adapters
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Define adapter configurations
const adapters = [
  {
    name: 'JavaScript (js-debug)',
    package: 'packages/adapter-javascript',
    vendorPath: 'vendor/js-debug/vsDebugServer.js',
    versionFile: 'vendor/js-debug/manifest.json',
    required: ['vendor/js-debug/bootloader.js', 'vendor/js-debug/hash.js']
  },
  {
    name: 'Rust (CodeLLDB)',
    package: 'packages/adapter-rust',
    vendorPath: 'vendor/codelldb',
    versionFile: null, // Check multiple platform version files
    platforms: ['win32-x64', 'darwin-x64', 'darwin-arm64', 'linux-x64', 'linux-arm64']
  }
];

/**
 * Get current platform identifier
 */
function getCurrentPlatform() {
  const platform = process.platform;
  const arch = process.arch;
  
  if (platform === 'win32' && arch === 'x64') return 'win32-x64';
  if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64';
  
  return `${platform}-${arch}`;
}

/**
 * Check if a file or directory exists
 */
function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read JSON file safely
 */
function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Check JavaScript adapter status
 */
function checkJavaScriptAdapter(adapter) {
  const adapterPath = path.join(rootDir, adapter.package);
  const vendorFile = path.join(adapterPath, adapter.vendorPath);
  const manifestFile = path.join(adapterPath, adapter.versionFile);
  
  const status = {
    name: adapter.name,
    vendored: false,
    version: null,
    sidecars: {},
    issues: []
  };
  
  // Check main vendor file
  if (exists(vendorFile)) {
    status.vendored = true;
    
    // Check version from manifest
    const manifest = readJsonSafe(manifestFile);
    if (manifest) {
      status.version = manifest.version || 'unknown';
      status.source = manifest.source || 'unknown';
    }
    
    // Check required sidecars
    if (adapter.required) {
      for (const sidecar of adapter.required) {
        const sidecarPath = path.join(adapterPath, sidecar);
        const sidecarName = path.basename(sidecar);
        status.sidecars[sidecarName] = exists(sidecarPath);
        if (!status.sidecars[sidecarName]) {
          status.issues.push(`Missing required sidecar: ${sidecarName}`);
        }
      }
    }
  } else {
    status.issues.push('Not vendored - run: pnpm vendor');
  }
  
  return status;
}

/**
 * Check Rust adapter status
 */
function checkRustAdapter(adapter) {
  const adapterPath = path.join(rootDir, adapter.package);
  const vendorDir = path.join(adapterPath, adapter.vendorPath);
  const currentPlatform = getCurrentPlatform();
  
  const status = {
    name: adapter.name,
    vendored: false,
    currentPlatform,
    platforms: {},
    issues: []
  };
  
  // Check each platform
  for (const platform of adapter.platforms) {
    const platformDir = path.join(vendorDir, platform);
    const versionFile = path.join(platformDir, 'version.json');
    const adapterBinary = path.join(platformDir, 'adapter', 
      platform.startsWith('win') ? 'codelldb.exe' : 'codelldb');
    
    if (exists(platformDir) && exists(adapterBinary)) {
      const versionData = readJsonSafe(versionFile);
      status.platforms[platform] = {
        vendored: true,
        version: versionData?.version || 'unknown',
        current: platform === currentPlatform
      };
      
      if (platform === currentPlatform) {
        status.vendored = true;
        status.version = versionData?.version || 'unknown';
      }
    } else {
      status.platforms[platform] = {
        vendored: false,
        current: platform === currentPlatform
      };
    }
  }
  
  if (!status.vendored) {
    status.issues.push(`Current platform (${currentPlatform}) not vendored - run: pnpm vendor`);
  }
  
  return status;
}

/**
 * Format status for display
 */
function formatStatus(status) {
  const icon = status.vendored ? '✓' : '✗';
  const color = status.vendored ? '\x1b[32m' : '\x1b[31m'; // Green or Red
  const reset = '\x1b[0m';
  
  console.log(`\n${color}${icon}${reset} ${status.name}`);
  
  if (status.version) {
    console.log(`  Version: ${status.version}`);
  }
  
  if (status.source) {
    console.log(`  Source: ${status.source}`);
  }
  
  if (status.currentPlatform) {
    console.log(`  Current Platform: ${status.currentPlatform}`);
  }
  
  // Show sidecars for JavaScript
  if (status.sidecars && Object.keys(status.sidecars).length > 0) {
    console.log('  Sidecars:');
    for (const [name, present] of Object.entries(status.sidecars)) {
      const sidecarIcon = present ? '✓' : '✗';
      const sidecarColor = present ? '\x1b[32m' : '\x1b[31m';
      console.log(`    ${sidecarColor}${sidecarIcon}${reset} ${name}`);
    }
  }
  
  // Show platforms for Rust
  if (status.platforms && Object.keys(status.platforms).length > 0) {
    const vendoredPlatforms = Object.entries(status.platforms)
      .filter(([, info]) => info.vendored)
      .map(([platform, info]) => `${platform}${info.current ? ' (current)' : ''}`);
    
    if (vendoredPlatforms.length > 0) {
      console.log(`  Vendored Platforms: ${vendoredPlatforms.join(', ')}`);
    }
  }
  
  // Show issues
  if (status.issues.length > 0) {
    console.log('  \x1b[33mIssues:\x1b[0m'); // Yellow
    for (const issue of status.issues) {
      console.log(`    - ${issue}`);
    }
  }
}

/**
 * Main function
 */
function main() {
  console.log('='.repeat(60));
  console.log('Debug Adapter Vendoring Status');
  console.log('='.repeat(60));
  
  const statuses = [];
  let allVendored = true;
  
  // Check each adapter
  for (const adapter of adapters) {
    let status;
    
    if (adapter.name.includes('JavaScript')) {
      status = checkJavaScriptAdapter(adapter);
    } else if (adapter.name.includes('Rust')) {
      status = checkRustAdapter(adapter);
    }
    
    statuses.push(status);
    if (!status.vendored) {
      allVendored = false;
    }
    
    formatStatus(status);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  
  if (allVendored) {
    console.log('\x1b[32m✓ All adapters are properly vendored!\x1b[0m');
    console.log('\nYou can run the debugger with: pnpm start');
  } else {
    console.log('\x1b[33m⚠ Some adapters are not vendored.\x1b[0m');
    console.log('\nTo vendor all adapters, run:');
    console.log('  pnpm vendor');
    console.log('\nTo force re-vendor all adapters, run:');
    console.log('  pnpm vendor:force');
  }
  
  console.log('='.repeat(60));
  
  // Exit with error if not all vendored and not in CI
  if (!allVendored && process.env.CI !== 'true') {
    process.exit(1);
  }
}

const invokedDirectly = Boolean(process.argv[1] && path.resolve(process.argv[1]) === __filename);

// Run if called directly
if (invokedDirectly) {
  main();
}
