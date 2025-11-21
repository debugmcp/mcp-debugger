/**
 * NPX Test Utilities
 * 
 * Helper functions for testing MCP debugger through npx distribution (npm pack)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs/promises';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import { createHash } from 'crypto';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');
const PACK_LOCK_PATH = path.join(ROOT, 'packages', 'mcp-debugger', '.pack-lock');
const PACK_LOCK_STALE_MS = 5 * 60 * 1000;
const PACKAGE_DIR = path.join(ROOT, 'packages', 'mcp-debugger');
const PACKAGE_DIST_DIR = path.join(PACKAGE_DIR, 'dist');
const PACK_CACHE_DIR = path.join(PACKAGE_DIR, 'package-cache');
const PACKAGE_JSON_PATH = path.join(PACKAGE_DIR, 'package.json');
const PACKAGE_BACKUP_PATH = path.join(PACKAGE_DIR, 'package.json.backup');
const ROOT_DIST_DIR = path.join(ROOT, 'dist');
const ROOT_BUNDLE_ENTRY = path.join(ROOT_DIST_DIR, 'bundle.cjs');
const PACKAGE_DIST_ENTRY = path.join(PACKAGE_DIST_DIR, 'cli.mjs');

async function acquirePackLock(): Promise<void> {
  while (true) {
    try {
      const handle = await fs.open(PACK_LOCK_PATH, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
      await handle.close();
      return;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') {
        throw error;
      }

      try {
        const stats = await fs.stat(PACK_LOCK_PATH);
        if (Date.now() - stats.mtimeMs > PACK_LOCK_STALE_MS) {
          console.log('[NPX Test] Pack lock looks stale. Removing it...');
          await fs.unlink(PACK_LOCK_PATH);
          continue;
        }
      } catch (statError) {
        const statErr = statError as NodeJS.ErrnoException;
        if (statErr.code !== 'ENOENT') {
          throw statError;
        }
      }

      console.log('[NPX Test] Waiting for existing pack operation to finish...');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function releasePackLock(): Promise<void> {
  try {
    await fs.unlink(PACK_LOCK_PATH);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      console.warn('[NPX Test] Failed to release pack lock:', err);
    }
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureWorkspaceBuilt(): Promise<void> {
  const needsRootBuild = !(await pathExists(ROOT_BUNDLE_ENTRY));
  const needsPackageBuild = !(await pathExists(PACKAGE_DIST_ENTRY));

  if (needsRootBuild) {
    console.log('[NPX Test] Root dist missing, running "pnpm build"...');
    await execAsync('pnpm build', { cwd: ROOT });
  }

  if (needsPackageBuild) {
    console.log('[NPX Test] mcp-debugger dist missing, rebuilding package...');
    await execAsync('pnpm --filter @debugmcp/mcp-debugger build', { cwd: ROOT });
  }
}

async function ensurePackageBackupRestored(): Promise<void> {
  if (await pathExists(PACKAGE_BACKUP_PATH)) {
    console.log('[NPX Test] Detected leftover package.json.backup, restoring before continuing...');
    await execAsync('node scripts/prepare-pack.js restore', { cwd: ROOT });
  }
}

async function hashDirectoryContents(
  dir: string,
  hash: ReturnType<typeof createHash>,
  relativeTo: string
): Promise<void> {
  if (!(await pathExists(dir))) {
    return;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    const relativePath = path.relative(relativeTo, entryPath).replace(/\\/g, '/');
    hash.update(relativePath);

    if (entry.isDirectory()) {
      await hashDirectoryContents(entryPath, hash, relativeTo);
    } else if (entry.isFile()) {
      const contents = await fs.readFile(entryPath);
      hash.update(contents);
    }
  }
}

async function computePackFingerprint(): Promise<string> {
  const hash = createHash('sha256');
  hash.update(await fs.readFile(PACKAGE_JSON_PATH));
  await hashDirectoryContents(PACKAGE_DIST_DIR, hash, PACKAGE_DIR);
  return hash.digest('hex');
}

async function ensurePackCacheDir(): Promise<void> {
  await fs.mkdir(PACK_CACHE_DIR, { recursive: true });
}

async function getCachedTarballPath(fingerprint: string): Promise<string | null> {
  const candidate = path.join(PACK_CACHE_DIR, `${fingerprint}.tgz`);
  return (await pathExists(candidate)) ? candidate : null;
}

export interface NpxTestConfig {
  packagePath?: string;
  useGlobal?: boolean;
  logLevel?: string;
}

/**
 * Build the project and create npm package tarball
 */
