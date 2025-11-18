/**
 * NPX JavaScript Smoke Tests
 * 
 * Tests JavaScript debugging functionality when running via npx (npm pack)
 * This is the critical test that verifies the fix for the missing JavaScript adapter
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAndPackNpmPackage, installPackageGlobally, createNpxMcpClient, cleanupGlobalInstall } from './npx-test-utils.js';
import { parseSdkToolResult } from '../smoke-test-utils.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../..');

describe.sequential('NPX: JavaScript Debugging Smoke Tests', () => {
  let mcpClient: Client | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  let sessionId: string | null = null;
  let tarballPath: string | null = null;

  beforeAll(async () => {
    console.log('[NPX JavaScript] Building and packing npm package...');
    tarballPath = await buildAndPackNpmPackage();
    
    console.log('[NPX JavaScript] Installing package globally...');
    await installPackageGlobally(tarballPath);
    
    console.log('[NPX JavaScript] Starting MCP server via npx...');
    const result = await createNpxMcpClient({
      logLevel: 'debug'
    });
    
    mcpClient = result.client;
    let callSequence = 0;
    const originalCallTool = mcpClient.callTool.bind(mcpClient);
    mcpClient.callTool = async (request) => {
      const callId = ++callSequence;
      try {
        console.log(`[NPX JavaScript] callTool[${callId}] request`, JSON.stringify({
          name: request.name,
          arguments: request.arguments
        }));
      } catch {
        console.log(`[NPX JavaScript] callTool[${callId}] request (unserializable)`, request.name);
      }

      const response = await originalCallTool(request);

      try {
        console.log(`[NPX JavaScript] callTool[${callId}] response`, JSON.stringify(response));
      } catch {
        console.log(`[NPX JavaScript] callTool[${callId}] response (unserializable)`);
      }

      return response;
    };

    cleanup = result.cleanup;
    
    console.log('[NPX JavaScript] MCP client connected');
  }, 240000);

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

    console.log('[NPX JavaScript] Cleanup completed');
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

  it('should list supported languages including JavaScript', async () => {
    const result = await mcpClient!.callTool({
      name: 'list_supported_languages',
      arguments: {}
    });
    
    const response = parseSdkToolResult(result);
    expect(response.success).toBe(true);
    expect(response.languages).toBeDefined();
    expect(Array.isArray(response.languages)).toBe(true);
    
    const languages = response.languages as any[];
    const jsLang = languages.find(l => l.id === 'javascript');
    
    // This is the critical check - JavaScript must be available!
    expect(jsLang).toBeDefined();
    expect(jsLang.displayName).toBe('JavaScript/TypeScript');
    
    console.log('[NPX JavaScript] ✓ JavaScript language is available');
    console.log('[NPX JavaScript] ✓ CRITICAL FIX VERIFIED: JavaScript adapter is now included in npx distribution!');
  });

  it('should complete full JavaScript debugging cycle via npx', async () => {
    const scriptPath = path.join(ROOT, 'examples', 'javascript', 'simple_test.js');
    
    // Step 1: Create session
    console.log('[NPX JavaScript] Creating session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'npx-javascript-smoke'
      }
    });
    
    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    expect(typeof createResponse.sessionId).toBe('string');
    sessionId = createResponse.sessionId as string;
    console.log('[NPX JavaScript] Session created', sessionId);

    // Step 2: Set breakpoint
    console.log('[NPX JavaScript] Setting breakpoint...');
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: scriptPath,
        line: 14
      }
    });
    
    try {
      await import('fs/promises').then(fs =>
        fs.writeFile(
          path.join(ROOT, 'logs', 'last-bp-raw.json'),
          JSON.stringify(bpResult, null, 2)
        )
      );
    } catch {
      // ignore logging errors
    }
    const bpResponse = parseSdkToolResult(bpResult);
    console.log('[NPX JavaScript] breakpoint response', bpResponse);
    expect(bpResponse.success).toBe(true);
    console.log('[NPX JavaScript] ✓ Breakpoint set');

    // Step 3: Start debugging
    console.log('[NPX JavaScript] Starting debugging...');
    const startResult = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath,
        args: []
      }
    });
    
    const startResponse = parseSdkToolResult(startResult);
    expect(startResponse.state).toBeDefined();
    expect(startResponse.state).toContain('paused');
    console.log('[NPX JavaScript] ✓ Paused at breakpoint');

    // Wait for session to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Get variables before swap
    console.log('[NPX JavaScript] Getting local variables...');
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
    
    console.log('[NPX JavaScript] ✓ Variables before swap: a=1, b=2');

    // Step 5: Step over
    console.log('[NPX JavaScript] Stepping over...');
    const stepResult = await mcpClient!.callTool({
      name: 'step_over',
      arguments: { sessionId }
    });
    
    const stepResponse = parseSdkToolResult(stepResult);
    expect(stepResponse.success).toBe(true);
    console.log('[NPX JavaScript] ✓ Step executed');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Get variables after swap
    console.log('[NPX JavaScript] Getting variables after swap...');
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
    
    console.log('[NPX JavaScript] ✓ Variables after swap: a=2, b=1');

    // Step 7: Continue execution
    console.log('[NPX JavaScript] Continuing execution...');
    const continueResult = await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });
    
    const continueResponse = parseSdkToolResult(continueResult);
    expect(continueResponse.success).toBe(true);
    console.log('[NPX JavaScript] ✓ Execution continued');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 8: Close session
    console.log('[NPX JavaScript] Closing session...');
    const closeResult = await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    
    const closeResponse = parseSdkToolResult(closeResult);
    expect(closeResponse.success).toBe(true);
    sessionId = null;
    console.log('[NPX JavaScript] ✓ Session closed');

    console.log('[NPX JavaScript] ✅ All checks passed - JavaScript debugging works via npx!');
  }, 120000);
});
