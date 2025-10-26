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

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');

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
  
  try {
    // Build the entire project
    await execAsync('pnpm build', { cwd: ROOT });
    console.log('[NPX Test] Build completed');
    
    // Prepare package.json (resolve workspace deps)
    await execAsync('node scripts/prepare-pack.js prepare', { cwd: ROOT });

    // Pack the mcp-debugger package
    const packageDir = path.join(ROOT, 'packages', 'mcp-debugger');
    console.log('[NPX Test] Creating npm package...');
    
    const { stdout } = await execAsync('npm pack', { cwd: packageDir });
    
    // Extract tarball filename from output
    const tarballName = stdout.trim().split('\n').pop();
    if (!tarballName) {
      throw new Error('Failed to get tarball name from npm pack output');
    }
    
    const tarballPath = path.join(packageDir, tarballName);
    console.log(`[NPX Test] Package created: ${tarballPath}`);
    
    return tarballPath;
  } catch (error) {
    console.error('[NPX Test] Build/pack failed:', error);
    throw error;
  } finally {
    try {
      await execAsync('node scripts/prepare-pack.js restore', { cwd: ROOT });
    } catch (restoreError) {
      console.warn('[NPX Test] Warning restoring package.json:', restoreError);
    }
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