export async function buildAndPackNpmPackage(): Promise<string> {
  console.log('[NPX Test] Building project...');

  await ensurePackageBackupRestored();
  await ensureWorkspaceBuilt();
  await ensurePackCacheDir();

  const fingerprint = await computePackFingerprint();
  const cachedBeforeLock = await getCachedTarballPath(fingerprint);
  if (cachedBeforeLock) {
    console.log(`[NPX Test] Using cached npm package at ${cachedBeforeLock}`);
    return cachedBeforeLock;
  }

  await acquirePackLock();
  console.log('[NPX Test] Acquired NPX packaging lock.');

  let ranPrepare = false;
  try {
    await ensurePackageBackupRestored();
    const cachedAfterLock = await getCachedTarballPath(fingerprint);
    if (cachedAfterLock) {
      console.log(`[NPX Test] Cache filled while waiting for lock; using ${cachedAfterLock}`);
      return cachedAfterLock;
    }

    console.log('[NPX Test] Cache miss; creating npm package tarball...');
    await execAsync('node scripts/prepare-pack.js prepare', { cwd: ROOT });
    ranPrepare = true;

    const { stdout } = await execAsync('npm pack --pack-destination package-cache', {
      cwd: PACKAGE_DIR
    });
    const tarballName = stdout.trim().split('\n').pop();
    if (!tarballName) {
      throw new Error('Failed to determine npm pack output filename');
    }

    const tempTarballPath = path.join(PACKAGE_DIR, 'package-cache', tarballName);
    const finalTarballPath = path.join(PACK_CACHE_DIR, `${fingerprint}.tgz`);
    if (await pathExists(finalTarballPath)) {
      await fs.unlink(finalTarballPath);
    }
    await fs.rename(tempTarballPath, finalTarballPath);
    console.log(`[NPX Test] Package created: ${finalTarballPath}`);

    return finalTarballPath;
  } catch (error) {
    console.error('[NPX Test] Build/pack failed:', error);
    throw error;
  } finally {
    if (ranPrepare) {
      try {
        await execAsync('node scripts/prepare-pack.js restore', { cwd: ROOT });
      } catch (restoreError) {
        console.warn('[NPX Test] Warning restoring package.json:', restoreError);
      }
    }

    await releasePackLock();
  }
}

/**
 * Install package globally from tarball
 */
export async function installPackageGlobally(tarballPath: string): Promise<void> {
  console.log(`[NPX Test] Installing package globally from ${tarballPath}...`);
  
  try {
    // Uninstall existing version first (ignore errors)
    try {
      await execAsync('npm uninstall -g @debugmcp/mcp-debugger');
    } catch {
      // Package might not be installed
    }
    
    // Install from tarball
    await execAsync(`npm install -g "${tarballPath}"`);
    console.log('[NPX Test] Package installed globally');
    
    // Verify installation
    const { stdout } = await execAsync('npm list -g @debugmcp/mcp-debugger');
    console.log('[NPX Test] Installation verified:', stdout.trim());
  } catch (error) {
    console.error('[NPX Test] Installation failed:', error);
    throw error;
  }
}

/**
 * Cleanup global package installation
 */
export async function cleanupGlobalInstall(): Promise<void> {
  try {
    console.log('[NPX Test] Cleaning up global installation...');
    await execAsync('npm uninstall -g @debugmcp/mcp-debugger');
    console.log('[NPX Test] Global package uninstalled');
  } catch (error) {
    // Ignore cleanup errors
    console.warn('[NPX Test] Cleanup warning (can be ignored):', error);
  }
}

/**
 * Create an MCP client connected via npx
 */
