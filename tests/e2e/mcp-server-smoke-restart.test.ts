/**
 * E2E: restart_debugging (issue #238).
 *
 * Per language:
 *   1. set a breakpoint, launch, pause at it
 *   2. restart WHILE PAUSED (the live-proxy path — regression for the
 *      session-destroying landmine) → pauses at the same breakpoint again
 *   3. drive the program to completion (bounded continue loop; loop scripts
 *      hit the breakpoint several times)
 *   4. restart from TERMINATED (the primary use case) → the previously-set
 *      breakpoint hits again WITHOUT re-issuing set_breakpoint, and
 *      get_output reads fresh output from since=0
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { ROOT, createLanguageMatrix, prepareLanguageMatrix } from './language-matrix-utils.js';

const LANGUAGES = createLanguageMatrix();

describe('restart_debugging e2e', () => {
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
      { name: 'restart-test-client', version: '1.0.0' },
      { capabilities: {} },
    );
    await mcpClient.connect(transport);
    prepareLanguageMatrix(LANGUAGES);
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

  async function waitForState(sessionId: string, states: string[], timeoutMs = 30_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let lastState = 'unknown';
    while (Date.now() < deadline) {
      const res = await callToolSafely(mcpClient!, 'list_debug_sessions', {});
      const sessions = (res as { sessions?: Array<{ id: string; state: string }> }).sessions ?? [];
      const session = sessions.find(s => s.id === sessionId);
      lastState = session?.state ?? 'gone';
      if (session === undefined || states.includes(lastState)) {
        return lastState;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out waiting for state in [${states.join(', ')}]; last state: ${lastState}`);
  }

  /** Continue (with the rust/win32 #255 step_over workaround) until the program exits. */
  async function driveToCompletion(sessionId: string, language: string): Promise<void> {
    for (let i = 0; i < 25; i++) {
      if (language === 'rust' && process.platform === 'win32') {
        await callToolSafely(mcpClient!, 'step_over', { sessionId });
        await waitForState(sessionId, ['paused', 'stopped', 'terminated']);
      }
      await callToolSafely(mcpClient!, 'continue_execution', { sessionId });
      const state = await waitForState(sessionId, ['paused', 'stopped', 'terminated']);
      if (state !== 'paused') {
        return;
      }
    }
    throw new Error('Program did not run to completion within 25 continues');
  }

  for (const lang of LANGUAGES) {
    const itFn = lang.available ? it : it.skip;
    const title = `restart while paused and after exit (${lang.language})${lang.available ? '' : ` — ${lang.skipReason}`}`;

    itFn(title, async () => {
      // 1. create + breakpoint + launch → paused
      const createRes = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: lang.language, name: `restart-${lang.language}` },
      });
      currentSessionId = parseSdkToolResult(createRes).sessionId as string;

      const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
        sessionId: currentSessionId, file: lang.script, line: lang.bpLine,
      });
      expect(bpRes.success).toBe(true);

      const startRes = await callToolSafely(mcpClient!, 'start_debugging', {
        sessionId: currentSessionId,
        scriptPath: lang.launchScript ?? lang.script,
        dapLaunchArgs: { stopOnEntry: false, ...(lang.dapLaunchArgs ?? {}) },
      });
      expect(startRes.success).toBe(true);
      await waitForState(currentSessionId, ['paused']);

      // 2. restart while PAUSED (live proxy — landmine regression)
      const restart1 = await callToolSafely(mcpClient!, 'restart_debugging', {
        sessionId: currentSessionId,
      });
      expect(restart1.success).toBe(true);
      const data1 = (restart1 as { data?: { breakpointsReapplied?: number; outputReset?: boolean } }).data;
      expect(data1?.breakpointsReapplied).toBeGreaterThanOrEqual(1);
      expect(data1?.outputReset).toBe(true);
      await waitForState(currentSessionId, ['paused']);

      // The session survived and still tracks its breakpoint
      const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId: currentSessionId });
      expect(listRes.count).toBe(1);

      // 3. run to completion
      await driveToCompletion(currentSessionId, lang.language);

      // 4. restart from TERMINATED — the breakpoint must hit again without
      // re-issuing set_breakpoint
      const restart2 = await callToolSafely(mcpClient!, 'restart_debugging', {
        sessionId: currentSessionId,
      });
      expect(restart2.success).toBe(true);
      const stateAfter = await waitForState(currentSessionId, ['paused']);
      expect(stateAfter).toBe('paused');

      // Fresh output buffer: reading from since=0 succeeds on the new launch
      const outRes = await callToolSafely(mcpClient!, 'get_output', {
        sessionId: currentSessionId, since: 0,
      });
      expect(outRes.success).toBe(true);
    }, 120_000);
  }
});
