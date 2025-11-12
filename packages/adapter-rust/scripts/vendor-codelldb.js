#!/usr/bin/env node

/**
 * Downloads and extracts CodeLLDB binaries for all platforms
 * Based on research: official VSIX structure from vadimcn.vscode-lldb
 */

import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import fetch from 'node-fetch';
import extractZip from 'extract-zip';
import ProgressBar from 'progress';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CODELLDB_VERSION = '1.11.0'; // Pin to specific version
const VENDOR_DIR = path.resolve(__dirname, '..', 'vendor', 'codelldb');

const PLATFORMS = {
  'win32-x64': {
    vsixName: 'codelldb-x86_64-windows.vsix',
    binaryPath: 'extension/adapter/codelldb.exe',
    libPath: 'extension/lldb/bin/liblldb.dll',
    targetDir: 'win32-x64'
  },
  'darwin-x64': {
    vsixName: 'codelldb-x86_64-darwin.vsix',
    binaryPath: 'extension/adapter/codelldb',
    libPath: 'extension/lldb/lib/liblldb.dylib',
    targetDir: 'darwin-x64'
  },
  'darwin-arm64': {
    vsixName: 'codelldb-aarch64-darwin.vsix',
    binaryPath: 'extension/adapter/codelldb',
    libPath: 'extension/lldb/lib/liblldb.dylib',
    targetDir: 'darwin-arm64'
  },
  'linux-x64': {
    vsixName: 'codelldb-x86_64-linux.vsix',
    binaryPath: 'extension/adapter/codelldb',
    libPath: 'extension/lldb/lib/liblldb.so',
    targetDir: 'linux-x64'
  },
  'linux-arm64': {
    vsixName: 'codelldb-aarch64-linux.vsix',
    binaryPath: 'extension/adapter/codelldb',
    libPath: 'extension/lldb/lib/liblldb.so',
    targetDir: 'linux-arm64'
  }
};

/**
 * Download a file with progress indicator
 */
async function downloadFile(url, destPath) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  
  const totalSize = parseInt(response.headers.get('content-length'), 10);
  const progressBar = new ProgressBar('  downloading [:bar] :percent :etas', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: totalSize
  });
  
  // Update progress bar on data received
  response.body.on('data', (chunk) => {
    progressBar.tick(chunk.length);
  });
  
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await pipeline(response.body, createWriteStream(destPath));
}

/**
 * Extract VSIX and copy required files
 */
async function extractAndCopyFiles(vsixPath, platform, platformInfo) {
  const tempExtractDir = path.join(path.dirname(vsixPath), `temp-${platform}`);
  
  try {
    // Extract VSIX (which is a zip file)
    console.log(`  Extracting ${platformInfo.vsixName}...`);
    await extractZip(vsixPath, { dir: tempExtractDir });
    
    // Target directories for adapter and lldb
    const targetAdapterDir = path.join(VENDOR_DIR, platformInfo.targetDir, 'adapter');
    const targetLldbDir = path.join(VENDOR_DIR, platformInfo.targetDir, 'lldb');
    
    // Create target directories
    await fs.mkdir(targetAdapterDir, { recursive: true });
    await fs.mkdir(targetLldbDir, { recursive: true });
    
    // Copy adapter binary
    const sourceBinaryPath = path.join(tempExtractDir, platformInfo.binaryPath);
    const targetBinaryPath = path.join(targetAdapterDir, path.basename(platformInfo.binaryPath));
    
    console.log(`  Copying adapter binary...`);
    await fs.copyFile(sourceBinaryPath, targetBinaryPath);
    
    // Set executable permissions on Unix platforms
    if (platform !== 'win32-x64') {
      await fs.chmod(targetBinaryPath, 0o755);
    }
    
    // Copy LLDB directory structure
    const sourceLldbDir = path.join(tempExtractDir, 'extension', 'lldb');
    console.log(`  Copying LLDB libraries...`);
    await copyDirectory(sourceLldbDir, targetLldbDir);
    
    // Create version manifest
    const versionFile = path.join(VENDOR_DIR, platformInfo.targetDir, 'version.json');
    await fs.writeFile(versionFile, JSON.stringify({
      version: CODELLDB_VERSION,
      platform: platform,
      downloadedAt: new Date().toISOString()
    }, null, 2));
    
    console.log(`  ✓ ${platform} vendored successfully`);
  } finally {
    // Clean up temp directory
    await fs.rm(tempExtractDir, { recursive: true, force: true });
  }
}