export async function createNpxMcpClient(config: NpxTestConfig = {}): Promise<{
  client: Client;
  transport: StdioClientTransport;
  cleanup: () => Promise<void>;
}> {
  const logLevel = config.logLevel || 'info';
  
  console.log('[NPX Test] Starting MCP server via npx...');
  
  // Use npx to run the globally installed package
  const transport = new StdioClientTransport({
    command: 'npx',
    args: [
      '@debugmcp/mcp-debugger',
      'stdio',
      '--log-level', logLevel,
      '--log-file', path.join(ROOT, 'logs', 'npx-test.log')
    ],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });
  const logsDir = path.join(ROOT, 'logs');
  const rawLogPath = path.join(logsDir, 'npx-raw.log');
  await mkdir(logsDir, { recursive: true }).catch(() => {});
  await writeFile(rawLogPath, '').catch(() => {});
  
  let transportSendSequence = 0;
  const originalSend = transport.send.bind(transport);
  transport.send = async (message) => {
    const entry = {
      direction: 'out',
      seq: ++transportSendSequence,
      timestamp: new Date().toISOString(),
      message
    };
    try {
      await appendFile(rawLogPath, `${JSON.stringify(entry)}\n`);
    } catch {
      // Ignore logging errors
    }
    try {
      console.log('[NPX Test] transport send', JSON.stringify(entry));
    } catch {
      console.log('[NPX Test] transport send (unserializable message)');
    }
    return originalSend(message);
  };
  
  const client = new Client({
    name: 'npx-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  const randomOffset = Math.floor(Math.random() * 1000000);
  (client as unknown as { _requestMessageId: number })._requestMessageId = randomOffset;
  
  try {
    await client.connect(transport);
    const wrappedOnMessage = transport.onmessage?.bind(transport);
    transport.onmessage = (message) => {
      const entry = {
        direction: 'in',
        timestamp: new Date().toISOString(),
        message
      };
      try {
        appendFile(rawLogPath, `${JSON.stringify(entry)}\n`).catch(() => {});
      } catch {
        // Ignore logging errors
      }
      try {
        console.log('[NPX Test] transport recv', JSON.stringify(entry));
      } catch {
        console.log('[NPX Test] transport recv (unserializable message)');
      }
      wrappedOnMessage?.(message);
    };
    console.log('[NPX Test] MCP client connected via npx');
  } catch (error) {
    console.error('[NPX Test] Failed to connect:', error);
    try {
      await transport.close();
    } catch {
      // Ignore
    }
    throw error;
  }
  
  const cleanup = async () => {
    try {
      await client.close();
    } catch {
      // Ignore close errors
    }
    
    try {
      await transport.close();
    } catch {
      // Ignore transport close errors
    }
  };
  
  return { client, transport, cleanup };
}

/**
 * Get package size information
 */
export async function getPackageSize(tarballPath: string): Promise<{
  sizeKB: number;
  sizeMB: number;
}> {
  const stats = await fs.stat(tarballPath);
  const sizeKB = stats.size / 1024;
  const sizeMB = sizeKB / 1024;
  
  return { sizeKB, sizeMB };
}

/**
 * Verify package contents include all adapters
 */
export async function verifyPackageContents(tarballPath: string): Promise<{
  hasJavaScript: boolean;
  hasPython: boolean;
  hasMock: boolean;
  bundleSize: number;
}> {
  console.log('[NPX Test] Verifying package contents...');
  
  try {
    // List tarball contents
    const { stdout } = await execAsync(`tar -tzf "${tarballPath}"`);
    const contents = stdout.toLowerCase();
    
    // Check for adapter-related files in the bundle
    const hasJavaScript = contents.includes('javascript') || contents.includes('js-debug');
    const hasPython = contents.includes('python') || contents.includes('debugpy');
    const hasMock = contents.includes('mock');
    
    // Get bundle size
    const cliMatch = stdout.match(/package\/dist\/cli\.mjs/);
    let bundleSize = 0;
    if (cliMatch) {
      const stats = await fs.stat(tarballPath);
      bundleSize = stats.size;
    }
    
    console.log('[NPX Test] Package verification:', {
      hasJavaScript,
      hasPython,
      hasMock,
      bundleSize
    });
    
    return { hasJavaScript, hasPython, hasMock, bundleSize };
  } catch (error) {
    console.error('[NPX Test] Package verification failed:', error);
    throw error;
  }
}
