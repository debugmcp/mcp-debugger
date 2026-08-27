/**
 * E2E regression test for issue #502: the Streamable HTTP stale-session
 * reaper must actually reap the session's proxy worker OS process.
 *
 * Drives the exact leak scenario against a real server:
 *  1. HTTP client creates a mock-language session and runs the debuggee to
 *     natural termination (the worker starts shutdown() as a floating
 *     promise, and the parent's terminate command lands mid-shutdown — the
 *     #502 race window).
 *  2. The client is abandoned WITHOUT a DELETE (socket-level close only).
 *  3. The stale-session sweep reaps the session.
 *  4. The worker pid must be gone, with no force-kill escalation: on unfixed
 *     code the worker either survives forever or dies only via the 5s
 *     "Timeout waiting for proxy exit" SIGKILL.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parseSdkToolResult, waitForHealthEndpoint, pollUntil } from './smoke-test-utils.js';
import { listTaggedProxies } from '../../src/utils/proxy-orphan-reaper.js';

const TEST_TIMEOUT = 90000;

const projectRoot = process.cwd();
const MOCK_SCRIPT = path.join(projectRoot, 'examples', 'python', 'simple_test.py');

let serverProcess: ChildProcess | null = null;
let mcpClient: Client | null = null;
let tmpDir: string | null = null;

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => {
        if (port) {
          setTimeout(() => resolve(port), 100);
        } else {
          reject(new Error('Could not determine an ephemeral port'));
        }
      });
    });
  });
}

describe('MCP Server E2E HTTP stale-session reap (issue #502)', () => {
  afterEach(async () => {
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch {
        // Already abandoned/closed — expected in this test.
      }
      mcpClient = null;
    }

    if (serverProcess && serverProcess.exitCode === null) {
      const proc = serverProcess;
      proc.kill('SIGTERM');
      const exited = await pollUntil(
        async () => (proc.exitCode !== null ? true : undefined),
        3000,
        100
      );
      if (!exited) {
        proc.kill('SIGKILL');
      }
    }
    serverProcess = null;

    if (tmpDir) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup.
      }
      tmpDir = null;
    }
  });

  it('reaps the proxy worker of an abandoned HTTP session, without force-kill escalation', async () => {
    const distEntry = path.join(projectRoot, 'dist', 'index.js');
    if (!existsSync(distEntry)) {
      throw new Error('dist/index.js not found. Run "npm run build" first.');
    }

    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'mcp-502-'));
    const logFile = path.join(tmpDir, 'server.log');
    const port = await findAvailablePort();

    serverProcess = spawn(process.execPath, [
      distEntry,
      'http',
      '-p', String(port),
      '--log-file', logFile,
      '--log-level', 'debug'
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCP_HTTP_STALE_SESSION_MS: '2000',
        MCP_HTTP_STALE_SWEEP_INTERVAL_MS: '1000'
      }
    });
    const serverPid = serverProcess.pid!;

    await waitForHealthEndpoint(port, 15000);

    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`)
    );
    mcpClient = new Client({ name: 'stale-reap-502', version: '1.0.0' });
    await mcpClient.connect(transport);

    const created = parseSdkToolResult(await mcpClient.callTool({
      name: 'create_debug_session',
      arguments: { language: 'mock', name: 'stale-reap-502' }
    }));
    expect(created.sessionId).toBeDefined();
    const sessionId = created.sessionId as string;

    parseSdkToolResult(await mcpClient.callTool({
      name: 'set_breakpoint',
      arguments: { sessionId, file: MOCK_SCRIPT, line: 32 }
    }));

    const started = parseSdkToolResult(await mcpClient.callTool({
      name: 'start_debugging',
      arguments: { sessionId, scriptPath: MOCK_SCRIPT, dapLaunchArgs: { stopOnEntry: true } }
    }));
    expect(started.success).toBe(true);

    // Capture the worker pid via its argv tags while it is alive.
    const workerPid = await pollUntil(async () => {
      const workers = (await listTaggedProxies()).filter(w => w.ownerPid === serverPid);
      return workers.length > 0 ? workers[0].pid : undefined;
    }, 10000, 200);
    expect(workerPid).toBeDefined();
    expect(pidAlive(workerPid!)).toBe(true);

    // Run the debuggee to natural termination: continue to the breakpoint,
    // then past it (the mock adapter terminates after the last breakpoint).
    // This opens the #502 race window inside the worker.
    parseSdkToolResult(await mcpClient.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    }));
    await new Promise(resolve => setTimeout(resolve, 800));
    parseSdkToolResult(await mcpClient.callTool({
      name: 'continue_execution',
      arguments: { sessionId }
    }));

    // Abandon the session: close the client's sockets WITHOUT sending the
    // MCP DELETE (transport.close() aborts streams; terminateSession() is
    // the DELETE — deliberately not called).
    await mcpClient.close();
    mcpClient = null;

    // The stale sweep (idle > 2s, ticked every 1s) must reap the session…
    const reaped = await pollUntil(async () => {
      try {
        return readFileSync(logFile, 'utf8').includes('Reaping stale HTTP session')
          ? true
          : undefined;
      } catch {
        return undefined;
      }
    }, 20000, 250);
    expect(reaped).toBe(true);

    // …and the worker OS process must actually die.
    const workerGone = await pollUntil(
      async () => (pidAlive(workerPid!) ? undefined : true),
      20000,
      250
    );
    expect(workerGone).toBe(true);

    // The teardown must have been graceful: no 5s force-kill escalation
    // (the only thing that reaped the stranded worker on unfixed code), and
    // no post-close leak detection firing.
    const log = readFileSync(logFile, 'utf8');
    expect(log).not.toContain('Timeout waiting for proxy exit');
    expect(log).not.toContain('leaked worker');
  }, TEST_TIMEOUT);
});