/**
 * Recursively copy directory
 */
async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
      // Preserve executable permissions
      const stats = await fs.stat(srcPath);
      await fs.chmod(destPath, stats.mode);
    }
  }
}

/**
 * Check if platform is already vendored with correct version
 */
async function isAlreadyVendored(platform, platformInfo) {
  const versionFile = path.join(VENDOR_DIR, platformInfo.targetDir, 'version.json');
  
  try {
    const versionData = JSON.parse(await fs.readFile(versionFile, 'utf-8'));
    return versionData.version === CODELLDB_VERSION;
  } catch {
    return false;
  }
}

/**
 * Download and extract CodeLLDB for a specific platform
 */
async function downloadAndExtract(platform) {
  const platformInfo = PLATFORMS[platform];
  
  if (!platformInfo) {
    console.error(`  ✗ Unsupported platform: ${platform}`);
    return false;
  }
  
  // Check if already vendored
  if (await isAlreadyVendored(platform, platformInfo)) {
    console.log(`  ✓ ${platform} already vendored (v${CODELLDB_VERSION})`);
    return true;
  }
  
  const downloadUrl = `https://github.com/vadimcn/vscode-lldb/releases/download/v${CODELLDB_VERSION}/${platformInfo.vsixName}`;
  const vsixPath = path.join(VENDOR_DIR, 'temp', platformInfo.vsixName);
  
  try {
    console.log(`\nVendoring CodeLLDB for ${platform}:`);
    console.log(`  Downloading from ${downloadUrl}`);
    
    // Create temp directory
    await fs.mkdir(path.join(VENDOR_DIR, 'temp'), { recursive: true });
    
    // Download VSIX
    await downloadFile(downloadUrl, vsixPath);
    
    // Extract and copy files
    await extractAndCopyFiles(vsixPath, platform, platformInfo);
    
    // Clean up downloaded VSIX
    await fs.unlink(vsixPath);
    
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to vendor ${platform}: ${error.message}`);
    return false;
  }
}

/**
 * Main function to vendor CodeLLDB for all platforms
 */
async function main() {
  console.log(`CodeLLDB Vendoring Script v${CODELLDB_VERSION}`);
  console.log('=' .repeat(50));
  
  // Create vendor directory
  await fs.mkdir(VENDOR_DIR, { recursive: true });
  
  // Create .gitkeep file
  const gitkeepPath = path.join(VENDOR_DIR, '.gitkeep');
  await fs.writeFile(gitkeepPath, '', { flag: 'a' }); // Create if not exists
  
  // Determine which platforms to vendor
  const platformsToVendor = process.argv.slice(2);
  const selectedPlatforms = platformsToVendor.length > 0 
    ? platformsToVendor 
    : Object.keys(PLATFORMS);
  
  console.log(`\nPlatforms to vendor: ${selectedPlatforms.join(', ')}\n`);
  
  const results = [];
  for (const platform of selectedPlatforms) {
    const success = await downloadAndExtract(platform);
    results.push({ platform, success });
  }
  
  // Clean up temp directory
  try {
    await fs.rm(path.join(VENDOR_DIR, 'temp'), { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('Summary:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    console.log(`✓ Successfully vendored: ${successful.map(r => r.platform).join(', ')}`);
  }
  
  if (failed.length > 0) {
    console.log(`✗ Failed to vendor: ${failed.map(r => r.platform).join(', ')}`);
    process.exit(1);
  }
  
  console.log('\nVendoring complete!');
  console.log(`\nNote: The vendored binaries maintain the required directory structure:`);
  console.log(`  adapter/codelldb[.exe]`);
  console.log(`  lldb/lib/liblldb.[dll|dylib|so]`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { downloadAndExtract, PLATFORMS, CODELLDB_VERSION };
