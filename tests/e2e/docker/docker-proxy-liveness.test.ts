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
import { spawn, execSync } from 'child_process';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import net from 'net';

const shouldSkip =
  process.env.CI === 'true' ||  // Skip in CI environments
  process.env.SKIP_DOCKER_TESTS === 'true';  // Or explicitly skipped locally

// Skip entire suite when not explicitly enabled
(shouldSkip ? describe.skip : describe)('Docker E2E - Proxy Liveness', () => {
  const projectRoot = process.cwd();
  let containerId: string | null = null;
  let client: Client | null = null;

  const findFreePort = async (): Promise<number> => {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr && addr.port) {
          const port = addr.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error('Failed to get random port')));
        }
      });
    });
  };

  const waitForPort = (port: number, timeoutMs: number): Promise<boolean> => {
    const start = Date.now();
    return new Promise((resolve) => {
      const tryConnect = () => {
        const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
          socket.end();
          resolve(true);
        });
        socket.on('error', () => {
          socket.destroy();
          if (Date.now() - start > timeoutMs) {
            resolve(false);
          } else {
            setTimeout(tryConnect, 200);
          }
        });
      };
      tryConnect();
    });
  };

  it(
    'maintains proxy connectivity across time and DAP ops (container)',
    async () => {
      // Build image if needed
      try {
        execSync('docker image inspect mcp-debugger:local', { stdio: 'ignore' });
      } catch {
        execSync('docker build . -t mcp-debugger:local', { stdio: 'inherit' });
      }

      // Choose dynamic host ports
      const ssePort = await findFreePort();
      const dbgPort = await findFreePort(); // debugpy port
      const logLevel = 'debug';

      // Run the server in SSE mode
      // Map ports: host:ssePort->container:3001 (default), host:dbgPort->container:5679
      const runArgs = [
        'run', '--rm',
        '-p', `${ssePort}:3001`,
        '-p', `${dbgPort}:5679`,
        'mcp-debugger:local',
        'sse', '--log-level', logLevel
      ];
      const proc = spawn('docker', runArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

      // Capture container ID by querying after spawn (best effort)
      // Note: this is not strictly necessary since we use --rm and rely on proc to manage lifecycle.
      proc.stdout?.on('data', (d) => process.stdout.write(`[docker stdout] ${d}`));
      proc.stderr?.on('data', (d) => process.stderr.write(`[docker stderr] ${d}`));

      // Wait for port to become ready
      const ready = await waitForPort(ssePort, 30000);
      expect(ready).toBe(true);

      // Connect SSE client
      client = new Client({ name: 'docker-e2e', version: '0.1.0' });
      const transport = new SSEClientTransport(new URL(`http://127.0.0.1:${ssePort}/sse`));
      await client.connect(transport);

      // Start session
      const createRes = await client.callTool({
        name: 'create_debug_session',
        arguments: { language: 'python', name: 'Docker E2E Session' }
      });
      const sessionId = JSON.parse((createRes as any).content?.[0]?.text || '{}').sessionId as string;
      expect(sessionId).toBeDefined();

      // Set breakpoint
      const fibonacciPath = path.join(projectRoot, 'examples', 'python', 'fibonacci.py');
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

      // Close client
      await client.close();
      client = null;

      // Stop container by killing process (docker --rm will clean up)
      proc.kill('SIGTERM');
    },
    120_000
  );
});
