/**
 * Ruby Adapter Smoke Tests via MCP Interface
 *
 * Tests core Ruby debugging functionality through MCP tools against a real
 * rdbg (debug gem). Validates the full launch flow:
 * - Adapter loads through AdapterLoader (registration wiring)
 * - Breakpoints bind and fire (including the entry-stop auto-continue)
 * - Stack traces, local variables ("Local variables" scope), and
 *   expression evaluation (repl context) work
 * - Step over and continue behave
 *
 * Skips gracefully when Ruby/rdbg is not installed. Discovery uses the
 * adapter's own finders so the gate matches what the server will find.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely, pollUntil } from './smoke-test-utils.js';
import { findRubyExecutable, findRdbgExecutable } from '@debugmcp/adapter-ruby';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

async function rubyToolchainAvailable(): Promise<boolean> {
  try {
    await findRubyExecutable();
    await findRdbgExecutable();
    return true;
  } catch {
    return false;
  }
}

describe('MCP Server Ruby Debugging Smoke Test @requires-ruby', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let sessionId: string | null = null;

  beforeAll(async () => {
    console.log('[Ruby Smoke Test] Starting MCP server...');

    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    mcpClient = new Client({
      name: 'ruby-smoke-test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log('[Ruby Smoke Test] MCP client connected');
  }, 30000);

  afterAll(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
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

    console.log('[Ruby Smoke Test] Cleanup completed');
  });

  afterEach(async () => {
    if (sessionId && mcpClient) {
      try {
        await callToolSafely(mcpClient, 'close_debug_session', { sessionId });
      } catch {
        // Session may already be closed
      }
      sessionId = null;
    }
  });

  it('should create Ruby debug session through MCP interface', async () => {
    // Fails if the Ruby adapter is not registered in the loader/dependencies
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: {
        language: 'ruby',
        name: 'ruby-smoke-test'
      }
    });

    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;
  });

  it('should list Ruby adapter in supported languages', async () => {
    const listResult = await mcpClient!.callTool({
      name: 'list_supported_languages',
      arguments: {}
    });

    const listResponse = parseSdkToolResult(listResult) as {
      available?: Array<{ language: string }>;
      languages?: Array<{ id?: string } | string>;
    };
    const available = listResponse.available?.map(a => a.language) ?? [];
    const languages = (listResponse.languages ?? []).map(l => (typeof l === 'string' ? l : l.id));

    expect([...available, ...languages]).toContain('ruby');
  });

  it('should complete a full Ruby debugging flow with rdbg', async () => {
    if (!(await rubyToolchainAvailable())) {
      console.log('[Ruby Smoke Test] Ruby/rdbg not available, skipping full flow test');
      return;
    }

    const testRubyFile = path.resolve(ROOT, 'examples', 'ruby', 'fizzbuzz.rb');

    // 1. Create session
    const createResult = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'ruby', name: 'ruby-full-flow-test' }
    });
    const createResponse = parseSdkToolResult(createResult);
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;

    // 2. Conditional breakpoint inside the loop body
    const bpResult = await mcpClient!.callTool({
      name: 'set_breakpoint',
      arguments: {
        sessionId,
        file: testRubyFile,
        line: 15, // value = fizzbuzz_for(i)
        condition: 'i == 6'
      }
    });
    const bpResponse = parseSdkToolResult(bpResult);
    expect(bpResponse.success).toBe(true);

    // 3. Start debugging (stopOnEntry defaults false: the rdbg stop-at-load
    // pause must be auto-continued and execution must run to the breakpoint)
    const startResult = await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: { sessionId, scriptPath: testRubyFile }
    });
    const startResponse = parseSdkToolResult(startResult) as {
      state?: string;
      data?: { reason?: string };
    };
    expect(startResponse.state).toBe('paused');
    expect(startResponse.data?.reason).toBe('breakpoint');

    // 4. Stack trace: top frame in the main loop at the breakpoint line
    const stackResult = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId });
    const frames = stackResult.stackFrames as Array<{ file: string; line: number }>;
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0].line).toBe(15);
    expect(frames[0].file.replace(/\\/g, '/')).toContain('examples/ruby/fizzbuzz.rb');

    // 5. Locals: the rdbg "Local variables" scope must surface i and results,
    // and the breakpoint condition must hold (i == 6, 5 results so far)
    const varsResult = await callToolSafely(mcpClient!, 'get_local_variables', { sessionId });
    const variables = varsResult.variables as Array<{ name: string; value: string }>;
    const i = variables.find(v => v.name === 'i');
    const results = variables.find(v => v.name === 'results');
    expect(i?.value).toBe('6');
    expect(results?.value).toContain('Buzz');

    // 6. Evaluate (repl context; 'variables' is rejected by rdbg)
    const evalResult = await callToolSafely(mcpClient!, 'evaluate_expression', {
      sessionId,
      expression: 'results.length * 100 + i'
    });
    expect(evalResult.result).toBe('506');

    // 7. Step over advances one line
    const stepResult = await callToolSafely(mcpClient!, 'step_over', { sessionId });
    expect((stepResult.location as { line: number } | undefined)?.line).toBe(16);

    // 8. Continue to completion (no further matching breakpoints)
    const contResult = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    expect(contResult.success).toBe(true);

    // 9. Debuggee output must be retrievable (issue #222): rdbg -c gives the
    // debuggee the adapter process's stdio, which the proxy forwards as
    // synthesized output events. Wait for the script to finish and flush.
    await new Promise(resolve => setTimeout(resolve, 3000));
    const outputResult = await callToolSafely(mcpClient!, 'get_output', { sessionId });
    expect(outputResult.success).toBe(true);
    const outputEntries = outputResult.entries as Array<{ category: string; output: string }>;
    const fizzEntry = outputEntries.find(e => e.output.includes('6: Fizz'));
    expect(fizzEntry).toBeDefined();
    expect(fizzEntry!.category).toBe('stdout');
    const warnEntry = outputEntries.find(e => e.output.includes('fizzbuzz complete'));
    expect(warnEntry).toBeDefined();
    expect(warnEntry!.category).toBe('stderr');
    // rdbg's own banners must stay out of the output buffer
    expect(outputEntries.some(e => e.output.startsWith('DEBUGGER:'))).toBe(false);
  }, 90000); // Ruby interpreter startup under rdbg takes several seconds

  it('streams debuggee stdout while paused at a breakpoint (issue #317)', async () => {
    if (!(await rubyToolchainAvailable())) {
      console.log('[Ruby Smoke Test] Ruby/rdbg not available, skipping mid-run output test');
      return;
    }

    const testRubyFile = path.resolve(ROOT, 'examples', 'ruby', 'fizzbuzz.rb');

    const createResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'ruby', name: 'ruby-midrun-output-test' }
    }));
    expect(createResponse.sessionId).toBeDefined();
    sessionId = createResponse.sessionId as string;

    // Unconditional breakpoint inside the loop: fires at iteration 1 BEFORE
    // that iteration's puts runs.
    const bpResponse = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      file: testRubyFile,
      line: 15 // value = fizzbuzz_for(i)
    });
    expect(bpResponse.success).toBe(true);

    const startResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'start_debugging',
      arguments: { sessionId, scriptPath: testRubyFile }
    })) as { state?: string };
    expect(startResponse.state).toBe('paused');

    // Continue: iteration 1 executes `puts "1: 1"`, then the re-armed
    // breakpoint stops iteration 2 — the process stays alive and paused.
    await callToolSafely(mcpClient!, 'continue_execution', { sessionId });

    // Ruby block-buffers $stdout on pipes; without the injected sync prelude
    // this line would only flush at process exit and the poll would time out.
    const marker = await pollUntil(async () => {
      const out = await callToolSafely(mcpClient!, 'get_output', { sessionId });
      const entries = (out.entries ?? []) as Array<{ category: string; output: string }>;
      return entries.find(e => e.output.includes('1: 1'));
    }, 15000);

    expect(marker).toBeDefined();
    expect(marker!.category).toBe('stdout');

    // Prove mid-run capture: the session must still be paused (iteration 2's
    // stop), so the marker cannot have arrived via the exit-flush drain.
    const listResponse = parseSdkToolResult(await mcpClient!.callTool({
      name: 'list_debug_sessions',
      arguments: {}
    })) as { sessions?: Array<{ id: string; state: string }> };
    expect(listResponse.sessions?.find(s => s.id === sessionId)?.state).toBe('paused');
  }, 90000);
});
