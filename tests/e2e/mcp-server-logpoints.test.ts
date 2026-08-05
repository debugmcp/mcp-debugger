/**
 * E2E: logpoints (set_breakpoint logMessage) — issue #235.
 *
 * Supported adapters (python, javascript, go, rust, mock): a logpoint on a
 * hot line does NOT pause execution; the interpolated message arrives as
 * output readable via get_output.
 *
 * Known-unsupported adapters (java, dotnet): set_breakpoint with logMessage
 * fails fast with a clear error.
 *
 * Unknown support (ruby): accepted with a warning; runtime behavior is
 * adapter-dependent and not asserted.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import path from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parseSdkToolResult, callToolSafely } from './smoke-test-utils.js';
import { ROOT, createLanguageMatrix, prepareLanguageMatrix } from './language-matrix-utils.js';

const LANGUAGES = createLanguageMatrix();

// Per-language expectation: how the logpoint request should behave.
const EXPECTATION: Record<string, 'logs' | 'error' | 'warning'> = {
  python: 'logs',
  javascript: 'logs',
  go: 'logs',
  rust: 'logs',
  mock: 'logs',
  java: 'error',
  dotnet: 'error',
  ruby: 'warning',
};

// Python's bpLine has a=1, b=2 in scope — assert real interpolation there.
const LOG_MESSAGES: Record<string, { message: string; expectInOutput?: string }> = {
  python: { message: 'LP-MARK a={a}', expectInOutput: 'LP-MARK a=1' },
  default: { message: 'LP-MARK plain', expectInOutput: 'LP-MARK plain' },
};

describe('Logpoints e2e (set_breakpoint logMessage)', () => {
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
      { name: 'logpoints-test-client', version: '1.0.0' },
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

  for (const lang of LANGUAGES) {
    const expectation = EXPECTATION[lang.language] ?? 'warning';
    const itFn = lang.available ? it : it.skip;
    const title = `logpoint ${expectation === 'logs' ? 'logs without pausing' : expectation === 'error' ? 'is rejected with a clear error' : 'is accepted with a warning'} (${lang.language})${lang.available ? '' : ` — ${lang.skipReason}`}`;

    itFn(title, async () => {
      const createRes = await mcpClient!.callTool({
        name: 'create_debug_session',
        arguments: { language: lang.language, name: `logpoint-${lang.language}` },
      });
      currentSessionId = parseSdkToolResult(createRes).sessionId as string;
      expect(currentSessionId).toBeTruthy();

      const { message, expectInOutput } = LOG_MESSAGES[lang.language] ?? LOG_MESSAGES.default;
      const bpRes = await callToolSafely(mcpClient!, 'set_breakpoint', {
        sessionId: currentSessionId,
        file: lang.script,
        line: lang.bpLine,
        logMessage: message,
      });

      if (expectation === 'error') {
        expect(bpRes.success).toBe(false);
        expect(JSON.stringify(bpRes)).toMatch(/[Ll]ogpoint/);
        return;
      }

      expect(bpRes.success).toBe(true);
      expect((bpRes as { logMessage?: string }).logMessage).toBe(message);
      if (expectation === 'warning') {
        expect(String((bpRes as { warning?: string }).warning ?? '')).toMatch(/unknown/i);
        return; // runtime behavior for unknown-support adapters is not asserted
      }

      // Supported adapter: launch and let it run — the logpoint must not pause.
      const startRes = await callToolSafely(mcpClient!, 'start_debugging', {
        sessionId: currentSessionId,
        scriptPath: lang.launchScript ?? lang.script,
        dapLaunchArgs: { stopOnEntry: false, ...(lang.dapLaunchArgs ?? {}) },
      });
      expect(startRes.success).toBe(true);

      // If the logpoint wrongly paused execution, this times out at 'paused'.
      const finalState = await waitForState(currentSessionId, ['stopped', 'terminated']);
      expect(['stopped', 'terminated', 'gone']).toContain(finalState);

      // The interpolated message must be in the captured output.
      const outRes = await callToolSafely(mcpClient!, 'get_output', {
        sessionId: currentSessionId,
        since: 0,
      });
      const outputText = JSON.stringify((outRes as { entries?: unknown[] }).entries ?? []);
      expect(outputText).toContain(expectInOutput);
    }, 60_000);
  }
});
