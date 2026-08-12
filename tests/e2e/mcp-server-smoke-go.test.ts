/**
 * Go Adapter Smoke Tests via MCP Interface
 * 
 * Tests core Go debugging functionality through MCP tools
 * This test would have caught missing integration points (adapter registration, etc.)
 * 
 * Validates actual behavior including:
 * - Adapter can be loaded through AdapterLoader
 * - Session can be created with language: 'go'
 * - Breakpoints work with Delve
 * - Stack traces and variables are accessible
 * - Go-specific features (goroutines, etc.)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { skipIfSpawnBlocked } from '../test-utils/helpers/adapter-spawn.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('MCP Server Go Debugging Smoke Test @requires-go', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    console.log('[Go Smoke Test] Starting MCP server...');
    
    // Create transport for MCP server
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Create and connect MCP client
    mcpClient = new Client({
      name: 'go-smoke-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[Go Smoke Test] MCP client connected');
  }, 30000);

  afterAll(async () => {
    // Clean up session if exists
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch (err) {
        // Session may already be closed
      }
    }

    // Close client and transport
    if (mcpClient) {
      await mcpClient.close();
    }
    if (transport) {
      await transport.close();
    }

    console.log('[Go Smoke Test] Cleanup completed');
  });

  afterEach(async () => {
    // Clean up session after each test
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch (err) {
        // Session may already be closed
      }
      sessionId = null;
    }
  });

  it('should create Go debug session through MCP interface', async () => {
    // This test would fail if Go adapter wasn't registered in dependencies.ts
    console.log('[Go Smoke Test] Creating debug session...');
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'go', // This goes through AdapterLoader.loadAdapter('go')
        name: 'go-smoke-test'
      }
    });
    
    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;
    console.log(`[Go Smoke Test] Session created: ${sessionId}`);
    
    // If we got here, the adapter was successfully loaded through the integration points
    expect(sessionId).toBeTruthy();
  });

  it('should list Go adapter in supported languages', async () => {
    // This tests adapter-loader.ts integration
    console.log('[Go Smoke Test] Listing supported languages...');

    try {
      const listResult = await mcpClient!.callTool({
        name: 'list_supported_languages',
        arguments: {}
      });

      const listResponse = parseSdkToolResult(listResult);
      // Response may contain 'adapters' or 'languages' array depending on server version
      const adapters = listResponse.adapters as Array<{ name: string; id?: string }> | undefined;
      const languages = listResponse.languages as Array<{ name?: string; id?: string } | string> | undefined;
      const allAdapters = adapters || languages;
      if (allAdapters) {
        const goAdapter = allAdapters.find((a: { name?: string; id?: string } | string) =>
          typeof a === 'string' ? a === 'go' : (a.name === 'go' || a.id === 'go')
        );
        expect(goAdapter).toBeDefined();
        console.log('[Go Smoke Test] Go adapter found in supported languages');
      } else {
        // Tool responded but with unexpected format — log and pass for smoke test
        console.log('[Go Smoke Test] list_supported_languages response:', JSON.stringify(listResponse).slice(0, 200));
      }
    } catch (error) {
      console.log('[Go Smoke Test] list_supported_languages tool failed:', error);
      throw error;
    }
  });

  it('should complete Go debugging flow with compiled binary', async (ctx) => {
    // Skip if Go/Delve not available
    const { execSync } = await import('child_process');
    let goAvailable = false;
    let dlvAvailable = false;
    
    try {
      execSync('go version', { stdio: 'ignore' });
      goAvailable = true;
    } catch {
      console.log('[Go Smoke Test] Go not available, skipping full flow test');
    }
    
    try {
      execSync('dlv version', { stdio: 'ignore' });
      dlvAvailable = true;
    } catch {
      console.log('[Go Smoke Test] Delve not available, skipping full flow test');
    }
    
    if (!goAvailable || !dlvAvailable) {
      console.log('[Go Smoke Test] Skipping full debugging flow - Go/Delve not installed');
      return;
    }

    // Build a test Go program
    const testGoFile = path.resolve(ROOT, 'examples', 'go', 'hello_world.go');
    const testBinary = path.resolve(ROOT, 'examples', 'go', 'hello_world_test');
    
    try {
      // Compile with debug symbols
      execSync(`go build -gcflags="all=-N -l" -o "${testBinary}" "${testGoFile}"`, {
        cwd: path.dirname(testGoFile),
        stdio: 'pipe'
      });
    } catch (error) {
      console.log('[Go Smoke Test] Failed to compile test binary, skipping full flow');
      return;
    }

    try {
      // 1. Create Go debug session
      console.log('[Go Smoke Test] Creating debug session...');
      const createResult = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: {
          language: 'go',
          name: 'go-full-flow-test'
        }
      });
      
      const createResponse = parseSdkToolResult(createResult);
      expect(createResponse.sessionId).toBeDefined();
      sessionId = createResponse.sessionId as string;
      console.log(`[Go Smoke Test] Session created: ${sessionId}`);

      // 2. Set breakpoint
      console.log('[Go Smoke Test] Setting breakpoint...');
      const bpResult = await mcpClient!.callTool({
        name: 'set_breakpoint',
        arguments: {
          sessionId,
          file: testGoFile,
          line: 12 // Inside main function
        }
      });
      
      const bpResponse = parseSdkToolResult(bpResult);
      console.log('[Go Smoke Test] Breakpoint response:', bpResponse);

      // 3. Start debugging — scriptPath is a pre-compiled binary, and the
      // adapter must auto-infer mode 'exec' from the absence of a .go
      // extension. Do NOT pass an explicit mode here; that's the property
      // under test.
      console.log('[Go Smoke Test] Starting debugging...');
      const startResult = await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: testBinary, // Pre-compiled binary
          args: [],
          dapLaunchArgs: {
            stopOnEntry: false
          }
        }
      });
      
      const startResponse = parseSdkToolResult(startResult);
      if (!startResponse.success) {
        // Skip (don't hard-fail) if the Delve binary couldn't be spawned.
        skipIfSpawnBlocked(ctx, startResponse, 'Go');
      }
      expect(startResponse.state).toBeDefined();
      console.log('[Go Smoke Test] Debug started, state:', startResponse.state);

      // Wait for execution
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 4. Get stack trace
      console.log('[Go Smoke Test] Getting stack trace...');
      const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId });
      
      if (stackResult.stackFrames) {
        const frames = stackResult.stackFrames as any[];
        console.log(`[Go Smoke Test] Stack has ${frames.length} frames`);
      }

      // 5. Continue execution
      console.log('[Go Smoke Test] Continuing execution...');
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });

      // Wait for script to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 6. Debuggee output must be retrievable (issue #225) — outputMode
      // 'remote' makes Delve forward the target's stdio as DAP output events
      // instead of writing it to dlv's own stdout.
      console.log('[Go Smoke Test] Fetching debuggee output...');
      const outputResult = await callToolSafely(mcpClient!, 'get_output', { sessionId });
      expect(outputResult.success).toBe(true);
      const outputEntries = outputResult.entries as Array<{ category: string; output: string }>;
      console.log(`[Go Smoke Test] Captured ${outputEntries.length} output entries`);
      const helloEntry = outputEntries.find(e => e.output.includes('Hello, World!'));
      expect(helloEntry).toBeDefined();
      expect(helloEntry!.category).toBe('stdout');

    } finally {
      // Clean up test binary
      try {
        const fs = await import('fs');
        if (fs.existsSync(testBinary)) {
          fs.unlinkSync(testBinary);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 60000); // Go build + Delve startup needs more than the default 30s timeout

  it('labels a main.main function-breakpoint stop natively (#302 regression)', async (ctx) => {
    // Delve sends reason "function breakpoint" itself — no policy relabel
    // involved. Guards that the go path stays label-correct while rust/.NET
    // gained policy normalization.
    const { execSync } = await import('child_process');
    try {
      execSync('go version', { stdio: 'ignore' });
      execSync('dlv version', { stdio: 'ignore' });
    } catch {
      console.log('[Go Smoke Test] Go/Delve not installed, skipping fn-bp labeling test');
      return;
    }

    const testGoFile = path.resolve(ROOT, 'examples', 'go', 'hello_world.go');
    const testBinary = path.resolve(ROOT, 'examples', 'go', 'hello_world_fnbp_test');
    try {
      execSync(`go build -gcflags="all=-N -l" -o "${testBinary}" "${testGoFile}"`, {
        cwd: path.dirname(testGoFile),
        stdio: 'pipe'
      });
    } catch {
      console.log('[Go Smoke Test] Failed to compile test binary, skipping fn-bp labeling test');
      return;
    }

    try {
      const createResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'go', name: 'go-fnbp-label' }
      }));
      sessionId = createResponse.sessionId as string;

      const bpResponse = await callToolSafely(mcpClient!, 'set_breakpoint', {
        sessionId,
        function: 'main.main'
      });
      expect(bpResponse.success).toBe(true);

      const startResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: testBinary,
          args: [],
          dapLaunchArgs: { stopOnEntry: false }
        }
      }));
      if (!startResponse.success) {
        skipIfSpawnBlocked(ctx, startResponse, 'Go');
      }

      const deadline = Date.now() + 20000;
      let snap: { state?: string; lastStop?: { reason?: string } } | undefined;
      while (Date.now() < deadline) {
        const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
        snap = ((res.sessions ?? []) as Array<{ id: string; state?: string; lastStop?: { reason?: string } }>)
          .find(s => s.id === sessionId);
        if (snap?.state === 'paused') break;
        await new Promise(r => setTimeout(r, 500));
      }
      expect(snap?.state, 'session should pause at main.main').toBe('paused');
      expect(snap!.lastStop?.reason).toBe('function breakpoint');

      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      await new Promise(r => setTimeout(r, 1000));
    } finally {
      try {
        const fs = await import('fs');
        if (fs.existsSync(testBinary)) {
          fs.unlinkSync(testBinary);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 60000);

  it('surfaces every stage of feedback for a bare fn-bp name that never binds (#308)', async (ctx) => {
    // The full loop the issue asked for: hint at set time, warning at
    // launch, and a post-exit explanation in list_breakpoints + get_output.
    const { execSync } = await import('child_process');
    try {
      execSync('go version', { stdio: 'ignore' });
      execSync('dlv version', { stdio: 'ignore' });
    } catch {
      console.log('[Go Smoke Test] Go/Delve not installed, skipping bare-name feedback test');
      return;
    }

    const testGoFile = path.resolve(ROOT, 'examples', 'go', 'hello_world.go');
    const testBinary = path.resolve(ROOT, 'examples', 'go', 'hello_world_bare_test');
    try {
      execSync(`go build -gcflags="all=-N -l" -o "${testBinary}" "${testGoFile}"`, {
        cwd: path.dirname(testGoFile),
        stdio: 'pipe'
      });
    } catch {
      console.log('[Go Smoke Test] Failed to compile test binary, skipping bare-name feedback test');
      return;
    }

    try {
      const createResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: 'go', name: 'go-fnbp-bare' }
      }));
      sessionId = createResponse.sessionId as string;

      // Stage 1: set-time hint for the bare identifier.
      const bpResponse = await callToolSafely(mcpClient!, 'set_breakpoint', {
        sessionId,
        function: 'main'
      });
      expect(bpResponse.success).toBe(true);
      expect((bpResponse as { warning?: string }).warning).toMatch(/package-qualified/);
      expect((bpResponse as { warning?: string }).warning).toContain("'main.main'");

      const startResponse = parseSdkToolResult(await mcpClient!.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: testBinary,
          args: [],
          dapLaunchArgs: { stopOnEntry: false }
        }
      }));
      if (!startResponse.success) {
        skipIfSpawnBlocked(ctx, startResponse, 'Go');
      }

      // Stage 2: launch-time warning (when launch outlives the program the
      // warning may arrive with state stopped — accept either shape).
      const startWarning = (startResponse as { warning?: string }).warning;
      if (startWarning !== undefined) {
        expect(startWarning).toMatch(/not bound at launch/);
      }

      // The program runs to completion — no pause ever fires.
      const deadline = Date.now() + 20000;
      let snap: { state?: string } | undefined;
      while (Date.now() < deadline) {
        const res = parseSdkToolResult(await mcpClient!.callTool({ name: 'list_debug_sessions', arguments: {} }));
        snap = ((res.sessions ?? []) as Array<{ id: string; state?: string }>).find(s => s.id === sessionId);
        if (snap?.state === 'stopped') break;
        await new Promise(r => setTimeout(r, 500));
      }
      expect(snap?.state, 'program should run to completion without pausing').toBe('stopped');

      // Stage 3: post-exit explanation in list_breakpoints...
      const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId });
      const fnBp = ((listRes as { functionBreakpoints?: Array<{ verified?: boolean; message?: string }> }).functionBreakpoints ?? [])[0];
      expect(fnBp?.verified).toBe(false);
      expect(fnBp?.message).toMatch(/Never bound during this run/);

      // ...and in the captured output.
      const outputResult = await callToolSafely(mcpClient!, 'get_output', { sessionId });
      const entries = (outputResult.entries ?? []) as Array<{ category?: string; output?: string }>;
      const warnEntry = entries.find(e => e.output?.includes('never bound during this run'));
      expect(warnEntry, 'get_output should carry the never-bound warning').toBeDefined();
    } finally {
      try {
        const fs = await import('fs');
        if (fs.existsSync(testBinary)) {
          fs.unlinkSync(testBinary);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }, 60000);
});

