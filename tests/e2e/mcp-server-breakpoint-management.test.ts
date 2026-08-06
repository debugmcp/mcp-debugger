/**
 * E2E: breakpoint management tools against live debug sessions (issue #236).
 *
 * Universal flow per language (works for linear and loop scripts):
 *   1. set two breakpoints (bpLine + laterLine) before launch
 *   2. launch (stopOnEntry: false) → pause at the first breakpoint
 *   3. list_breakpoints → both present; the hit one is verified
 *   4. remove_breakpoint (the later one, by id) → takes effect live
 *   5. clear_breakpoints → nothing left
 *   6. continue → program must run to completion: if the removal or clear had
 *      not reached the adapter, a linear script would re-stop at the later
 *      line and a loop script would re-stop at the first line.
 *
 * Languages missing their toolchain skip individually (CI runs the subset it
 * provisions; the full matrix runs on a fully-equipped dev box).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { ROOT, createLanguageMatrix, prepareLanguageMatrix } from './language-matrix-utils.js';

const LANGUAGES = createLanguageMatrix();

describe('Breakpoint management e2e (list/remove/clear)', () => {
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
      { name: 'breakpoint-management-test-client', version: '1.0.0' },
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

  /** Poll list_debug_sessions until the session reaches one of the states. */
  async function waitForState(sessionId: string, states: string[], timeoutMs = 20_000): Promise<string> {
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

  for (const lang of LANGUAGES) {
    const itFn = lang.available ? it : it.skip;
    const title = `live remove + clear take effect (${lang.language})${lang.available ? '' : ` — ${lang.skipReason}`}`;

    itFn(title, async () => {
      // 1. create session + set both breakpoints before launch
      const createRes = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: lang.language, name: `bp-mgmt-${lang.language}` },
      });
      currentSessionId = parseSdkToolResult(createRes).sessionId as string;
      expect(currentSessionId).toBeTruthy();

      const bp1 = await callToolSafely(mcpClient!, 'set_breakpoint', {
        sessionId: currentSessionId, file: lang.script, line: lang.bpLine,
      });
      const bp2 = await callToolSafely(mcpClient!, 'set_breakpoint', {
        sessionId: currentSessionId, file: lang.script, line: lang.laterLine,
      });
      expect(bp1.success).toBe(true);
      expect(bp2.success).toBe(true);

      // 2. launch → pause at the first breakpoint
      const startRes = await callToolSafely(mcpClient!, 'start_debugging', {
        sessionId: currentSessionId,
        scriptPath: lang.launchScript ?? lang.script,
        dapLaunchArgs: { stopOnEntry: false, ...(lang.dapLaunchArgs ?? {}) },
      });
      expect(startRes.success).toBe(true);
      await waitForState(currentSessionId, ['paused']);

      // 3. list — both breakpoints tracked; ids match what set_breakpoint returned
      const listRes = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId: currentSessionId });
      expect(listRes.success).toBe(true);
      const listed = (listRes as { breakpoints?: Array<{ id: string; line: number; verified: boolean; adapterId?: number }> }).breakpoints ?? [];
      expect(listed.map(bp => bp.id).sort()).toEqual(
        [bp1.breakpointId as string, bp2.breakpointId as string].sort()
      );
      // The breakpoint we are paused at must become verified. Verification is
      // eventually consistent: some adapters (js-debug) bind asynchronously
      // and confirm via DAP breakpoint events milliseconds after the stop.
      const verifiedDeadline = Date.now() + 5_000;
      let hitBpVerified = false;
      while (Date.now() < verifiedDeadline && !hitBpVerified) {
        const poll = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId: currentSessionId });
        const bps = (poll as { breakpoints?: Array<{ id: string; verified: boolean }> }).breakpoints ?? [];
        hitBpVerified = bps.find(bp => bp.id === bp1.breakpointId)?.verified === true;
        if (!hitBpVerified) await new Promise(resolve => setTimeout(resolve, 200));
      }
      expect(hitBpVerified).toBe(true);

      // 4. remove the later breakpoint by id, live
      const removeRes = await callToolSafely(mcpClient!, 'remove_breakpoint', {
        sessionId: currentSessionId, breakpointId: bp2.breakpointId as string,
      });
      expect(removeRes.success).toBe(true);

      // 5. clear the rest
      const clearRes = await callToolSafely(mcpClient!, 'clear_breakpoints', { sessionId: currentSessionId });
      expect(clearRes.success).toBe(true);
      expect(clearRes.cleared).toBe(1);
      const finalList = await callToolSafely(mcpClient!, 'list_breakpoints', { sessionId: currentSessionId });
      expect(finalList.count).toBe(0);

      // 6. continue → nothing left to stop at → program runs to completion.
      // (#255: a macro line resolves to several breakpoint locations, so a
      // continue can re-stop on it; the breakpoints were cleared above, but
      // the step_over keeps the Windows leg robust if one survives.)
      if (lang.language === 'rust' && process.platform === 'win32') {
        await callToolSafely(mcpClient!, 'step_over', { sessionId: currentSessionId });
        await waitForState(currentSessionId, ['paused']);
      }
      const contRes = await callToolSafely(mcpClient!, 'continue_execution', { sessionId: currentSessionId });
      expect(contRes.success).toBe(true);
      const finalState = await waitForState(currentSessionId, ['stopped', 'terminated', 'error']);
      expect(['stopped', 'terminated', 'gone']).toContain(finalState);
    }, 60_000);
  }
});
