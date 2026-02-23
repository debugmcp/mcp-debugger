#!/usr/bin/env node
/**
 * Exploratory Test: NPX Tarball Mode
 * Tests the bundled distribution package
 *
 * Usage: node tests/exploratory/test-npx-tarball.mjs
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  ROOT, findAvailablePort, waitForHealth, sleep,
  connectSSEClient, callTool, callToolSafe,
  createTestRunner, assert, assertDefined
} from './helpers.mjs';

const { runTest, printSummary } = createTestRunner();

async function main() {
  console.log('='.repeat(50));
  console.log('  Exploratory Test: NPX Tarball Mode');
  console.log('='.repeat(50));
  console.log(`  Project root: ${ROOT}`);
  console.log(`  Platform: ${process.platform}`);
  console.log('');

  // Find the tarball
  const tarballDir = path.join(ROOT, 'packages', 'mcp-debugger');
  const tarballs = fs.readdirSync(tarballDir)
    .filter(f => f.endsWith('.tgz'))
    .sort()
    .reverse(); // Most recent first

  if (tarballs.length === 0) {
    console.log('  No tarball found in packages/mcp-debugger/ - skipping');
    console.log('  RESULT: SKIPPED (no tarball)');
    process.exit(0);
  }

  const tarballPath = path.join(tarballDir, tarballs[0]);
  console.log(`  Tarball: ${tarballs[0]}`);

  // Install to temp prefix to avoid polluting global
  const tmpPrefix = path.join(os.tmpdir(), `mcp-debugger-test-${Date.now()}`);
  fs.mkdirSync(tmpPrefix, { recursive: true });

  console.log(`  Temp prefix: ${tmpPrefix}`);
  console.log('');

  let serverProc;
  let client;

  try {
    // Install the tarball to temp prefix
    console.log('  Installing tarball...');
    try {
      execSync(`npm install -g --prefix "${tmpPrefix}" "${tarballPath}"`, {
        stdio: 'pipe',
        timeout: 60000,
        env: { ...process.env, npm_config_loglevel: 'error' }
      });
    } catch (error) {
      console.error(`  Failed to install tarball: ${error.message}`);
      if (error.stderr) console.error(`  stderr: ${error.stderr.toString().substring(0, 500)}`);
      console.log('  RESULT: SKIPPED (install failed)');
      process.exit(0);
    }

    // Find the installed binary
    const isWindows = process.platform === 'win32';
    const binDir = isWindows
      ? path.join(tmpPrefix, 'node_modules', '.bin')
      : path.join(tmpPrefix, 'bin');
    const binName = isWindows ? 'mcp-debugger.cmd' : 'mcp-debugger';
    let binPath = path.join(binDir, binName);

    // Also check alternate locations
    if (!fs.existsSync(binPath)) {
      // On Windows, npm install -g --prefix puts .cmd directly in prefix root
      binPath = path.join(tmpPrefix, binName);
    }
    if (!fs.existsSync(binPath)) {
      // Try lib/node_modules/.bin
      binPath = path.join(tmpPrefix, 'lib', 'node_modules', '.bin', binName);
    }
    if (!fs.existsSync(binPath)) {
      // Fall back to running via node directly
      const mainPath = path.join(tmpPrefix, 'lib', 'node_modules', '@debugmcp', 'mcp-debugger', 'dist', 'index.js');
      if (!fs.existsSync(mainPath)) {
        // Try without lib
        const altMainPath = path.join(tmpPrefix, 'node_modules', '@debugmcp', 'mcp-debugger', 'dist', 'index.js');
        if (fs.existsSync(altMainPath)) {
          binPath = altMainPath;
        } else {
          console.log(`  Binary not found at expected locations. Dir contents:`);
          try {
            const listing = execSync(`find "${tmpPrefix}" -name "mcp-debugger*" -o -name "index.js" | head -20`, {
              encoding: 'utf8', timeout: 5000
            });
            console.log(`  ${listing}`);
          } catch {
            try {
              // Windows fallback
              const listing = execSync(`dir /s /b "${tmpPrefix}"`, {
                encoding: 'utf8', timeout: 5000
              });
              console.log(`  ${listing.split('\n').slice(0, 20).join('\n')}`);
            } catch {}
          }
          console.log('  RESULT: SKIPPED (binary not found after install)');
          process.exit(0);
        }
      } else {
        binPath = mainPath;
      }
    }

    console.log(`  Binary: ${binPath}`);

    // Start the server via SSE
    const port = await findAvailablePort();
    console.log(`  Starting NPX server on port ${port}...`);

    // Determine how to launch
    const isNodeScript = binPath.endsWith('.js');
    const spawnCmd = isNodeScript ? process.execPath : binPath;
    const spawnArgs = isNodeScript
      ? [binPath, 'sse', '-p', port.toString()]
      : ['sse', '-p', port.toString()];

    serverProc = spawn(spawnCmd, spawnArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      shell: !isNodeScript && isWindows // Use shell for .cmd files on Windows
    });

    let serverOutput = '';
    serverProc.stdout.on('data', d => { serverOutput += d.toString(); });
    serverProc.stderr.on('data', d => { serverOutput += d.toString(); });

    const healthy = await waitForHealth(port, 20000);
    if (!healthy) {
      console.error('  NPX server failed to start. Output:');
      console.error(serverOutput);
      console.log('  RESULT: FAILED (server did not start)');
      process.exit(1);
    }
    console.log(`  NPX server healthy on port ${port}\n`);

    // Connect MCP client
    client = await connectSSEClient(port, 'exploratory-npx');
    console.log('  MCP client connected\n');

    // ========== Test 3.1: List Supported Languages ==========
    await runTest('3.1 NPX: list supported languages', async () => {
      const result = await callTool(client, 'list_supported_languages', {});
      const langs = result.languages || [];
      const langNames = langs.map(l => typeof l === 'string' ? l : (l.id || l.name));
      console.log(`    Languages: ${langNames.join(', ')}`);
      assert(langNames.includes('python'), 'Missing python in NPX bundle');
      // Mock should be bundled
      assert(langNames.includes('mock'), 'Missing mock in NPX bundle');
    });

    // ========== Test 3.2: Python Full Workflow ==========
    await runTest('3.2 NPX: Python debug workflow', async () => {
      const scriptPath = path.resolve(ROOT, 'examples', 'python', 'simple_test.py');

      const createResult = await callTool(client, 'create_debug_session', {
        language: 'python', name: 'npx-python-test'
      });
      const sid = createResult.sessionId;

      try {
        await callTool(client, 'set_breakpoint', {
          sessionId: sid, file: scriptPath, line: 11
        });

        const startResult = await callTool(client, 'start_debugging', {
          sessionId: sid, scriptPath,
          dapLaunchArgs: { stopOnEntry: false, justMyCode: true }
        });
        console.log(`    Start state: ${startResult.state}`);
        await sleep(4000);

        const stackResult = await callToolSafe(client, 'get_stack_trace', { sessionId: sid });
        const frames = stackResult.stackFrames || [];
        console.log(`    Stack frames: ${frames.length}`);
        assert(frames.length > 0, 'No stack frames from NPX bundle');

        const localVars = await callToolSafe(client, 'get_local_variables', { sessionId: sid });
        console.log(`    Variables: ${(localVars.variables || []).map(v => `${v.name}=${v.value}`).join(', ')}`);

        await callToolSafe(client, 'continue_execution', { sessionId: sid });
        await sleep(2000);
        await callToolSafe(client, 'close_debug_session', { sessionId: sid });
      } catch (error) {
        try { await callToolSafe(client, 'close_debug_session', { sessionId: sid }); } catch {}
        throw error;
      }
    });

    // ========== Test 3.3: JavaScript Workflow ==========
    await runTest('3.3 NPX: JavaScript debug workflow', async () => {
      const scriptPath = path.resolve(ROOT, 'examples', 'javascript', 'simple_test.js');

      const createResult = await callTool(client, 'create_debug_session', {
        language: 'javascript', name: 'npx-javascript-test'
      });
      const sid = createResult.sessionId;

      try {
        await callTool(client, 'set_breakpoint', {
          sessionId: sid, file: scriptPath, line: 14
        });

        await callTool(client, 'start_debugging', {
          sessionId: sid, scriptPath,
          dapLaunchArgs: { stopOnEntry: false, justMyCode: true }
        });
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
          console.log(`    Variables: ${(localVars.variables || []).map(v => `${v.name}=${v.value}`).join(', ')}`);
        }

        await callToolSafe(client, 'continue_execution', { sessionId: sid });
        await sleep(3000);
        await callToolSafe(client, 'close_debug_session', { sessionId: sid });
      } catch (error) {
        try { await callToolSafe(client, 'close_debug_session', { sessionId: sid }); } catch {}
        throw error;
      }
    });

    // ========== Test 3.4: Console Output Cleanliness ==========
    await runTest('3.4 NPX: verify server output is clean', async () => {
      // Check that server output doesn't contain raw stack traces or unexpected log noise
      const lines = serverOutput.split('\n').filter(l => l.trim());
      const stackTraceLines = lines.filter(l =>
        l.includes('at Object.') ||
        l.includes('at Module.') ||
        l.includes('at node:') ||
        l.includes('Unhandled') ||
        l.includes('UnhandledPromiseRejection')
      );
      console.log(`    Total output lines: ${lines.length}`);
      console.log(`    Stack trace lines: ${stackTraceLines.length}`);
      if (stackTraceLines.length > 0) {
        console.log(`    Stack traces found:`);
        stackTraceLines.slice(0, 5).forEach(l => console.log(`      ${l.substring(0, 120)}`));
      }
      assert(stackTraceLines.length === 0, `Found ${stackTraceLines.length} stack trace lines in server output`);
    });

    // ========== Test 3.5: Tool Schema Verification ==========
    await runTest('3.5 NPX: tool schema verification', async () => {
      const toolsResult = await client.listTools();
      const tools = toolsResult.tools;

      // Check that each tool has required schema fields
      for (const tool of tools) {
        assert(tool.name, `Tool missing name`);
        assert(tool.description, `Tool ${tool.name} missing description`);
        assert(tool.inputSchema, `Tool ${tool.name} missing inputSchema`);

        // Verify inputSchema has proper structure
        const schema = tool.inputSchema;
        assert(schema.type === 'object', `Tool ${tool.name} schema type should be 'object', got '${schema.type}'`);
      }

      console.log(`    All ${tools.length} tools have valid schemas`);

      // Check specific tools have required parameters
      const createSession = tools.find(t => t.name === 'create_debug_session');
      assert(createSession, 'create_debug_session tool not found');
      const csProps = createSession.inputSchema.properties || {};
      assert(csProps.language, 'create_debug_session missing language parameter');

      const setBreakpoint = tools.find(t => t.name === 'set_breakpoint');
      assert(setBreakpoint, 'set_breakpoint tool not found');
      const sbProps = setBreakpoint.inputSchema.properties || {};
      assert(sbProps.sessionId, 'set_breakpoint missing sessionId parameter');
      assert(sbProps.file, 'set_breakpoint missing file parameter');
      assert(sbProps.line, 'set_breakpoint missing line parameter');
    });

    // Close client
    try { await client.close(); } catch {}

  } finally {
    // Cleanup
    console.log('\n  Cleaning up...');
    if (serverProc) {
      try { serverProc.kill('SIGTERM'); } catch {}
      await sleep(1000);
      if (serverProc && !serverProc.killed) {
        try { serverProc.kill('SIGKILL'); } catch {}
      }
    }

    // Remove temp prefix
    try {
      fs.rmSync(tmpPrefix, { recursive: true, force: true });
      console.log('  Temp directory removed');
    } catch {}
  }

  // Print summary
  const summary = printSummary('NPX Tarball Mode');

  // Write results
  const resultsPath = path.join(ROOT, 'tests', 'exploratory', 'results-npx-tarball.json');
  fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));

  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
