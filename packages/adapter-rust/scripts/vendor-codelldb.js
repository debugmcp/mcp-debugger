#!/usr/bin/env node

/**
 * Downloads and extracts CodeLLDB binaries for platforms
 * Based on research: official VSIX structure from vadimcn.vscode-lldb
 * 
 * Environment variables:
 *   - CODELLDB_VERSION: Version to download (default: '1.11.0')
 *   - CI: Set to 'true' in CI environments
 *   - SKIP_ADAPTER_VENDOR: Set to 'true' to skip vendoring
 *   - CODELLDB_PLATFORMS: Comma-separated list of platforms (default: current platform or all in CI)
 *   - CODELLDB_FORCE_REBUILD: Set to 'true' to force re-vendor
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

const CODELLDB_VERSION = process.env.CODELLDB_VERSION || '1.11.0';
const VENDOR_DIR = path.resolve(__dirname, '..', 'vendor', 'codelldb');
const FORCE_REBUILD = process.env.CODELLDB_FORCE_REBUILD === 'true';
const IS_CI = process.env.CI === 'true';
const SKIP_VENDOR = process.env.SKIP_ADAPTER_VENDOR === 'true';
const KEEP_TEMP = process.env.CODELLDB_KEEP_TEMP === 'true';

const PLATFORMS = {
  'win32-x64': {
    vsixNames: ['codelldb-win32-x64.vsix', 'codelldb-x86_64-windows.vsix'],
    binaryPath: 'extension/adapter/codelldb.exe',
    libPath: 'extension/lldb/bin/liblldb.dll',
    targetDir: 'win32-x64'
  },
  'darwin-x64': {
    vsixNames: ['codelldb-darwin-x64.vsix', 'codelldb-x86_64-darwin.vsix'],
    binaryPath: 'extension/adapter/codelldb',
    libPath: 'extension/lldb/lib/liblldb.dylib',
    targetDir: 'darwin-x64'
  },
  'darwin-arm64': {
    vsixNames: ['codelldb-darwin-arm64.vsix', 'codelldb-aarch64-darwin.vsix'],
    binaryPath: 'extension/adapter/codelldb',
    libPath: 'extension/lldb/lib/liblldb.dylib',
    targetDir: 'darwin-arm64'
  },
  'linux-x64': {
    vsixNames: ['codelldb-linux-x64.vsix', 'codelldb-x86_64-linux.vsix'],
    binaryPath: 'extension/adapter/codelldb',
    libPath: 'extension/lldb/lib/liblldb.so',
    targetDir: 'linux-x64'
  },
  'linux-arm64': {
    vsixNames: ['codelldb-linux-arm64.vsix', 'codelldb-aarch64-linux.vsix'],
    binaryPath: 'extension/adapter/codelldb',
    libPath: 'extension/lldb/lib/liblldb.so',
    targetDir: 'linux-arm64'
  }
};

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
  
  return null;
}

/**
 * Log with prefix
 */
function log(msg) {
  console.log(`[CodeLLDB vendor] ${msg}`);
}

function logWarn(msg) {
  console.warn(`[CodeLLDB vendor][warn] ${msg}`);
}

function logError(msg) {
  console.error(`[CodeLLDB vendor][error] ${msg}`);
}

/**
 * Download a file with progress indicator and retries
 */
