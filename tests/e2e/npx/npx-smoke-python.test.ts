/**
 * NPX Python Smoke Tests
 * 
 * Tests Python debugging functionality when running via npx (npm pack)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAndPackNpmPackage, installPackageGlobally, createNpxMcpClient, cleanupGlobalInstall, getPackageSize } from './npx-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');

describe.sequential('NPX: Python Debugging Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  let sessionId: string | null = null;
  let tarballPath: string | null = null;

  beforeAll(async () => {
    console.log('[NPX Python] Building and packing npm package...');
    tarballPath = await buildAndPackNpmPackage();
    
    // Check package size
    const size = await getPackageSize(tarballPath);
    console.log(`[NPX Python] Package size: ${size.sizeMB.toFixed(2)} MB (${size.sizeKB.toFixed(2)} KB)`);
    
    console.log('[NPX Python] Installing package globally...');
    await installPackageGlobally(tarballPath);
    
    console.log('[NPX Python] Starting MCP server via npx...');
    const result = await createNpxMcpClient({
      logLevel: 'debug'
    });
    
    mcpClient = result.client;
    cleanup = result.cleanup;
    
    console.log('[NPX Python] MCP client connected');
  }, 120000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch {
        // Session may already be closed
      }
    }

    if (cleanup) {
      await cleanup();
    }
    
    // Cleanup global installation
    await cleanupGlobalInstall();

    console.log('[NPX Python] Cleanup completed');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await mcpClient.callTool({
          name: 'close_debug_session',
          arguments: { sessionId }
        });
      } catch {
        // Ignore cleanup errors
      }
      sessionId = null;
    }
  });

  it('should list supported languages including Python', async () => {
    const result = await mcpClient!.callTool({
      name: 'list_supported_languages',
      arguments: {}
    });
    
    const response = parseSdkToolResult(result);
    expect(response.success).toBe(true);
    expect(response.languages).toBeDefined();
    expect(Array.isArray(response.languages)).toBe(true);
    
    const languages = response.languages as any[];
    const pythonLang = languages.find(l => l.id === 'python');
    expect(pythonLang).toBeDefined();
    
    console.log('[NPX Python] ✓ Python language is available');
  });

  it('should complete full Python debugging cycle via npx', async () => {
    const scriptPath = path.join(ROOT, 'examples', 'python', 'simple_test.py');
    
    // Step 1: Create session
    console.log('[NPX Python] Creating session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'python',
        name: 'npx-python-smoke'
      }
    });
    
    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    expect(typeof createResponse.sessionId).toBe('string');
    sessionId = createResponse.sessionId as string;
    console.log('[NPX Python] ✓ Session created');

    // Step 2: Set breakpoint
    console.log('[NPX Python] Setting breakpoint...');
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 11
      }
    });
    
    const bpResponse = parseSdkToolResult(bpResult);
    console.log('[NPX Python] breakpoint response', bpResponse);
    expect(bpResponse.success).toBe(true);
    console.log('[NPX Python] ✓ Breakpoint set');

    // Step 3: Start debugging
    console.log('[NPX Python] Starting debugging...');
    const startResult = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath,
        args: [],
        dapLaunchArgs: {
          stopOnEntry: false,
          justMyCode: true
        }
      }
    });
    
    const startResponse = parseSdkToolResult(startResult);
    expect(startResponse.state).toBeDefined();
    expect(startResponse.state).toContain('paused');
    console.log('[NPX Python] ✓ Paused at breakpoint');

    // Wait for session to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Get variables before swap
    console.log('[NPX Python] Getting local variables...');
    const varsBeforeResult = await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: {
        sessionId,
        includeSpecial: false
      }
    });
    
    const varsBefore = parseSdkToolResult(varsBeforeResult);
    expect(varsBefore.variables).toBeDefined();
    
    const variables = varsBefore.variables as any[];
    const varA = variables.find(v => v.name === 'a');
    const varB = variables.find(v => v.name === 'b');
    
    expect(varA).toBeDefined();
    expect(varB).toBeDefined();
    expect(varA.value).toBe('1');
    expect(varB.value).toBe('2');
    
    console.log('[NPX Python] ✓ Variables before swap: a=1, b=2');

    // Step 5: Step over
    console.log('[NPX Python] Stepping over...');
    const stepResult = await mcpClient!.callTool({
      name: 'step_over',
      arguments: { sessionId }
    });
    
    const stepResponse = parseSdkToolResult(stepResult);
    expect(stepResponse.success).toBe(true);
    console.log('[NPX Python] ✓ Step executed');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 6: Get variables after swap
    console.log('[NPX Python] Getting variables after swap...');
    const varsAfterResult = await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: {
        sessionId,
        includeSpecial: false
      }
    });
    
    const varsAfter = parseSdkToolResult(varsAfterResult);
    const variablesAfter = varsAfter.variables as any[];
    const varAAfter = variablesAfter.find(v => v.name === 'a');
    const varBAfter = variablesAfter.find(v => v.name === 'b');
    
    expect(varAAfter.value).toBe('2');
    expect(varBAfter.value).toBe('1');
    
    console.log('[NPX Python] ✓ Variables after swap: a=2, b=1');

    // Step 7: Continue execution
    console.log('[NPX Python] Continuing execution...');
    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    
    const continueResponse = parseSdkToolResult(continueResult);
    expect(continueResponse.success).toBe(true);
    console.log('[NPX Python] ✓ Execution continued');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 8: Close session
    console.log('[NPX Python] Closing session...');
    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    
    const closeResponse = parseSdkToolResult(closeResult);
    expect(closeResponse.success).toBe(true);
    sessionId = null;
    console.log('[NPX Python] ✓ Session closed');

    console.log('[NPX Python] ✅ All checks passed');
  }, 120000);
});
