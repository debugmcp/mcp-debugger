/**
 * E2E: agent-native breakpoint addressing (issue #271, phase 1) against the
 * mock adapter.
 *
 * - expectedContent: a mismatched assertion fails fast with expected/actual
 *   and context; a matching one sets the breakpoint and echoes content.
 * - Loud snapping: the mock adapter's `snap` fixture binds odd lines one line
 *   down; the response must report requested vs bound loudly. The
 *   `snap-event` fixture verifies asynchronously via a DAP breakpoint event;
 *   the relocation must surface in list_breakpoints with requestedLine
 *   preserved.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { ROOT } from './language-matrix-utils.js';

const SNAP_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'mock-snap-fixture.py');
const SNAP_EVENT_SCRIPT = path.resolve(ROOT, 'tests', 'fixtures', 'debug-scripts', 'mock-snap-event-fixture.py');

describe('Breakpoint addressing e2e (#271, mock adapter)', () => {
  let mcpClient: Client | null = null;
  let transport: StdioClientTransport | null = null;
  let currentSessionId: string | null = null;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(ROOT, 'dist', 'index.js'), '--log-level', 'info'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    mcpClient = new Client(
      { name: 'bp-addressing-test-client', version: '1.0.0' },
      { capabilities: {} },
    );
    await mcpClient.connect(transport);
  }, 120_000);

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close().catch(() => {});
    }
    transport = null;
  });

  afterEach(async () => {
    if (mcpClient && currentSessionId) {
      await callToolSafely(mcpClient, 'close_debug_session', { sessionId: currentSessionId });
      currentSessionId = null;
    }
  });

  async function createMockSession(name: string): Promise<string> {
    const createRes = await mcpClient!.callTool({
      name: 'create_debug_session',
      arguments: { language: 'mock', name },
    });
    const sessionId = parseSdkToolResult(createRes).sessionId as string;
    expect(sessionId).toBeTruthy();
    currentSessionId = sessionId;
    return sessionId;
  }

  it('rejects a mismatched expectedContent with expected/actual and context', async () => {
    const sessionId = await createMockSession('expected-content-mismatch');

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      file: SNAP_SCRIPT,
      line: 5,
      expectedContent: 'return total',
    });

    expect(bpRes.success).toBe(false);
    const text = JSON.stringify(bpRes);
    expect(text).toContain('does not match expectedContent');
    expect(text).toContain('total = c * 2');

    const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId });
    expect((listRes as { breakpoints?: unknown[] }).breakpoints).toHaveLength(0);
  });

  it('sets the breakpoint and echoes content when expectedContent matches', async () => {
    const sessionId = await createMockSession('expected-content-match');

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      file: SNAP_SCRIPT,
      line: 5,
      expectedContent: 'total = c * 2',
    });

    expect(bpRes.success).toBe(true);
    expect((bpRes as { line?: number }).line).toBe(5);
    expect(String((bpRes as { content?: string }).content)).toContain('total = c * 2');
  }, 30_000);

  it('reports a snap loudly when the adapter binds a different line', async () => {
    const sessionId = await createMockSession('loud-snap');

    const startRes = await callToolSafely(mcpClient!, 'start_debugging', {
      sessionId,
      scriptPath: SNAP_SCRIPT,
      dapLaunchArgs: { stopOnEntry: true },
    });
    expect(startRes.success).toBe(true);

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      file: SNAP_SCRIPT,
      line: 5,
    });

    expect(bpRes.success).toBe(true);
    expect((bpRes as { line?: number }).line).toBe(6);
    expect((bpRes as { requestedLine?: number }).requestedLine).toBe(5);
    expect(String((bpRes as { warning?: string }).warning)).toMatch(
      /requested line 5, bound to line 6/
    );
    expect(String((bpRes as { message?: string }).message)).toMatch(
      /requested line 5, bound to line 6/
    );
  }, 30_000);

  it('resolves a statement anchor to its line and stores the anchor', async () => {
    const sessionId = await createMockSession('statement-anchor');

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      file: SNAP_SCRIPT,
      statement: 'total = c * 2',
    });

    expect(bpRes.success).toBe(true);
    expect((bpRes as { line?: number }).line).toBe(5);
    expect((bpRes as { anchor?: { statement?: string } }).anchor?.statement).toBe('total = c * 2');
  }, 30_000);

  it('re-resolves statement anchors across restart_debugging after a file edit', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bp-addressing-'));
    const tempFile = path.join(tempDir, 'anchored.py');
    await fs.writeFile(tempFile, 'def main():\n    x = 1\n    total = compute(x)\n    print(total)\n');

    try {
      const sessionId = await createMockSession('anchor-restart');

      const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
        sessionId,
        file: tempFile,
        statement: 'total = compute(x)',
      });
      expect(bpRes.success).toBe(true);
      expect((bpRes as { line?: number }).line).toBe(3);

      const startRes = await callToolSafely(mcpClient!, 'start_debugging', {
        sessionId,
        scriptPath: tempFile,
        dapLaunchArgs: { stopOnEntry: true },
      });
      expect(startRes.success).toBe(true);

      // The core fix-verify loop: edit the file (anchor moves down two lines),
      // then relaunch.
      await fs.writeFile(
        tempFile,
        'import sys\n\ndef main():\n    x = 1\n    total = compute(x)\n    print(total)\n'
      );

      const restartRes = await callToolSafely(mcpClient!, 'restart_debugging', { sessionId });
      expect(restartRes.success).toBe(true);
      const data = (restartRes as {
        data?: { anchorResolution?: { moved?: Array<{ from: number; to: number }> } };
      }).data;
      expect(data?.anchorResolution?.moved).toEqual([
        expect.objectContaining({ from: 3, to: 5 })
      ]);

      const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId });
      const [bp] = (listRes as { breakpoints?: Array<{ line?: number }> }).breakpoints ?? [];
      expect(bp?.line).toBe(5);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 45_000);

  it('function breakpoints bind by name, list separately, and stop the run simulation', async () => {
    const sessionId = await createMockSession('function-bp');

    // Queued pre-launch: no file, no line — just the symbol name.
    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      function: 'compute',
    });
    expect(bpRes.success).toBe(true);
    expect((bpRes as { functionName?: string }).functionName).toBe('compute');

    const startRes = await callToolSafely(mcpClient!, 'start_debugging', {
      sessionId,
      scriptPath: SNAP_EVENT_SCRIPT.replace('mock-snap-event-fixture', 'mock-snap-fixture'),
      dapLaunchArgs: { stopOnEntry: true },
    });
    expect(startRes.success).toBe(true);

    // Post-launch re-sync brings the bound state into the store: the mock
    // binds 'compute' at line 10 per its function table.
    const deadline = Date.now() + 10_000;
    let fnBp: { verified?: boolean; boundLine?: number; functionName?: string } | undefined;
    while (Date.now() < deadline) {
      const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId });
      fnBp = ((listRes as { functionBreakpoints?: Array<typeof fnBp> }).functionBreakpoints ?? [])[0];
      if (fnBp?.verified) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    expect(fnBp?.functionName).toBe('compute');
    expect(fnBp?.verified).toBe(true);
    expect(fnBp?.boundLine).toBe(10);

    // The run simulation honors the bound line.
    const contRes = await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
    expect(contRes.success).toBe(true);
    const stackDeadline = Date.now() + 10_000;
    let topLine: number | undefined;
    while (Date.now() < stackDeadline) {
      const stackRes = await callToolSafely(mcpClient!, 'get_stack_trace', { sessionId });
      const frames = (stackRes as { stackFrames?: Array<{ line?: number }> }).stackFrames;
      if (frames?.length) {
        topLine = frames[0].line;
        if (topLine === 10) break;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    expect(topLine).toBe(10);

    // Remove by function name round-trip.
    const removeRes = await callToolSafely(mcpClient!, 'remove_breakpoint', {
      sessionId,
      function: 'compute',
    });
    expect(removeRes.success).toBe(true);
    const finalList = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId });
    expect((finalList as { functionBreakpoints?: unknown[] }).functionBreakpoints).toBeUndefined();
  }, 45_000);

  it('accepts statement with a matching expectedContent (#280)', async () => {
    const sessionId = await createMockSession('redundant-ec');

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      file: SNAP_SCRIPT,
      statement: 'total = c * 2',
      expectedContent: 'total = c * 2',
    });

    expect(bpRes.success).toBe(true);
    expect((bpRes as { line?: number }).line).toBe(5);
  }, 30_000);

  it('surfaces an async breakpoint-event relocation in list_breakpoints', async () => {
    const sessionId = await createMockSession('snap-event');

    const startRes = await callToolSafely(mcpClient!, 'start_debugging', {
      sessionId,
      scriptPath: SNAP_EVENT_SCRIPT,
      dapLaunchArgs: { stopOnEntry: true },
    });
    expect(startRes.success).toBe(true);

    const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
      sessionId,
      file: SNAP_EVENT_SCRIPT,
      line: 5,
    });
    expect(bpRes.success).toBe(true);
    // The synchronous response still shows the requested line, unverified —
    // relocation arrives via the breakpoint event.
    expect((bpRes as { verified?: boolean }).verified).toBe(false);

    // Poll list_breakpoints until the event lands.
    const deadline = Date.now() + 10_000;
    let bp: { line?: number; requestedLine?: number; verified?: boolean } | undefined;
    while (Date.now() < deadline) {
      const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId });
      bp = ((listRes as { breakpoints?: Array<typeof bp> }).breakpoints ?? [])[0];
      if (bp?.verified && bp.line === 6) break;
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    expect(bp?.verified).toBe(true);
    expect(bp?.line).toBe(6);
    expect(bp?.requestedLine).toBe(5);
  }, 30_000);
});
