#!/usr/bin/env node
/**
 * Exploratory Test: Local SSE Mode
 * Tests Python, JavaScript, Go debugging + edge cases
 *
 * Usage: node tests/exploratory/test-local-sse.mjs
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import {
  ROOT, findAvailablePort, waitForHealth, sleep,
  connectSSEClient, callTool, callToolSafe,
  createTestRunner, assert, assertDefined
} from './helpers.mjs';

const { runTest, printSummary } = createTestRunner();

async function main() {
  console.log('='.repeat(50));
  console.log('  Exploratory Test: Local SSE Mode');
  console.log('='.repeat(50));
  console.log(`  Project root: ${ROOT}`);
  console.log(`  Platform: ${process.platform}`);
  console.log('');

  // Start SSE server
  const port = await findAvailablePort();
  console.log(`  Starting SSE server on port ${port}...`);

  const serverProc = spawn(process.execPath, [
    path.join(ROOT, 'dist', 'index.js'),
    'sse', '-p', port.toString()
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT
  });

  let serverOutput = '';
  serverProc.stdout.on('data', d => { serverOutput += d.toString(); });
  serverProc.stderr.on('data', d => { serverOutput += d.toString(); });

  // Handle server crash
  serverProc.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`  Server exited unexpectedly: code=${code} signal=${signal}`);
    }
  });

  const healthy = await waitForHealth(port, 20000);
  if (!healthy) {
    console.error('Server failed to start. Output:');
    console.error(serverOutput);
    serverProc.kill();
    process.exit(1);
  }
  console.log(`  Server healthy on port ${port}\n`);

  // Connect MCP client
  const client = await connectSSEClient(port, 'exploratory-local-sse');
  console.log('  MCP client connected\n');

  // ========== Test 1.1: Basic Connectivity ==========
  await runTest('1.1 List tools and verify count', async () => {
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map(t => t.name);
    console.log(`    Tools (${toolNames.length}): ${toolNames.join(', ')}`);
    assert(toolNames.length >= 16, `Expected >=16 tools, got ${toolNames.length}`);
    assert(toolNames.includes('create_debug_session'), 'Missing create_debug_session');
    assert(toolNames.includes('set_breakpoint'), 'Missing set_breakpoint');
    assert(toolNames.includes('start_debugging'), 'Missing start_debugging');
    assert(toolNames.includes('get_variables'), 'Missing get_variables');
    assert(toolNames.includes('evaluate_expression'), 'Missing evaluate_expression');
    assert(toolNames.includes('get_source_context'), 'Missing get_source_context');
  });

  // ========== Test 1.2: List Supported Languages ==========
  await runTest('1.2 List supported languages', async () => {
    const result = await callTool(client, 'list_supported_languages', {});
    const langs = result.languages || [];
    console.log(`    Languages: ${JSON.stringify(langs)}`);
    // Check for expected languages
    const langNames = langs.map(l => typeof l === 'string' ? l : (l.id || l.name));
    assert(langNames.includes('python'), 'Missing python');
    assert(langNames.includes('javascript'), 'Missing javascript');
    assert(langNames.includes('mock'), 'Missing mock');
    // Go and Rust may or may not be available
    console.log(`    Go available: ${langNames.includes('go')}`);
    console.log(`    Rust available: ${langNames.includes('rust')}`);
  });

  // ========== Test 1.3: List Debug Sessions (empty) ==========
  await runTest('1.3 List debug sessions (should be empty)', async () => {
    const result = await callTool(client, 'list_debug_sessions', {});
    const sessions = result.sessions || [];
    assert(sessions.length === 0, `Expected 0 sessions, got ${sessions.length}`);
  });

  // ========== Test 1.4: Python Full Debug Workflow ==========
  await runTest('1.4 Python: full debug workflow', async () => {
    const scriptPath = path.resolve(ROOT, 'examples', 'python', 'simple_test.py');

    // Create session
    const createResult = await callTool(client, 'create_debug_session', {
      language: 'python', name: 'exploratory-python-full'
    });
    assertDefined(createResult.sessionId, 'sessionId');
    const sid = createResult.sessionId;

    try {
      // Set breakpoint at line 11 (the swap: a, b = b, a)
      const bpResult = await callTool(client, 'set_breakpoint', {
        sessionId: sid, file: scriptPath, line: 11
      });
      console.log(`    Breakpoint: verified=${bpResult.verified}`);

      // Start debugging - stopOnEntry=false so we hit breakpoint
      const startResult = await callTool(client, 'start_debugging', {
        sessionId: sid, scriptPath,
        dapLaunchArgs: { stopOnEntry: false, justMyCode: true }
      });
      console.log(`    Start state: ${startResult.state}`);

      // Wait for breakpoint hit
      await sleep(4000);

      // Get stack trace
      const stackResult = await callToolSafe(client, 'get_stack_trace', { sessionId: sid });
      const frames = stackResult.stackFrames || [];
      console.log(`    Stack frames: ${frames.length}`);
      assert(frames.length > 0, 'No stack frames - breakpoint may not have been hit');
      console.log(`    Top frame: ${frames[0].source?.name || 'unknown'}:${frames[0].line}`);

      // Get scopes
      const frameId = frames[0].id;
      const scopesResult = await callToolSafe(client, 'get_scopes', { sessionId: sid, frameId });
      const scopes = scopesResult.scopes || [];
      console.log(`    Scopes: ${scopes.map(s => s.name).join(', ')}`);

      // Get variables via scopes
      if (scopes.length > 0) {
        const localsScope = scopes.find(s => s.name === 'Locals') || scopes[0];
        const varsResult = await callToolSafe(client, 'get_variables', {
          sessionId: sid, scope: localsScope.variablesReference
        });
        const vars = varsResult.variables || [];
        console.log(`    Variables (scopes): ${vars.map(v => `${v.name}=${v.value}`).join(', ')}`);
      }

      // Get local variables (convenience method)
      const localVarsResult = await callToolSafe(client, 'get_local_variables', { sessionId: sid });
      const localVars = localVarsResult.variables || [];
      console.log(`    Local variables: ${localVars.map(v => `${v.name}=${v.value}`).join(', ')}`);

      // Evaluate expression
      const evalResult = await callToolSafe(client, 'evaluate_expression', {
        sessionId: sid, expression: 'a + b'
      });
      console.log(`    eval(a + b) = ${evalResult.result}`);
      assert(evalResult.result !== undefined, 'Expression evaluation returned no result');

      // Get source context
      const srcResult = await callToolSafe(client, 'get_source_context', {
        sessionId: sid, file: scriptPath, line: 11, linesContext: 3
      });
      console.log(`    Source context: ${srcResult.source ? 'retrieved (' + srcResult.source.length + ' chars)' : 'MISSING'}`);

      // Step over (should move past the swap)
      const stepResult = await callToolSafe(client, 'step_over', { sessionId: sid });
      console.log(`    Step over: success=${stepResult.success}`);
      await sleep(2000);

      // Get variables after step - a and b should be swapped
      const afterVars = await callToolSafe(client, 'get_local_variables', { sessionId: sid });
      console.log(`    After step vars: ${(afterVars.variables || []).map(v => `${v.name}=${v.value}`).join(', ')}`);

      // Continue execution
      const contResult = await callToolSafe(client, 'continue_execution', { sessionId: sid });
      console.log(`    Continue: success=${contResult.success}`);
      await sleep(2000);

      // Close session
      const closeResult = await callToolSafe(client, 'close_debug_session', { sessionId: sid });
      console.log(`    Close: success=${closeResult.success}`);
    } catch (error) {
      try { await callToolSafe(client, 'close_debug_session', { sessionId: sid }); } catch {}
      throw error;
    }
  });

  // ========== Test 1.5: JavaScript Full Debug Workflow ==========
  await runTest('1.5 JavaScript: full debug workflow', async () => {
    const scriptPath = path.resolve(ROOT, 'examples', 'javascript', 'simple_test.js');

    const createResult = await callTool(client, 'create_debug_session', {
      language: 'javascript', name: 'exploratory-javascript-full'
    });
    const sid = createResult.sessionId;

    try {
      // Set breakpoint at line 14 ([a, b] = [b, a])
      await callTool(client, 'set_breakpoint', {
        sessionId: sid, file: scriptPath, line: 14
      });

      // Start debugging
      const startResult = await callTool(client, 'start_debugging', {
        sessionId: sid, scriptPath,
        dapLaunchArgs: { stopOnEntry: false, justMyCode: true }
      });
      console.log(`    Start state: ${startResult.state}`);

      // Wait for breakpoint - JS may need longer + polling
      await sleep(3000);
      let stackFrames = [];
      for (let attempt = 0; attempt < 15; attempt++) {
        const stackResult = await callToolSafe(client, 'get_stack_trace', { sessionId: sid });
        stackFrames = stackResult.stackFrames || [];
        if (stackFrames.length > 0) {
          console.log(`    Stack trace ready after ${attempt + 1} poll(s)`);
          break;
        }
        await sleep(1000);
      }
      console.log(`    Stack frames: ${stackFrames.length}`);
      assert(stackFrames.length > 0, 'No stack frames for JavaScript');
      console.log(`    Top frame: ${stackFrames[0].source?.name || 'unknown'}:${stackFrames[0].line}`);

      // Get local variables
      const localVarsResult = await callToolSafe(client, 'get_local_variables', { sessionId: sid });
      const localVars = localVarsResult.variables || [];
      console.log(`    Local variables: ${localVars.map(v => `${v.name}=${v.value}`).join(', ')}`);

      // Evaluate expression
      const evalResult = await callToolSafe(client, 'evaluate_expression', {
        sessionId: sid, expression: 'a + b'
      });
      console.log(`    eval(a + b) = ${evalResult.result}`);

      // Step over
      const stepResult = await callToolSafe(client, 'step_over', { sessionId: sid });
      console.log(`    Step over: success=${stepResult.success}`);
      await sleep(2000);

      // Continue and close
      await callToolSafe(client, 'continue_execution', { sessionId: sid });
      await sleep(3000);
      await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    } catch (error) {
      try { await callToolSafe(client, 'close_debug_session', { sessionId: sid }); } catch {}
      throw error;
    }
  });

  // ========== Test 1.6: Go Full Debug Workflow ==========
  await runTest('1.6 Go: full debug workflow', async () => {
    // Check if Go and Delve are available
    let goAvailable = false;
    let dlvAvailable = false;
    try { execSync('go version', { stdio: 'ignore', timeout: 5000 }); goAvailable = true; } catch {}
    try { execSync('dlv version', { stdio: 'ignore', timeout: 5000 }); dlvAvailable = true; } catch {}

    if (!goAvailable || !dlvAvailable) {
      console.log(`    SKIP: Go=${goAvailable}, Delve=${dlvAvailable}`);
      return; // Skip without failing
    }

    const goSrcFile = path.resolve(ROOT, 'examples', 'go', 'hello_world.go');
    const binaryExt = process.platform === 'win32' ? '.exe' : '';
    const goBinary = path.resolve(ROOT, 'examples', 'go', `hello_world_exploratory${binaryExt}`);

    // Compile with debug symbols
    try {
      execSync(`go build -gcflags="all=-N -l" -o "${goBinary}" "${goSrcFile}"`, {
        cwd: path.dirname(goSrcFile),
        stdio: 'pipe',
        timeout: 30000
      });
    } catch (error) {
      console.log(`    SKIP: Failed to compile Go binary: ${error.message}`);
      return;
    }

    const createResult = await callTool(client, 'create_debug_session', {
      language: 'go', name: 'exploratory-go-full'
    });
    const sid = createResult.sessionId;

    try {
      // Set breakpoint at line 12 (message := greet("World"))
      await callTool(client, 'set_breakpoint', {
        sessionId: sid, file: goSrcFile, line: 12
      });

      // Start debugging (exec mode for pre-compiled binary)
      const startResult = await callTool(client, 'start_debugging', {
        sessionId: sid,
        scriptPath: goBinary,
        dapLaunchArgs: { mode: 'exec', stopOnEntry: false }
      });
      console.log(`    Start state: ${startResult.state}`);
      await sleep(3000);

      // Get stack trace
      const stackResult = await callToolSafe(client, 'get_stack_trace', { sessionId: sid });
      const frames = stackResult.stackFrames || [];
      console.log(`    Stack frames: ${frames.length}`);

      // Get local variables
      if (frames.length > 0) {
        const localVars = await callToolSafe(client, 'get_local_variables', { sessionId: sid });
        console.log(`    Local variables: ${(localVars.variables || []).map(v => `${v.name}=${v.value}`).join(', ')}`);
      }

      // Continue and close
      await callToolSafe(client, 'continue_execution', { sessionId: sid });
      await sleep(2000);
      await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    } catch (error) {
      try { await callToolSafe(client, 'close_debug_session', { sessionId: sid }); } catch {}
      throw error;
    } finally {
      // Clean up binary
      try {
        if (fs.existsSync(goBinary)) fs.unlinkSync(goBinary);
      } catch {}
    }
  });

  // ========== Edge Cases ==========

  // 1.7: Breakpoint on non-existent file
  await runTest('1.7 Edge: breakpoint on non-existent file', async () => {
    const createResult = await callTool(client, 'create_debug_session', {
      language: 'python', name: 'edge-nonexistent-file'
    });
    const sid = createResult.sessionId;
    try {
      const bpResult = await callToolSafe(client, 'set_breakpoint', {
        sessionId: sid,
        file: '/absolutely/nonexistent/path/to/file.py',
        line: 10
      });
      console.log(`    Result: success=${bpResult.success}, verified=${bpResult.verified}`);
      // Key check: no crash, no stack trace leak - just a clean response
    } finally {
      await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    }
  });

  // 1.8: get_variables before debugging started
  await runTest('1.8 Edge: get_variables before debugging started', async () => {
    const createResult = await callTool(client, 'create_debug_session', {
      language: 'python', name: 'edge-vars-before-debug'
    });
    const sid = createResult.sessionId;
    try {
      const result = await callToolSafe(client, 'get_local_variables', { sessionId: sid });
      console.log(`    Result: ${JSON.stringify(result).substring(0, 200)}`);
      // Should return clean error, not crash
    } finally {
      await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    }
  });

  // 1.9: evaluate_expression with syntax error
  await runTest('1.9 Edge: evaluate_expression with syntax error', async () => {
    const scriptPath = path.resolve(ROOT, 'examples', 'python', 'simple_test.py');
    const createResult = await callTool(client, 'create_debug_session', {
      language: 'python', name: 'edge-eval-syntax-error'
    });
    const sid = createResult.sessionId;

    try {
      // Start with stopOnEntry so we have an execution context
      await callTool(client, 'start_debugging', {
        sessionId: sid, scriptPath,
        dapLaunchArgs: { stopOnEntry: true }
      });
      await sleep(3000);

      const result = await callToolSafe(client, 'evaluate_expression', {
        sessionId: sid, expression: '((( invalid syntax !!!!~@#$'
      });
      console.log(`    Result: ${JSON.stringify(result).substring(0, 200)}`);
      // Should return error, not crash
    } finally {
      await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    }
  });

  // 1.10: Multiple simultaneous sessions
  await runTest('1.10 Edge: multiple simultaneous sessions', async () => {
    const sid1 = (await callTool(client, 'create_debug_session', {
      language: 'python', name: 'multi-session-1'
    })).sessionId;
    const sid2 = (await callTool(client, 'create_debug_session', {
      language: 'python', name: 'multi-session-2'
    })).sessionId;

    try {
      // Verify both sessions exist
      const listResult = await callTool(client, 'list_debug_sessions', {});
      const sessions = listResult.sessions || [];
      console.log(`    Active sessions: ${sessions.length}`);
      assert(sessions.length >= 2, `Expected >=2 sessions, got ${sessions.length}`);

      // Operations on each session should be independent
      const scriptPath = path.resolve(ROOT, 'examples', 'python', 'simple_test.py');
      await callTool(client, 'set_breakpoint', { sessionId: sid1, file: scriptPath, line: 8 });
      await callTool(client, 'set_breakpoint', { sessionId: sid2, file: scriptPath, line: 11 });
      console.log('    Both sessions accepted independent breakpoints');
    } finally {
      await callToolSafe(client, 'close_debug_session', { sessionId: sid1 });
      await callToolSafe(client, 'close_debug_session', { sessionId: sid2 });
    }
  });

  // 1.11: step_over after program terminated
  await runTest('1.11 Edge: step_over after program terminated', async () => {
    const scriptPath = path.resolve(ROOT, 'examples', 'python', 'simple_test.py');
    const createResult = await callTool(client, 'create_debug_session', {
      language: 'python', name: 'edge-step-after-terminate'
    });
    const sid = createResult.sessionId;

    try {
      // Start with no breakpoint - program runs to completion
      await callTool(client, 'start_debugging', {
        sessionId: sid, scriptPath,
        dapLaunchArgs: { stopOnEntry: false }
      });
      await sleep(5000); // Let it finish

      // Try stepping - should get clean error
      const result = await callToolSafe(client, 'step_over', { sessionId: sid });
      console.log(`    Result: ${JSON.stringify(result).substring(0, 200)}`);
      // Key: should not crash, should give meaningful error
    } finally {
      await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    }
  });

  // 1.12: get_source_context verification
  await runTest('1.12 get_source_context for Python file', async () => {
    const createResult = await callTool(client, 'create_debug_session', {
      language: 'python', name: 'source-context-test'
    });
    const sid = createResult.sessionId;
    try {
      const scriptPath = path.resolve(ROOT, 'examples', 'python', 'simple_test.py');
      const result = await callToolSafe(client, 'get_source_context', {
        sessionId: sid, file: scriptPath, line: 8, linesContext: 5
      });
      console.log(`    Source: ${result.source ? 'retrieved' : 'MISSING'}`);
      console.log(`    Current line: ${result.currentLine}`);
      if (result.source) {
        assert(
          result.source.includes('a = 1') || result.source.includes('main'),
          'Source should contain code from simple_test.py'
        );
      }
    } finally {
      await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    }
  });

  // 1.13: Session cleanup verification
  await runTest('1.13 Session cleanup after close', async () => {
    const createResult = await callTool(client, 'create_debug_session', {
      language: 'python', name: 'cleanup-test'
    });
    const sid = createResult.sessionId;

    await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    await sleep(1000);

    const listResult = await callTool(client, 'list_debug_sessions', {});
    const sessions = listResult.sessions || [];
    const found = sessions.find(s => s.sessionId === sid || s.id === sid);
    assert(!found, `Session ${sid} should be cleaned up but still found`);
    console.log('    Session properly cleaned up');
  });

  // 1.14: Operations on closed session
  await runTest('1.14 Edge: operations on closed/invalid session', async () => {
    const createResult = await callTool(client, 'create_debug_session', {
      language: 'python', name: 'closed-session-ops'
    });
    const sid = createResult.sessionId;
    await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    await sleep(1000);

    // Try operations on closed session
    const bpResult = await callToolSafe(client, 'set_breakpoint', {
      sessionId: sid, file: '/tmp/test.py', line: 1
    });
    console.log(`    set_breakpoint on closed: success=${bpResult.success}, error=${bpResult.error || bpResult.message || 'none'}`);

    const stepResult = await callToolSafe(client, 'step_over', { sessionId: sid });
    console.log(`    step_over on closed: success=${stepResult.success}, error=${stepResult.error || stepResult.message || 'none'}`);

    // Try with completely fake session ID
    const fakeResult = await callToolSafe(client, 'get_stack_trace', {
      sessionId: 'nonexistent-session-id-12345'
    });
    console.log(`    get_stack_trace with fake ID: success=${fakeResult.success}, error=${fakeResult.error || fakeResult.message || 'none'}`);
  });

  // 1.15: Path with spaces (this project lives in "250106 AGENTS" directory!)
  await runTest('1.15 Path handling: project path contains spaces', async () => {
    const scriptPath = path.resolve(ROOT, 'examples', 'python', 'simple_test.py');
    console.log(`    Script path: ${scriptPath}`);
    assert(scriptPath.includes(' '), 'Expected path with spaces (project is in "250106 AGENTS" dir)');

    const createResult = await callTool(client, 'create_debug_session', {
      language: 'python', name: 'path-spaces-test'
    });
    const sid = createResult.sessionId;
    try {
      // The path with spaces should work correctly
      await callTool(client, 'set_breakpoint', { sessionId: sid, file: scriptPath, line: 8 });

      const startResult = await callTool(client, 'start_debugging', {
        sessionId: sid, scriptPath,
        dapLaunchArgs: { stopOnEntry: true }
      });
      console.log(`    Start state: ${startResult.state}`);
      assert(startResult.state, 'Should start successfully despite spaces in path');

      await sleep(3000);
      const stackResult = await callToolSafe(client, 'get_stack_trace', { sessionId: sid });
      const frames = stackResult.stackFrames || [];
      console.log(`    Stack frames: ${frames.length}`);
      assert(frames.length > 0, 'Debugging should work with paths containing spaces');
    } finally {
      await callToolSafe(client, 'close_debug_session', { sessionId: sid });
    }
  });

  // ========== Cleanup ==========
  console.log('\n  Cleaning up...');
  try { await client.close(); } catch {}

  // Kill server process
  try {
    serverProc.kill('SIGTERM');
    await sleep(2000);
    if (!serverProc.killed) {
      serverProc.kill('SIGKILL');
    }
  } catch {}

  // Print summary
  const summary = printSummary('Local SSE Mode');

  // Write results to JSON for aggregation
  const resultsPath = path.join(ROOT, 'tests', 'exploratory', 'results-local-sse.json');
  fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));

  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
