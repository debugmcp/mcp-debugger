/**
 * NPX Rust Smoke Tests (issue #383)
 *
 * Verifies that a plain npm/npx install delivers CodeLLDB via the
 * @debugmcp/codelldb-<platform> optionalDependency and that Rust debugging
 * works end-to-end from the installed package.
 *
 * Self-gating: skips until the platform package for this host is resolvable
 * on the npm registry at the pinned CodeLLDB version (i.e. before the first
 * release that publishes the five platform packages, or offline).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildAndPackNpmPackage,
  installPackageGlobally,
  createNpxMcpClient,
  cleanupGlobalInstall,
  getPackageSize
} from './npx-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import { prepareRustExample } from '../rust-example-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');

function currentCodelldbPlatformDir(): string | null {
  if (process.platform === 'win32') return 'win32-x64';
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (process.platform === 'linux') return process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  return null;
}

const platformDir = currentCodelldbPlatformDir();
const codelldbPin = (
  JSON.parse(
    readFileSync(path.join(ROOT, 'packages', 'codelldb-common', 'vendor-manifest.json'), 'utf8')
  ) as { codelldb: { version: string } }
).codelldb.version;

async function platformPackagePublished(): Promise<boolean> {
  if (!platformDir) return false;
  try {
    await execAsync(`npm view @debugmcp/codelldb-${platformDir}@${codelldbPin} version`);
    return true;
  } catch {
    return false;
  }
}

const packageAvailable = await platformPackagePublished();
if (!packageAvailable) {
  console.log(
    `[NPX Rust] Skipping: @debugmcp/codelldb-${platformDir}@${codelldbPin} not on the registry yet ` +
    '(arms automatically after the first release that publishes the platform packages)'
  );
}

describe.sequential.skipIf(!packageAvailable)('NPX: Rust Debugging Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    console.log('[NPX Rust] Building and packing npm package...');
    const tarballPath = await buildAndPackNpmPackage();

    const size = await getPackageSize(tarballPath);
    console.log(`[NPX Rust] Package size: ${size.sizeMB.toFixed(2)} MB`);

    console.log('[NPX Rust] Installing package globally...');
    await installPackageGlobally(tarballPath);

    const result = await createNpxMcpClient({ logLevel: 'debug' });
    mcpClient = result.client;
    cleanup = result.cleanup;
    console.log('[NPX Rust] MCP client connected');
  }, 240000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({ name: 'close_debug_session', arguments: { sessionId } });
      } catch {
        // Session may already be closed
      }
    }
    if (cleanup) {
      await cleanup();
    }
    await cleanupGlobalInstall();
    console.log('[NPX Rust] Cleanup completed');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({ name: 'close_debug_session', arguments: { sessionId } });
      } catch {
        // Ignore cleanup errors
      }
      sessionId = null;
    }
  });

  it('npm delivered the CodeLLDB platform package next to the installed CLI', async () => {
    const { stdout } = await execAsync('npm root -g');
    const globalRoot = stdout.trim();
    const exe = platformDir === 'win32-x64' ? 'codelldb.exe' : 'codelldb';
    // Global installs nest deps under the package; npm may also hoist.
    const candidates = [
      path.join(globalRoot, '@debugmcp', 'mcp-debugger', 'node_modules', '@debugmcp', `codelldb-${platformDir}`, 'adapter', exe),
      path.join(globalRoot, '@debugmcp', `codelldb-${platformDir}`, 'adapter', exe)
    ];
    const found = candidates.find((c) => existsSync(c));
    expect(found, `codelldb binary not found at: ${candidates.join(' | ')}`).toBeDefined();
    console.log(`[NPX Rust] ✓ Platform package payload at ${found}`);
  });

  it('completes a full Rust debugging cycle via the npx-installed CLI', async () => {
    const { sourcePath, binaryPath } = await prepareRustExample('hello_world');
    expect(existsSync(binaryPath)).toBe(true);

    const createResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'rust', name: 'npx-rust-smoke' }
    }));
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;

    const bpResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: sourcePath, line: 26 }
    }));
    expect(bpResponse.success).toBe(true);

    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: binaryPath,
        dapLaunchArgs: { stopOnEntry: false }
      }
    }));
    expect(startResponse.state).toContain('paused');
    console.log('[NPX Rust] ✓ Paused at breakpoint');

    const stackResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: { sessionId }
    }));
    expect(stackResponse.success).toBe(true);

    const continueResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    }));
    expect(continueResponse.success).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const closeResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    }));
    expect(closeResponse.success).toBe(true);
    sessionId = null;
    console.log('[NPX Rust] ✅ All checks passed');
  }, 180000);
});
