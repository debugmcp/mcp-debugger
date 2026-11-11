/**
 * The launch-shaped tools and the DAP mirror refuse a child session by name
 * (the session tree, issue #1081). A child is a session the server created
 * when the adapter reported a process the debuggee started: it was started by
 * its parent, it has no launch of its own to replay, and the mirror follows
 * the root's connection. So start_debugging, restart_debugging,
 * attach_to_process, detach_from_process, expose_session and
 * unexpose_session answer a failed result naming the parent before any
 * session-manager operation runs — the way the attach contract refuses an
 * undeclared addressing form (issue #903). A root session and an id the
 * server does not know are not touched by the gate.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { Server } from '@modelcontextprotocol/server';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies, type Dependencies } from '../../../../src/container/dependencies.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getToolHandlers,
  type CallToolHandler,
  type MockServer,
  type MockSessionManager,
  createDebugServerWithFacade
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/server', async () =>
  (await import('../../../test-utils/mocks/sdk-server-module.js')).sdkServerModuleMock());
vi.mock('@modelcontextprotocol/server/stdio');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

/** What the handlers read off a session: the child carries parentSessionId, the root does not. */
const CHILD_SESSION = { id: 'child-1', parentSessionId: 'root-1', state: 'paused', sessionLifecycle: 'active' };
const ROOT_SESSION = { id: 'root-1', state: 'paused', sessionLifecycle: 'active' };

const REFUSAL_TEXT = 'is a child session; it was started by its parent';

type RefusedTool = {
  tool: string;
  /** The arguments beyond sessionId the tool's schema requires or the handler reads. */
  args: Record<string, unknown>;
  /** The session-manager method the handler calls once past the gate. */
  method: 'startDebugging' | 'restartDebugging' | 'attachToProcess' | 'detachFromProcess' | 'exposeSession' | 'unexposeSession';
  /** A plausible success answer, so a handler that is NOT gated completes instead of dying on `undefined.success`. */
  resolves: Record<string, unknown>;
};

const REFUSED_TOOLS: RefusedTool[] = [
  {
    tool: 'start_debugging',
    args: { scriptPath: '/path/to/parent.py' },
    method: 'startDebugging',
    resolves: { success: true, state: 'paused', data: {} }
  },
  {
    tool: 'restart_debugging',
    args: {},
    method: 'restartDebugging',
    resolves: { success: true, state: 'paused', data: {} }
  },
  {
    tool: 'attach_to_process',
    args: { port: 5678 },
    method: 'attachToProcess',
    resolves: { success: true, state: 'paused' }
  },
  {
    tool: 'detach_from_process',
    args: {},
    method: 'detachFromProcess',
    resolves: { success: true, state: 'stopped' }
  },
  {
    tool: 'expose_session',
    args: {},
    method: 'exposeSession',
    resolves: { success: true, state: 'paused', host: '127.0.0.1', port: 51234, token: 'tkn-abc' }
  },
  {
    tool: 'unexpose_session',
    args: {},
    method: 'unexposeSession',
    resolves: { success: true, state: 'paused', wasExposed: true }
  }
];

describe('child session refusals (session tree, issue #1081)', () => {
  let mockServer: MockServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;
  let callToolHandler: CallToolHandler;

  const callTool = (name: string, args: Record<string, unknown>) =>
    callToolHandler({ method: 'tools/call', params: { name, arguments: args } });

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function () { return mockServer as any; });

    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function () { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function () { return mockSessionManager as any; });

    createDebugServerWithFacade();
    callToolHandler = getToolHandlers(mockServer).callToolHandler;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(REFUSED_TOOLS)('$tool refuses a child session by name before any session-manager operation', async ({ tool, args, method, resolves }) => {
    mockSessionManager.getSession.mockReturnValue(CHILD_SESSION);
    mockSessionManager[method].mockResolvedValue(resolves);

    const result = await callTool(tool, { sessionId: 'child-1', ...args });
    const content = JSON.parse(result.content[0].text);

    expect(content.success).toBe(false);
    expect(content.error).toContain(REFUSAL_TEXT);
    expect(content.error).toContain(tool);
    expect(content.error).toContain('child-1');
    expect(content.error).toContain('root-1');
    expect(content.error).toContain('close_debug_session');
    expect(mockSessionManager[method]).not.toHaveBeenCalled();
  });

  it.each(REFUSED_TOOLS)('$tool reaches the session manager for a root session', async ({ tool, args, method, resolves }) => {
    mockSessionManager.getSession.mockReturnValue(ROOT_SESSION);
    mockSessionManager[method].mockResolvedValue(resolves);

    const result = await callTool(tool, { sessionId: 'root-1', ...args });
    const content = JSON.parse(result.content[0].text);

    expect(mockSessionManager[method]).toHaveBeenCalled();
    expect(content.success).toBe(true);
    expect(JSON.stringify(content)).not.toContain(REFUSAL_TEXT);
  });

  it('leaves an unknown id to the handler\'s own not-found answer', async () => {
    // Only a session that exists AND carries parentSessionId is a child: an id
    // the server does not know falls through to the not-found path, with no
    // claim about a parent it cannot name.
    mockSessionManager.getSession.mockReturnValue(undefined);

    const result = await callTool('restart_debugging', { sessionId: 'ghost' });
    const content = JSON.parse(result.content[0].text);

    expect(content.success).toBe(false);
    expect(content.error).toContain('Session not found: ghost');
    expect(content.error).not.toContain(REFUSAL_TEXT);
    expect(mockSessionManager.restartDebugging).not.toHaveBeenCalled();
  });
});
