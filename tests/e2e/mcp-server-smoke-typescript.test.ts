/**
 * TypeScript Source Map Debugging Smoke Tests
 *
 * These tests verify REAL TypeScript debugging with source maps:
 * - Setting breakpoints on .ts files
 * - Getting .ts file paths in stack traces
 * - Seeing original TypeScript variable names
 *
 * Reference: docs/javascript/typescript-source-map-investigation.md
 *
 * NOTE: These tests may initially fail as full source map support is under development.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult } from './smoke-test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('TypeScript Source Map Debugging - Real Workflow', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    console.log('[TS SourceMap] Starting MCP server...');

    transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'ts-sourcemap-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[TS SourceMap] MCP client connected');
  }, 30000);

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

    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }

    console.log('[TS SourceMap] Cleanup completed');
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

  it('should set breakpoints on .ts files and resolve via source maps', async () => {
    const tsSourcePath = path.join(ROOT, 'examples', 'javascript', 'typescript_test.ts');
    const jsCompiledPath = path.join(ROOT, 'examples', 'javascript', 'typescript_test.js');

    console.log('[TS SourceMap] TypeScript source:', tsSourcePath);
    console.log('[TS SourceMap] Compiled JavaScript:', jsCompiledPath);

    // Create session
    console.log('[TS SourceMap] Creating JavaScript debug session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'javascript',
        name: 'ts-sourcemap-test'
      }
    });

    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;
    console.log('[TS SourceMap] ✓ Session created:', sessionId);

    // THE KEY TEST: Set breakpoint on .TS file (not .js)
    // Line 18 in typescript_test.ts: const result = a + b; (in Calculator.add method)
    console.log('[TS SourceMap] Setting breakpoint on .TS file at line 18...');
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: tsSourcePath,  // .TS file!
        line: 18
      }
    });

    const bpResponse = parseSdkToolResult(bpResult);
    console.log('[TS SourceMap] Breakpoint response:', JSON.stringify(bpResponse, null, 2));
    expect(bpResponse.success).toBe(true);
    console.log('[TS SourceMap] ✓ Breakpoint set on TypeScript source file');

    // Start debugging the COMPILED .js file
    // The debugger should use source maps to map breakpoints from .ts to .js
    console.log('[TS SourceMap] Starting debugging of compiled JS...');
    const startResult = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: jsCompiledPath,  // Run the .js file
        args: [],
        dapLaunchArgs: {
          stopOnEntry: false,
          justMyCode: true,
          // Enable source maps explicitly
          sourceMaps: true,
          outFiles: ['**/*.js'],
          resolveSourceMapLocations: ['**', '!**/node_modules/**']
        }
      }
    });

    const startResponse = parseSdkToolResult(startResult);
    console.log('[TS SourceMap] Start response:', JSON.stringify(startResponse, null, 2));

    if (startResponse.state === 'error' || startResponse.error) {
      console.error('[TS SourceMap] ❌ Error:', startResponse.error || startResponse.message);
      throw new Error(`Failed to start: ${startResponse.error || startResponse.message}`);
    }

    expect(startResponse.state).toContain('paused');
    console.log('[TS SourceMap] ✓ Paused at breakpoint');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // CRITICAL TEST: Stack trace should show .TS file paths, not .js
    console.log('[TS SourceMap] Getting stack trace - should show .TS paths...');
    const stackResult = await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: {
        sessionId,
        includeInternals: false
      }
    });

    const stackResponse = parseSdkToolResult(stackResult);
    console.log('[TS SourceMap] Stack response:', JSON.stringify(stackResponse, null, 2));

    expect(stackResponse.stackFrames).toBeDefined();
    expect(Array.isArray(stackResponse.stackFrames)).toBe(true);
    const frames = stackResponse.stackFrames as any[];
    expect(frames.length).toBeGreaterThan(0);

    const topFrame = frames[0];
    console.log('[TS SourceMap] Top frame:', JSON.stringify(topFrame, null, 2));

    // THE KEY ASSERTION: Frame should reference .TS file, not .js
    const framePath = topFrame.source?.path || topFrame.file || '';
    console.log('[TS SourceMap] Frame file path:', framePath);

    expect(framePath).toContain('typescript_test.ts');
    expect(framePath).not.toContain('typescript_test.js');

    // Line number should be TypeScript line (18), not compiled JS line
    expect(topFrame.line).toBe(18);

    console.log('[TS SourceMap] ✓ Stack trace correctly shows TypeScript source!');

    // Test variable inspection - should show original TS names
    console.log('[TS SourceMap] Getting variables - should show original names...');
    const varsResult = await mcpClient!.callTool({
      name: 'get_local_variables',
      arguments: {
        sessionId,
        includeSpecial: false
      }
    });

    const varsResponse = parseSdkToolResult(varsResult);
    console.log('[TS SourceMap] Variables:', JSON.stringify(varsResponse, null, 2));

    const variables = varsResponse.variables as any[];
    const varNames = variables.map((v: any) => v.name);
    console.log('[TS SourceMap] Variable names:', varNames);

    // Should have 'a', 'b', 'this' - NOT transpiled names like '_a', '_b'
    expect(varNames).toContain('a');
    expect(varNames).toContain('b');
    console.log('[TS SourceMap] ✓ Original TypeScript variable names visible');

    // Step over and check location still shows .ts
    console.log('[TS SourceMap] Stepping over...');
    const stepResult = await mcpClient!.callTool({
      name: 'step_over',
      arguments: { sessionId }
    });

    const stepResponse = parseSdkToolResult(stepResult);
    console.log('[TS SourceMap] Step response:', JSON.stringify(stepResponse, null, 2));

    if (stepResponse.location) {
      const stepFile = stepResponse.location.file || '';
      console.log('[TS SourceMap] Step location file:', stepFile);
      expect(stepFile).toContain('typescript_test.ts');
      console.log('[TS SourceMap] ✓ Step location shows TypeScript source');
    }

    // Cleanup
    console.log('[TS SourceMap] Closing session...');
    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;

    console.log('[TS SourceMap] ✅ All TypeScript source map assertions passed!');
  }, 90000);

  it('should handle multiple TypeScript breakpoints with source maps', async () => {
    const tsSourcePath = path.join(ROOT, 'examples', 'javascript', 'typescript_test.ts');
    const jsCompiledPath = path.join(ROOT, 'examples', 'javascript', 'typescript_test.js');

    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'javascript', name: 'ts-multi-bp' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;

    // Set breakpoint on .TS line 18 (Calculator.add)
    console.log('[TS SourceMap] Setting breakpoint on TS line 18...');
    const bp1 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: tsSourcePath, line: 18 }
    });
    expect(parseSdkToolResult(bp1).success).toBe(true);

    // Set breakpoint on .TS line 24 (Calculator.multiply)
    console.log('[TS SourceMap] Setting breakpoint on TS line 24...');
    const bp2 = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: tsSourcePath, line: 24 }
    });
    expect(parseSdkToolResult(bp2).success).toBe(true);

    console.log('[TS SourceMap] ✓ Multiple TypeScript breakpoints set');

    // Start debugging
    await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: jsCompiledPath,
        dapLaunchArgs: {
          stopOnEntry: false,
          sourceMaps: true,
          outFiles: ['**/*.js']
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Should hit first breakpoint
    const stack1 = await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: { sessionId, includeInternals: false }
    });
    const frames1 = parseSdkToolResult(stack1).stackFrames as any[];
    console.log('[TS SourceMap] Stack frames:', JSON.stringify(frames1, null, 2));

    // These assertions MUST run - no conditional
    expect(frames1).toBeDefined();
    expect(Array.isArray(frames1)).toBe(true);
    expect(frames1.length).toBeGreaterThan(0);

    const framePath = frames1[0].source?.path || frames1[0].file || '';
    console.log('[TS SourceMap] Frame path:', framePath);

    // THE CRITICAL ASSERTION: Must show .ts file
    expect(framePath).toContain('.ts');
    expect(framePath).not.toContain('.js');
    console.log('[TS SourceMap] ✓ First breakpoint shows TS source!');

    // Continue to second breakpoint
    await mcpClient!.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    const stack2 = await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: { sessionId, includeInternals: false }
    });
    const frames2 = parseSdkToolResult(stack2).stackFrames as any[];

    expect(frames2).toBeDefined();
    expect(Array.isArray(frames2)).toBe(true);
    expect(frames2.length).toBeGreaterThan(0);

    const framePath2 = frames2[0].source?.path || frames2[0].file || '';
    expect(framePath2).toContain('.ts');
    expect(framePath2).not.toContain('.js');
    console.log('[TS SourceMap] ✓ Second breakpoint shows TS source');

    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  }, 90000);

  it('should handle TypeScript async/await with source maps', async () => {
    const tsSourcePath = path.join(ROOT, 'examples', 'javascript', 'typescript_test.ts');
    const jsCompiledPath = path.join(ROOT, 'examples', 'javascript', 'typescript_test.js');

    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'javascript', name: 'ts-async' }
    });
    sessionId = parseSdkToolResult(createResult).sessionId as string;

    // Set breakpoint in async function (line 50 - inside fetchData)
    console.log('[TS SourceMap] Setting breakpoint in async function (TS line 50)...');
    const bp = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: tsSourcePath, line: 50 }
    });
    expect(parseSdkToolResult(bp).success).toBe(true);

    await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: {
        sessionId,
        scriptPath: jsCompiledPath,
        dapLaunchArgs: {
          stopOnEntry: false,
          sourceMaps: true,
          outFiles: ['**/*.js']
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Should pause in async function showing TS source
    const stack = await mcpClient!.callTool({
      name: 'get_stack_trace',
      arguments: { sessionId, includeInternals: false }
    });

    const frames = parseSdkToolResult(stack).stackFrames as any[];

    expect(frames).toBeDefined();
    expect(Array.isArray(frames)).toBe(true);
    expect(frames.length).toBeGreaterThan(0);

    const framePath = frames[0].source?.path || frames[0].file || '';
    console.log('[TS SourceMap] Async frame path:', framePath);
    expect(framePath).toContain('typescript_test.ts');
    expect(framePath).not.toContain('typescript_test.js');
    console.log('[TS SourceMap] ✓ Async function shows TypeScript source');

    await mcpClient!.callTool({
      name: 'close_debug_session',
      arguments: { sessionId }
    });
    sessionId = null;
  }, 90000);
});
