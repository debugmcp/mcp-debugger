#!/usr/bin/env node

/**
 * Downloads and extracts kotlin-debug-adapter from GitHub releases.
 *
 * kotlin-debug-adapter is a JDI-based DAP server that speaks DAP over stdio.
 * It supports both Java and Kotlin debugging since JDI operates at bytecode level.
 *
 * Environment variables:
 *   - KDA_VERSION: Version to download (default: '0.4.4')
 *   - SKIP_ADAPTER_VENDOR: Set to 'true' to skip vendoring
 *   - KDA_FORCE_REBUILD: Set to 'true' to force re-vendor
 *   - KDA_VENDOR_LOCAL_ONLY: Set to 'true' to forbid downloads
 */

import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';
import fetch from 'node-fetch';
import extractZip from 'extract-zip';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KDA_VERSION = process.env.KDA_VERSION || '0.4.4';
const VENDOR_DIR = path.resolve(__dirname, '..', 'vendor', 'kotlin-debug-adapter');
const FORCE_REBUILD = process.env.KDA_FORCE_REBUILD === 'true';
const IS_CI = process.env.CI === 'true';
const SKIP_VENDOR = process.env.SKIP_ADAPTER_VENDOR === 'true';
const LOCAL_ONLY = process.env.KDA_VENDOR_LOCAL_ONLY === 'true';

const RELEASE_URL = process.env.KDA_RELEASE_URL ||
  `https://github.com/fwcd/kotlin-debug-adapter/releases/download/${KDA_VERSION}/adapter.zip`;

function log(msg) {
  console.log(`[KDA vendor] ${msg}`);
}

function logWarn(msg) {
  console.warn(`[KDA vendor][warn] ${msg}`);
}

function logError(msg) {
  console.error(`[KDA vendor][error] ${msg}`);
}

async function pathExists(fsPath) {
  try {
    await fs.access(fsPath);
    return true;
  } catch {
    return false;
  }
}

function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    hash.on('error', reject);
    hash.on('finish', () => {
      try {
        resolve(hash.digest('hex'));
      } catch (error) {
        reject(error);
      }
    });
    stream.pipe(hash);
  });
}

/**
 * Check if already vendored with correct version
 */
async function isAlreadyVendored() {
  if (FORCE_REBUILD) {
    return false;
  }

  const versionFile = path.join(VENDOR_DIR, 'version.json');
  try {
    const versionData = JSON.parse(await fs.readFile(versionFile, 'utf-8'));
    return versionData.version === KDA_VERSION;
  } catch {
    return false;
  }
}

/**
 * Download a file with retries
 */
async function downloadFile(url, destPath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        timeout: 60000,
        headers: {
          'User-Agent': 'debugmcp/adapter-java'
        }
      });

      log(`HTTP response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const totalSize = parseInt(response.headers.get('content-length'), 10);
      if (IS_CI && totalSize) {
        log(`Downloading (${Math.round(totalSize / 1024 / 1024)}MB)...`);
      }

      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await pipeline(response.body, createWriteStream(destPath));

      return;
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
 * Main function to vendor kotlin-debug-adapter
 */
async function main() {
  if (SKIP_VENDOR) {
    log('Skipping vendoring (SKIP_ADAPTER_VENDOR=true)');
    process.exit(0);
  }

  log(`kotlin-debug-adapter Vendoring Script v${KDA_VERSION}`);
  log('='.repeat(50));
  log(`Vendor directory: ${VENDOR_DIR}`);

  // Check if already vendored
  if (await isAlreadyVendored()) {
    log(`Up-to-date: kotlin-debug-adapter already vendored (v${KDA_VERSION})`);
    return;
  }

  if (LOCAL_ONLY) {
    logError('KDA_VENDOR_LOCAL_ONLY is enabled but artifacts were not found.');
    logWarn('Run "pnpm --filter @debugmcp/adapter-java run build:adapter" locally first.');
    process.exitCode = 1;
    return;
  }

  // Create vendor directory
  await fs.mkdir(VENDOR_DIR, { recursive: true });

  // Create .gitkeep files
  const vendorRootGitkeep = path.resolve(__dirname, '..', 'vendor', '.gitkeep');
  await fs.writeFile(vendorRootGitkeep, '', { flag: 'a' });

  const tempDir = path.join(VENDOR_DIR, 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  const zipPath = path.join(tempDir, 'adapter.zip');

  try {
    log(`Downloading kotlin-debug-adapter v${KDA_VERSION}...`);
    log(`URL: ${RELEASE_URL}`);

    await downloadFile(RELEASE_URL, zipPath);

    // Verify it's a zip file
    const fileHandle = await fs.open(zipPath, 'r');
    const buffer = Buffer.alloc(4);
    await fileHandle.read(buffer, 0, 4, 0);
    await fileHandle.close();
    const magic = buffer.toString('hex');
    if (!magic.startsWith('504b0304')) {
      throw new Error(`Unexpected file header: ${magic}. Expected ZIP file.`);
    }

    // Extract
    log('Extracting...');
    const extractDir = path.join(tempDir, 'extracted');
    await extractZip(zipPath, { dir: extractDir });

    // The KDA release contains an 'adapter/' directory with bin/ and lib/
    // Copy contents to vendor directory
    const adapterDir = path.join(extractDir, 'adapter');
    const sourceDir = await pathExists(adapterDir) ? adapterDir : extractDir;

    // Clean existing vendor contents (except temp)
    const existingEntries = await fs.readdir(VENDOR_DIR).catch(() => []);
    for (const entry of existingEntries) {
      if (entry !== 'temp' && entry !== '.gitkeep') {
        await fs.rm(path.join(VENDOR_DIR, entry), { recursive: true, force: true });
      }
    }

    // Copy extracted files
    await copyDirectory(sourceDir, VENDOR_DIR);

    // Make scripts executable
    const binDir = path.join(VENDOR_DIR, 'bin');
    if (await pathExists(binDir)) {
      const binEntries = await fs.readdir(binDir);
      for (const entry of binEntries) {
        const binPath = path.join(binDir, entry);
        await fs.chmod(binPath, 0o755).catch(() => {});
      }
    }

    // Write version manifest
    const sha256 = await computeSha256(zipPath);
    await fs.writeFile(path.join(VENDOR_DIR, 'version.json'), JSON.stringify({
      version: KDA_VERSION,
      sha256,
      downloadedAt: new Date().toISOString()
    }, null, 2));

    log(`Successfully vendored kotlin-debug-adapter v${KDA_VERSION}`);

  } catch (error) {
    logError(`Failed to vendor: ${error.message}`);
    if (IS_CI) {
      process.exit(1);
    } else {
      logWarn('Java debugging will not be available.');
      process.exitCode = 1;
    }
  } finally {
    // Clean up temp
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
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
      const stats = await fs.stat(srcPath);
      await fs.chmod(destPath, stats.mode);
    }
  }
}

// Run if called directly
const invokedDirectly = Boolean(process.argv[1] && path.resolve(process.argv[1]) === __filename);
if (invokedDirectly) {
  main().catch(error => {
    logError(`Fatal error: ${error.message}`);
    if (error?.stack) {
      logError(error.stack);
    }
    logWarn('Java debugging will not be available');
    process.exitCode = 1;
  });
}

export { main, KDA_VERSION };
