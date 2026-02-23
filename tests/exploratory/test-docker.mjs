#!/usr/bin/env node
/**
 * Exploratory Test: Docker Mode
 * Tests Python + JavaScript debugging with container path mapping
 *
 * Usage: node tests/exploratory/test-docker.mjs
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import {
  ROOT, waitForHealth, sleep,
  connectSSEClient, callTool, callToolSafe,
  createTestRunner, assert, assertDefined, findAvailablePort
} from './helpers.mjs';

const { runTest, printSummary } = createTestRunner();

async function main() {
  console.log('='.repeat(50));
  console.log('  Exploratory Test: Docker Mode');
  console.log('='.repeat(50));
  console.log(`  Project root: ${ROOT}`);
  console.log(`  Platform: ${process.platform}`);
  console.log('');

  // Check Docker availability
  try {
    const ver = execSync('docker --version', { encoding: 'utf8', timeout: 5000 });
    console.log(`  Docker: ${ver.trim()}`);
  } catch {
    console.log('  Docker not available - skipping Docker tests');
    console.log('  RESULT: SKIPPED (Docker not available)');
    process.exit(0);
  }

  // Check if image exists
  try {
    const imageId = execSync('docker images -q mcp-debugger:local', { encoding: 'utf8', timeout: 5000 });
    if (!imageId.trim()) {
      console.log('  Docker image mcp-debugger:local not found - skipping');
      console.log('  RESULT: SKIPPED (image not built)');
      process.exit(0);
    }
  } catch {
    console.log('  Failed to check Docker images');
    process.exit(0);
  }

  // Start container
  const containerName = `mcp-exploratory-${Date.now()}`;
  const hostPort = await findAvailablePort();
  const hostPath = ROOT.replace(/\\/g, '/');

  console.log(`  Container: ${containerName}`);
  console.log(`  Host port: ${hostPort}`);
  console.log(`  Volume: ${hostPath}:/workspace`);
  console.log('');

  try {
    execSync(
      `docker run -d --name ${containerName} -p ${hostPort}:3001 -v "${hostPath}:/workspace" mcp-debugger:local sse -p 3001`,
      { stdio: 'pipe', timeout: 30000 }
    );
    console.log('  Container started');
  } catch (error) {
    console.error(`  Failed to start container: ${error.message}`);
    // Try to get any output
    try {
      const logs = execSync(`docker logs ${containerName} 2>&1`, { encoding: 'utf8', timeout: 5000 });
      console.error(`  Container logs: ${logs}`);
    } catch {}
    process.exit(1);
  }

  let client;
  try {
    // Wait for health
    console.log('  Waiting for container health...');
    const healthy = await waitForHealth(hostPort, 30000);
    if (!healthy) {
      const logs = execSync(`docker logs ${containerName} 2>&1`, { encoding: 'utf8', timeout: 5000 });
      console.error(`  Container failed to become healthy. Logs:\n${logs}`);
      throw new Error('Container health check failed');
    }
    console.log('  Container healthy\n');

    // Connect MCP client
    client = await connectSSEClient(hostPort, 'exploratory-docker');
    console.log('  MCP client connected\n');

    // ========== Test 2.1: List Supported Languages ==========
    await runTest('2.1 Docker: list supported languages', async () => {
      const result = await callTool(client, 'list_supported_languages', {});
      const langs = result.languages || [];
      const langNames = langs.map(l => typeof l === 'string' ? l : (l.id || l.name));
      console.log(`    Languages: ${langNames.join(', ')}`);
      assert(langNames.includes('python'), 'Missing python in Docker');
      assert(langNames.includes('mock'), 'Missing mock in Docker');
      // Note: JS may or may not be available depending on container Node.js version
      console.log(`    JavaScript available: ${langNames.includes('javascript')}`);
      console.log(`    Go available: ${langNames.includes('go')}`);
      console.log(`    Rust available: ${langNames.includes('rust')}`);
    });

    // ========== Test 2.2: Python Workflow with relative paths ==========
    await runTest('2.2 Docker: Python debug workflow with relative paths', async () => {
      const scriptPath = 'examples/python/simple_test.py';

      const createResult = await callTool(client, 'create_debug_session', {
        language: 'python', name: 'docker-python-test'
      });
      const sid = createResult.sessionId;

      try {
        // Set breakpoint
        await callTool(client, 'set_breakpoint', {
          sessionId: sid, file: scriptPath, line: 11
        });

        // Start debugging
        const startResult = await callTool(client, 'start_debugging', {
          sessionId: sid, scriptPath,
          dapLaunchArgs: { stopOnEntry: false, justMyCode: true }
        });
        console.log(`    Start state: ${startResult.state}`);

        // Wait for breakpoint
        await sleep(4000);

        // Get stack trace
        const stackResult = await callToolSafe(client, 'get_stack_trace', { sessionId: sid });
        const frames = stackResult.stackFrames || [];
        console.log(`    Stack frames: ${frames.length}`);
        assert(frames.length > 0, 'No stack frames in Docker');

        // Get variables
        const localVars = await callToolSafe(client, 'get_local_variables', { sessionId: sid });
        console.log(`    Local variables: ${(localVars.variables || []).map(v => `${v.name}=${v.value}`).join(', ')}`);

        // Evaluate expression
        const evalResult = await callToolSafe(client, 'evaluate_expression', {
          sessionId: sid, expression: 'a + b'
        });
        console.log(`    eval(a + b) = ${evalResult.result}`);

        // Step over
        await callToolSafe(client, 'step_over', { sessionId: sid });
        await sleep(2000);

        // Continue and close
        await callToolSafe(client, 'continue_execution', { sessionId: sid });
        await sleep(2000);
        await callToolSafe(client, 'close_debug_session', { sessionId: sid });
      } catch (error) {
        try { await callToolSafe(client, 'close_debug_session', { sessionId: sid }); } catch {}
        throw error;
      }
    });

    // ========== Test 2.3: JavaScript Workflow ==========
    await runTest('2.3 Docker: JavaScript debug workflow', async () => {
      const scriptPath = 'examples/javascript/simple_test.js';

      const createResult = await callTool(client, 'create_debug_session', {
        language: 'javascript', name: 'docker-javascript-test'
      });
      const sid = createResult.sessionId;

      try {
        await callTool(client, 'set_breakpoint', {
          sessionId: sid, file: scriptPath, line: 14
        });

        const startResult = await callTool(client, 'start_debugging', {
          sessionId: sid, scriptPath,
          dapLaunchArgs: { stopOnEntry: false, justMyCode: true }
        });
        console.log(`    Start state: ${startResult.state}`);

        // JS needs longer + polling
        await sleep(3000);
        let stackFrames = [];
        for (let attempt = 0; attempt < 15; attempt++) {
          const stackResult = await callToolSafe(client, 'get_stack_trace', { sessionId: sid });
          stackFrames = stackResult.stackFrames || [];
          if (stackFrames.length > 0) break;
          await sleep(1000);
        }
        console.log(`    Stack frames: ${stackFrames.length}`);

        if (stackFrames.length > 0) {
          const localVars = await callToolSafe(client, 'get_local_variables', { sessionId: sid });
          console.log(`    Local variables: ${(localVars.variables || []).map(v => `${v.name}=${v.value}`).join(', ')}`);
        }

        await callToolSafe(client, 'continue_execution', { sessionId: sid });
        await sleep(3000);
        await callToolSafe(client, 'close_debug_session', { sessionId: sid });
      } catch (error) {
        try { await callToolSafe(client, 'close_debug_session', { sessionId: sid }); } catch {}
        throw error;
      }
    });

    // ========== Test 2.4: File Outside /workspace ==========
    await runTest('2.4 Docker: breakpoint on file outside /workspace', async () => {
      const createResult = await callTool(client, 'create_debug_session', {
        language: 'python', name: 'docker-outside-workspace'
      });
      const sid = createResult.sessionId;

      try {
        // This file doesn't exist in the container under the expected workspace
        const result = await callToolSafe(client, 'set_breakpoint', {
          sessionId: sid, file: '/etc/hosts', line: 1
        });
        console.log(`    Result: ${JSON.stringify(result).substring(0, 200)}`);
        // Should handle gracefully
      } finally {
        await callToolSafe(client, 'close_debug_session', { sessionId: sid });
      }
    });

    // ========== Test 2.5: Multiple sessions in Docker ==========
    await runTest('2.5 Docker: multiple simultaneous sessions', async () => {
      const sid1 = (await callTool(client, 'create_debug_session', {
        language: 'python', name: 'docker-multi-1'
      })).sessionId;
      const sid2 = (await callTool(client, 'create_debug_session', {
        language: 'python', name: 'docker-multi-2'
      })).sessionId;

      try {
        const listResult = await callTool(client, 'list_debug_sessions', {});
        const sessions = listResult.sessions || [];
        console.log(`    Active sessions: ${sessions.length}`);
        assert(sessions.length >= 2, `Expected >=2 sessions, got ${sessions.length}`);
      } finally {
        await callToolSafe(client, 'close_debug_session', { sessionId: sid1 });
        await callToolSafe(client, 'close_debug_session', { sessionId: sid2 });
      }
    });

    // Close client
    try { await client.close(); } catch {}

  } finally {
    // Cleanup container
    console.log('\n  Cleaning up Docker container...');
    try { execSync(`docker stop ${containerName}`, { stdio: 'pipe', timeout: 10000 }); } catch {}
    try { execSync(`docker rm ${containerName}`, { stdio: 'pipe', timeout: 5000 }); } catch {}
    console.log('  Container removed');
  }

  // Print summary
  const summary = printSummary('Docker Mode');

  // Write results
  const resultsPath = path.join(ROOT, 'tests', 'exploratory', 'results-docker.json');
  fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));

  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
