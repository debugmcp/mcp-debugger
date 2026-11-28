/**
 * Issue #1320: policy-driven guidance when a line breakpoint does not bind
 * (or its live sync is refused) because the adapter's message describes the
 * target's file system rather than the caller's host.
 *
 * Pins Ruby's exact pre-#1320 answers character-for-character so moving
 * `liveSyncHint` onto `AdapterPolicy.describeUnboundBreakpoint` cannot alter
 * them, and verifies Python's attach-only debugpy file-missing hint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebugLanguage, SessionState, type UnboundBreakpointContext } from '@debugmcp/shared';
import { DebugMcpServer } from '../../../../../src/server.js';
import { registerToolHandlers } from '../../../../../src/server/tool-dispatch.js';
import type { ToolResult } from '../../../../../src/server/tool-result.js';
import { createProductionDependencies, type Dependencies } from '../../../../../src/container/dependencies.js';
import { DapResponseError } from '../../../../../src/proxy/dap-response-error.js';
import type { IProxyManager } from '../../../../../src/proxy/proxy-manager.js';
import { markChildMirrorUnanswered } from '../../../../../src/utils/child-origin-events.js';
import { createMockDependencies } from '../session-manager-test-utils.js';

vi.mock('../../../../../src/container/dependencies.js');

const RUBY_LOCALFS_HINT =
  "Hint: attach sessions send breakpoint paths to the remote debugger verbatim; the path must be valid on the debug target's filesystem. Use target-side paths, or pass localfsMap in the attach config to map local paths to remote ones.";

type CallTool = (request: { method: string; params: { name: string; arguments: Record<string, unknown> } }) => Promise<ToolResult>;

function getCallTool(core: DebugMcpServer): CallTool {
  const handlers = new Map<string, CallTool>();
  registerToolHandlers(
    { setRequestHandler: (method: string, handler: CallTool) => handlers.set(method, handler) } as never,
    core
  );
  const callTool = handlers.get('tools/call');
  if (!callTool) {
    throw new Error('tools/call handler was not registered');
  }
  return callTool;
}

function parseToolJson(result: ToolResult): Record<string, unknown> {
  const first = result.content[0];
  if (!first || typeof first !== 'object' || !('text' in first) || typeof first.text !== 'string') {
    throw new Error('Expected JSON text content in ToolResult');
  }
  return JSON.parse(first.text) as Record<string, unknown>;
}

function refusal(command: string, message: string): DapResponseError {
  return new DapResponseError({
    seq: 1,
    type: 'response',
    request_seq: 1,
    success: false,
    command,
    message
  });
}

describe('Ruby attach unbound-path answers stay character-for-character identical (#357, #1320)', () => {
  let core: DebugMcpServer;
  let callTool: CallTool;
  let sendDapRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const deps = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(deps as unknown as Dependencies);
    core = new DebugMcpServer();
    callTool = getCallTool(core);
    sendDapRequest = vi.fn();
  });

  afterEach(async () => {
    await core.sessionManager.closeAllSessions().catch(() => undefined);
    vi.clearAllMocks();
  });

  async function createPausedSession(language: DebugLanguage, attachMode: boolean): Promise<string> {
    const info = await core.sessionManager.createSession({ language });
    const session = core.sessionManager.getSession(info.id)!;
    session.state = SessionState.PAUSED;
    session.run.attachMode = attachMode;
    if (attachMode) {
      session.run.attachLocality = 'remote';
    }
    session.proxyManager = {
      isRunning: () => true,
      sendDapRequest
    } as unknown as IProxyManager;
    return info.id;
  }

  it('pins the exact set_breakpoint and list_breakpoints answers when rdbg refuses a path on attach', async () => {
    const sessionId = await createPausedSession(DebugLanguage.RUBY, true);
    sendDapRequest.mockRejectedValueOnce(refusal('setBreakpoints', '/host/path/app.rb is not available'));

    const setRes = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/host/path/app.rb', line: 12 }
        }
      })
    );

    expect(typeof setRes.breakpointId).toBe('string');
    expect(setRes).toEqual({
      success: true,
      breakpointId: setRes.breakpointId,
      file: '/host/path/app.rb',
      line: 12,
      requestedLine: 12,
      verified: false,
      message: '/host/path/app.rb is not available',
      warning: `Breakpoint state updated, but live sync failed: /host/path/app.rb is not available (${RUBY_LOCALFS_HINT})`,
      note: "content and context omitted: the target of this attach is not on the mcp-debugger host, so the host file is not the debuggee's source"
    });

    const listRes = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'list_breakpoints',
          arguments: { sessionId }
        }
      })
    );

    expect(listRes).toEqual({
      success: true,
      breakpoints: [
        {
          id: setRes.breakpointId,
          file: '/host/path/app.rb',
          line: 12,
          requestedLine: 12,
          verified: false,
          message: '/host/path/app.rb is not available',
          messageOrigin: 'refusal'
        }
      ],
      count: 1,
      functionBreakpoints: [],
      functionCount: 0
    });
  });

  it('pins the exact set_breakpoint answer on a Ruby launch (no attach hint) and for another error on attach', async () => {
    const launchId = await createPausedSession(DebugLanguage.RUBY, false);
    sendDapRequest.mockRejectedValueOnce(refusal('setBreakpoints', '/host/path/app.rb is not available'));

    const launchRes = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId: launchId, file: '/host/path/app.rb', line: 12 }
        }
      })
    );
    expect(launchRes.message).toBe('/host/path/app.rb is not available');
    expect(launchRes.warning).toBe('Breakpoint state updated, but live sync failed: /host/path/app.rb is not available');

    const attachId = await createPausedSession(DebugLanguage.RUBY, true);
    sendDapRequest.mockRejectedValueOnce(refusal('setBreakpoints', 'Connection lost'));

    const otherErrRes = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId: attachId, file: '/host/path/app.rb', line: 12 }
        }
      })
    );
    expect(otherErrRes.message).toBe('Connection lost');
    expect(otherErrRes.warning).toBe('Breakpoint state updated, but live sync failed: Connection lost');
  });

  it('adds no hint on a Ruby attach when setBreakpoints succeeds with verified: false and "<path> is not available"', async () => {
    const sessionId = await createPausedSession(DebugLanguage.RUBY, true);
    sendDapRequest.mockResolvedValueOnce({
      body: { breakpoints: [{ id: 0, verified: false, message: '/host/path/app.rb is not available' }] }
    });

    const setRes = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/host/path/app.rb', line: 12 }
        }
      })
    );

    expect(typeof setRes.breakpointId).toBe('string');
    expect(setRes).toEqual({
      success: true,
      breakpointId: setRes.breakpointId,
      file: '/host/path/app.rb',
      line: 12,
      requestedLine: 12,
      verified: false,
      message: '/host/path/app.rb is not available',
      warning: '/host/path/app.rb is not available',
      note: "content and context omitted: the target of this attach is not on the mcp-debugger host, so the host file is not the debuggee's source"
    });
  });
});

describe('Python attach unbound-file hint and cross-engine non-matching (#1320)', () => {
  const DEBUGPY_SENTENCE = 'Breakpoint in file that does not exist.';
  const PYTHON_HINT =
    "debugpy looked for this path, after any adapterConfig.pathMappings, on the target's file system. " +
    'If the target runs in a container or on another machine, attach with a pathMappings entry whose ' +
    'localRoot contains this file and whose remoteRoot is the same directory on the target, or set the ' +
    "breakpoint by the target's own path when no pathMappings entry rewrites it.";

  let core: DebugMcpServer;
  let callTool: CallTool;
  let sendDapRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const deps = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(deps as unknown as Dependencies);
    core = new DebugMcpServer();
    callTool = getCallTool(core);
    sendDapRequest = vi.fn();
  });

  afterEach(async () => {
    await core.sessionManager.closeAllSessions().catch(() => undefined);
    vi.clearAllMocks();
  });

  async function createPausedSession(language: DebugLanguage, attachMode: boolean): Promise<string> {
    const info = await core.sessionManager.createSession({ language });
    const session = core.sessionManager.getSession(info.id)!;
    session.state = SessionState.PAUSED;
    session.run.attachMode = attachMode;
    if (attachMode) {
      session.run.attachLocality = 'remote';
    }
    session.proxyManager = {
      isRunning: () => true,
      sendDapRequest
    } as unknown as IProxyManager;
    return info.id;
  }

  it("joins Python's hint after debugpy's sentence in set_breakpoint warning on attach, leaving message unchanged", async () => {
    const sessionId = await createPausedSession(DebugLanguage.PYTHON, true);
    sendDapRequest.mockResolvedValueOnce({
      body: { breakpoints: [{ id: 0, verified: false, message: DEBUGPY_SENTENCE }] }
    });

    const res = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/path/to/local/app.py', line: 15 }
        }
      })
    );

    expect(res.verified).toBe(false);
    expect(res.message).toBe(DEBUGPY_SENTENCE);
    expect(res.warning).toBe(`${DEBUGPY_SENTENCE}; ${PYTHON_HINT}`);

    const listRes = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'list_breakpoints',
          arguments: { sessionId }
        }
      })
    );
    expect(listRes.breakpoints).toEqual([
      expect.objectContaining({
        file: '/path/to/local/app.py',
        line: 15,
        verified: false,
        message: DEBUGPY_SENTENCE
      })
    ]);
  });

  it('adds no hint on a Python launch session with the exact debugpy sentence', async () => {
    const sessionId = await createPausedSession(DebugLanguage.PYTHON, false);
    sendDapRequest.mockResolvedValueOnce({
      body: { breakpoints: [{ id: 0, verified: false, message: DEBUGPY_SENTENCE }] }
    });

    const res = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/path/to/local/app.py', line: 15 }
        }
      })
    );

    expect(res.verified).toBe(false);
    expect(res.message).toBe(DEBUGPY_SENTENCE);
    expect(res.warning).toBe(DEBUGPY_SENTENCE);
  });

  it.each([
    'Breakpoint in file excluded by filters.',
    'Breakpoint in file that does not exist',
    '/path/to/local/app.py is not available'
  ])('adds no hint on a Python attach for another message (%j)', async (otherMessage) => {
    const sessionId = await createPausedSession(DebugLanguage.PYTHON, true);
    sendDapRequest.mockResolvedValueOnce({
      body: { breakpoints: [{ id: 0, verified: false, message: otherMessage }] }
    });

    const res = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/path/to/local/app.py', line: 15 }
        }
      })
    );

    expect(res.verified).toBe(false);
    expect(res.message).toBe(otherMessage);
    expect(res.warning).toBe(otherMessage);
  });

  it('adds no hint on a Python attach when the breakpoint is verified', async () => {
    const sessionId = await createPausedSession(DebugLanguage.PYTHON, true);
    sendDapRequest.mockResolvedValueOnce({
      body: { breakpoints: [{ id: 1, verified: true, line: 15, message: DEBUGPY_SENTENCE }] }
    });

    const res = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/path/to/local/app.py', line: 15 }
        }
      })
    );

    expect(res.verified).toBe(true);
    expect(res.warning).toBeUndefined();
  });

  it('adds no Python unverified-file hint when setBreakpoints is refused on attach with debugpy sentence', async () => {
    const sessionId = await createPausedSession(DebugLanguage.PYTHON, true);
    sendDapRequest.mockRejectedValueOnce(refusal('setBreakpoints', DEBUGPY_SENTENCE));

    const res = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/path/to/local/app.py', line: 15 }
        }
      })
    );

    expect(res.verified).toBe(false);
    expect(res.message).toBe(DEBUGPY_SENTENCE);
    expect(res.warning).toBe(`Breakpoint state updated, but live sync failed: ${DEBUGPY_SENTENCE}`);
  });

  it('does not call describeUnboundBreakpoint when an unverified reply omits message', async () => {
    const sessionId = await createPausedSession(DebugLanguage.PYTHON, true);
    const describeSpy = vi.fn((_info: UnboundBreakpointContext) => 'should not be called');
    vi.spyOn(core.sessionManager as unknown as { selectPolicy: () => unknown }, 'selectPolicy').mockReturnValue({
      describeUnboundBreakpoint: describeSpy
    });
    sendDapRequest.mockResolvedValueOnce({
      body: { breakpoints: [{ id: 0, verified: false }] }
    });

    const res = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/path/to/local/app.py', line: 15 }
        }
      })
    );

    expect(describeSpy).not.toHaveBeenCalled();
    expect(res.verified).toBe(false);
    expect(res.warning).toBeUndefined();
  });

  it('keeps sync.warning and skips describeUnboundBreakpoint when a mirrored target did not answer', async () => {
    const sessionId = await createPausedSession(DebugLanguage.PYTHON, true);
    const describeSpy = vi.fn((_info: UnboundBreakpointContext) => 'should not be appended');
    vi.spyOn(core.sessionManager as unknown as { selectPolicy: () => unknown }, 'selectPolicy').mockReturnValue({
      describeUnboundBreakpoint: describeSpy
    });
    const unansweredResponse = {
      body: { breakpoints: [{ id: 0, verified: false, message: DEBUGPY_SENTENCE }] }
    };
    markChildMirrorUnanswered(unansweredResponse);
    sendDapRequest.mockResolvedValueOnce(unansweredResponse);

    const res = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/path/to/local/app.py', line: 15 }
        }
      })
    );

    expect(describeSpy).not.toHaveBeenCalled();
    expect(res.verified).toBe(false);
    expect(res.warning).not.toContain('should not be appended');
    expect(String(res.warning)).toContain('app.py');
  });

  it.each([DebugLanguage.JAVASCRIPT, DebugLanguage.GO, DebugLanguage.MOCK])(
    'adds no hint for an engine that does not implement describeUnboundBreakpoint (%s)',
    async (language) => {
      const sessionId = await createPausedSession(language, true);
      sendDapRequest.mockResolvedValueOnce({
        body: { breakpoints: [{ id: 0, verified: false, message: DEBUGPY_SENTENCE }] }
      });

      const res = parseToolJson(
        await callTool({
          method: 'tools/call',
          params: {
            name: 'set_breakpoint',
            arguments: { sessionId, file: '/path/to/local/app.txt', line: 10 }
          }
        })
      );

      expect(res.verified).toBe(false);
      expect(res.warning).toBe(DEBUGPY_SENTENCE);
    }
  );

  it('degrades to no hint without failing set_breakpoint when a custom policy hook throws', async () => {
    const sessionId = await createPausedSession(DebugLanguage.PYTHON, true);
    vi.spyOn(core.sessionManager as unknown as { selectPolicy: () => unknown }, 'selectPolicy').mockReturnValue({
      describeUnboundBreakpoint: () => {
        throw new Error('policy boom');
      }
    });
    sendDapRequest.mockResolvedValueOnce({
      body: { breakpoints: [{ id: 0, verified: false, message: DEBUGPY_SENTENCE }] }
    });

    const res = parseToolJson(
      await callTool({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId, file: '/path/to/local/app.py', line: 15 }
        }
      })
    );

    expect(res.success).toBe(true);
    expect(res.warning).toBe(DEBUGPY_SENTENCE);
  });
});