async function downloadFile(url, destPath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'debugmcp/adapter-rust'
        }
      });
      log(`HTTP response: ${response.status} ${response.statusText}, content-type=${response.headers.get('content-type')}, content-length=${response.headers.get('content-length')}, encoding=${response.headers.get('content-encoding') ?? '<none>'}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const totalSize = parseInt(response.headers.get('content-length'), 10);
      
      // Only show progress bar if not in CI
      let progressBar = null;
      if (!IS_CI && totalSize) {
        progressBar = new ProgressBar('  downloading [:bar] :percent :etas', {
          complete: '=',
          incomplete: ' ',
          width: 20,
          total: totalSize
        });
        
        // Update progress bar on data received
        response.body.on('data', (chunk) => {
          progressBar.tick(chunk.length);
        });
      } else if (IS_CI && totalSize) {
        log(`Downloading (${Math.round(totalSize / 1024 / 1024)}MB)...`);
      }
      
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await pipeline(response.body, createWriteStream(destPath));

      // Validate downloaded file size when Content-Length is provided
      if (totalSize && Number.isFinite(totalSize)) {
        const { size: actualSize } = await fs.stat(destPath);
        if (actualSize !== totalSize) {
          throw new Error(`Downloaded size mismatch: expected ${totalSize} bytes, got ${actualSize} bytes`);
        }
      }
      
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const backoff = Math.floor(500 * Math.pow(2, attempt - 1));
      logWarn(`Download failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

/**
 * Extract VSIX and copy required files
 */
async function extractAndCopyFiles(vsixPath, platform, platformInfo, vsixName) {
  const tempExtractDir = path.join(path.dirname(vsixPath), `temp-${platform}`);
  
  try {
    const stats = await fs.stat(vsixPath);
    log(`Artifact size: ${stats.size} bytes`);
    let magic = '';
    try {
      const fileHandle = await fs.open(vsixPath, 'r');
      const buffer = Buffer.alloc(4);
      await fileHandle.read(buffer, 0, 4, 0);
      await fileHandle.close();
      magic = `${buffer.toString('hex')} (${buffer.toString('ascii')})`;
    } catch (magicError) {
      logWarn(`Unable to inspect VSIX header: ${magicError.message}`);
    }
    log(`Artifact magic header: ${magic || 'unknown'}`);

    const expectedMagic = '504b0304';
    if (magic && !magic.startsWith(expectedMagic)) {
      throw new Error(`Unexpected VSIX header: expected ${expectedMagic}, got ${magic}`);
    }

    // Extract VSIX (which is a zip file)
    log(`Extracting ${vsixName}...`);
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
    
    log(`Copying adapter binary...`);
    await fs.copyFile(sourceBinaryPath, targetBinaryPath);
    
    // Set executable permissions on Unix platforms
    if (platform !== 'win32-x64') {
      await fs.chmod(targetBinaryPath, 0o755);
    }
    
    // Copy LLDB directory structure
    const sourceLldbDir = path.join(tempExtractDir, 'extension', 'lldb');
    log(`Copying LLDB libraries...`);
    await copyDirectory(sourceLldbDir, targetLldbDir);
    
    // Create version manifest
    const versionFile = path.join(VENDOR_DIR, platformInfo.targetDir, 'version.json');
    await fs.writeFile(versionFile, JSON.stringify({
      version: CODELLDB_VERSION,
      platform: platform,
      downloadedAt: new Date().toISOString()
    }, null, 2));
    
    log(`Success: ${platform} vendored successfully`);
  } finally {
    // Clean up temp directory
    if (KEEP_TEMP) {
      log(`Keeping temp extraction directory at ${tempExtractDir}`);
    } else {
      try {
        await fs.rm(tempExtractDir, { recursive: true, force: true });
      } catch (cleanupError) {
        logWarn(`Unable to remove temp directory ${tempExtractDir}: ${cleanupError instanceof Error ? cleanupError.message : cleanupError}`);
      }
    }
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
  if (FORCE_REBUILD) {
    return false;
  }
  
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
    logWarn(`Unsupported platform: ${platform}`);
    return false;
  }
  
  // Check if already vendored
  if (await isAlreadyVendored(platform, platformInfo)) {
    log(`Up-to-date: ${platform} already vendored (v${CODELLDB_VERSION})`);
    return true;
  }
  
  const vsixCandidates = Array.isArray(platformInfo.vsixNames)
    ? platformInfo.vsixNames
    : [platformInfo.vsixName].filter(Boolean);
  
  if (vsixCandidates.length === 0) {
    logWarn(`No VSIX candidates configured for ${platform}`);
    return false;
  }
  
  const tempDir = path.join(VENDOR_DIR, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  
  let lastError = null;
  for (const vsixName of vsixCandidates) {
    const downloadUrl = `https://github.com/vadimcn/vscode-lldb/releases/download/v${CODELLDB_VERSION}/${vsixName}`;
    const vsixPath = path.join(tempDir, vsixName);
    
    log(`Vendoring CodeLLDB for ${platform} (artifact: ${vsixName}):`);
    log(`Downloading from ${downloadUrl}`);
    
    try {
      await downloadFile(downloadUrl, vsixPath);
      await extractAndCopyFiles(vsixPath, platform, platformInfo, vsixName);
      return true;
    } catch (error) {
      lastError = error;
      logWarn(`Attempt with ${vsixName} failed: ${error.message}`);
    } finally {
      if (KEEP_TEMP) {
        log(`Keeping downloaded artifact at ${vsixPath} for inspection.`);
      } else {
        await fs.rm(vsixPath, { force: true });
      }
    }
  }
  
  if (lastError) {
    logWarn(`Failed to vendor ${platform} after trying ${vsixCandidates.join(', ')}. Last error: ${lastError.message}`);
  }
  return false;
}

/**
 * Determine platforms to vendor based on environment
 */
function determinePlatforms() {
  // Check if platforms are explicitly specified
  if (process.env.CODELLDB_PLATFORMS) {
    const fromEnv = process.env.CODELLDB_PLATFORMS.split(',').map(p => p.trim());
    log(`Using platforms from CODELLDB_PLATFORMS: ${fromEnv.join(', ')}`);
    return fromEnv;
  }
  
  // Command line arguments take precedence
  const cliPlatforms = process.argv.slice(2);
  if (cliPlatforms.length > 0) {
    log(`Using platforms from CLI args: ${cliPlatforms.join(', ')}`);
    return cliPlatforms;
  }
  
  // In CI, vendor all platforms
  if (IS_CI) {
    log('CI environment detected - vendoring all platforms');
    return Object.keys(PLATFORMS);
  }
  
  // Otherwise, only vendor current platform
  const currentPlatform = getCurrentPlatform();
  if (!currentPlatform) {
    logWarn(`Unknown platform: ${process.platform}-${process.arch}`);
    logWarn('Vendoring all platforms as fallback');
    return Object.keys(PLATFORMS);
  }
  
  log(`Using detected platform: ${currentPlatform}`);
  return [currentPlatform];
}

/**
 * Main function to vendor CodeLLDB for selected platforms
 */
async function main() {
  // Check if vendoring should be skipped
  if (SKIP_VENDOR) {
    log('Skipping vendoring (SKIP_ADAPTER_VENDOR=true)');
    process.exit(0);
  }
  
  log('Script starting...');
  log(`Working directory: ${process.cwd()}`);
  log(`Vendor directory: ${VENDOR_DIR}`);
  log(`Environment: CI=${process.env.CI ?? '<unset>'}, SKIP_ADAPTER_VENDOR=${process.env.SKIP_ADAPTER_VENDOR ?? '<unset>'}`);
  log(`Force rebuild: ${FORCE_REBUILD}`);
  log(`Requested platforms (env): ${process.env.CODELLDB_PLATFORMS ?? '<none>'}`);
  log(`Keep temp artifacts: ${KEEP_TEMP}`);
  log(`CLI arguments: ${process.argv.slice(2).join(', ') || '<none>'}`);

  log(`CodeLLDB Vendoring Script v${CODELLDB_VERSION}`);
  log('='.repeat(50));
  
  // Create vendor directory
  await fs.mkdir(VENDOR_DIR, { recursive: true });
  
  // Create .gitkeep file
  const vendorRootGitkeep = path.resolve(__dirname, '..', 'vendor', '.gitkeep');
  await fs.writeFile(vendorRootGitkeep, '', { flag: 'a' });
  const gitkeepPath = path.join(VENDOR_DIR, '.gitkeep');
  await fs.writeFile(gitkeepPath, '', { flag: 'a' }); // Create if not exists
  
  // Determine which platforms to vendor
  const selectedPlatforms = determinePlatforms();
  
  log(`Platforms to vendor: ${selectedPlatforms.join(', ')}\n`);
  
  const results = [];
  for (const platform of selectedPlatforms) {
    const success = await downloadAndExtract(platform);
    results.push({ platform, success });
  }
  
  // Clean up temp directory
  if (!KEEP_TEMP) {
    try {
      await fs.rm(path.join(VENDOR_DIR, 'temp'), { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  } else {
    log('Retaining temp workspace per CODELLDB_KEEP_TEMP=true');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  log('Summary:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    log(`Successfully vendored: ${successful.map(r => r.platform).join(', ')}`);
  }
  
  if (failed.length > 0) {
    logError(`Failed to vendor: ${failed.map(r => r.platform).join(', ')}`);
    logWarn('Rust debugging will not be available for the failed platforms.');
    logWarn('You can try again with: pnpm vendor:force');
    if (IS_CI) {
      logWarn('CI environment detected - exiting with failure to surface the issue.');
      process.exit(1);
    } else {
      process.exitCode = 1;
    }
    return;
  }
  
  if (successful.length > 0) {
    log('Vendoring complete!');
    log(`\nNote: The vendored binaries maintain the required directory structure:`);
    log(`  adapter/codelldb[.exe]`);
    log(`  lldb/lib/liblldb.[dll|dylib|so]`);
  }
}

const invokedDirectly = Boolean(process.argv[1] && path.resolve(process.argv[1]) === __filename);

// Run if called directly
if (invokedDirectly) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    if (error?.stack) {
      logError(error.stack);
    }
    logWarn('Rust debugging will not be available');
    process.exitCode = 1;
  });
}

export { downloadAndExtract, PLATFORMS, CODELLDB_VERSION };
