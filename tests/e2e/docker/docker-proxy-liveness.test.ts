/**
 * Docker E2E test to validate proxy liveness in container.
 * - Runs locally by default to catch container-specific regressions
 * - Skipped in CI environments (process.env.CI === 'true')
 * - Can be explicitly skipped with SKIP_DOCKER_TESTS=true
 * - Ensures the containerized server supports sustained DAP operations.
 *
 * To run locally:
 *   pnpm test                # Runs automatically with other tests
 *   
 * To skip locally:
 *   SKIP_DOCKER_TESTS=true pnpm test
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const shouldSkip =
  process.env.CI === 'true' ||  // Skip in CI environments
  process.env.SKIP_DOCKER_TESTS === 'true';  // Or explicitly skipped locally

// Skip entire suite when not explicitly enabled
(shouldSkip ? describe.skip : describe)('Docker E2E - Proxy Liveness', () => {
  const projectRoot = process.cwd();
  let client: Client | null = null;

  it(
    'maintains proxy connectivity across time and DAP ops (container)',
    async () => {
      // Build image if needed
      try {
        execSync('docker image inspect mcp-debugger:local', { stdio: 'ignore' });
      } catch {
        console.log('Building Docker image...');
        execSync('docker build . -t mcp-debugger:local', { stdio: 'inherit' });
      }

      const logLevel = 'debug';
      const tempLogPath = path.join(projectRoot, 'logs', 'docker-e2e.log');

      // Run the server in stdio mode with interactive flag
      const runArgs = [
        'run', '--rm', '-i',
        '-v', `${projectRoot}:/workspace:rw`,
        '-v', `${path.dirname(tempLogPath)}:/logs:rw`,
        'mcp-debugger:local',
        'stdio', 
        '--log-level', logLevel,
        '--log-file', '/logs/docker-e2e.log'
      ];
      
      // Connect stdio client - let the transport spawn the Docker process
      client = new Client({ name: 'docker-e2e', version: '0.1.0' }, {
        capabilities: {}
      });
      
      const transport = new StdioClientTransport({
        command: 'docker',
        args: runArgs
      });
      
      console.log('Starting Docker container and connecting via stdio...');
      await client.connect(transport);
      console.log('Connected to Docker container via stdio');

      // Start session
      const createRes = await client.callTool({
        name: 'create_debug_session',
        arguments: { language: 'python', name: 'Docker E2E Session' }
      });
      const sessionId = JSON.parse((createRes as any).content?.[0]?.text || '{}').sessionId as string;
      expect(sessionId).toBeDefined();

      // Set breakpoint - use relative path (server prepends /workspace)
      const fibonacciPath = 'examples/python/fibonacci.py';
      const bpRes = await client.callTool({
        name: 'set_breakpoint',
        arguments: { sessionId, file: fibonacciPath, line: 32 }
      });
      const bpOk = JSON.parse((bpRes as any).content?.[0]?.text || '{}').success === true;
      expect(bpOk).toBe(true);

      // Start debugging -> expect paused
      const dbgRes = await client.callTool({
        name: 'start_debugging',
        arguments: {
          sessionId,
          scriptPath: fibonacciPath,
          dapLaunchArgs: { stopOnEntry: true }
        }
      });
      const dbgParsed = JSON.parse((dbgRes as any).content?.[0]?.text || '{}');
      expect(dbgParsed.success).toBe(true);
      expect(dbgParsed.state).toBe('paused');

      // Wait 45 seconds (covers 10s interval + 30s heartbeat)
      await new Promise((r) => setTimeout(r, 45_000));

      // Stack trace and variables should still work if proxy survived
      const stRes = await client.callTool({ name: 'get_stack_trace', arguments: { sessionId } });
      const stOk = JSON.parse((stRes as any).content?.[0]?.text || '{}').success === true;
      expect(stOk).toBe(true);

      // Try an evaluate_expression as a sanity check
      const evalRes = await client.callTool({
        name: 'evaluate_expression',
        arguments: { sessionId, expression: '1+1' }
      });
      const evalOk = JSON.parse((evalRes as any).content?.[0]?.text || '{}').success === true;
      expect(evalOk).toBe(true);

      // Cleanup: close session
      await client.callTool({ name: 'close_debug_session', arguments: { sessionId } });

      // Close client (this will also terminate the Docker process)
      await client.close();
      client = null;
      
      console.log('Test completed successfully');
    },
    120_000
  );
});
