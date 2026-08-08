/**
 * set_breakpoint logMessage (logpoint) gating tests (issue #235).
 *
 * Hybrid static-first gating: a known-unsupported adapter (policy
 * supportsLogPoints === false, or live capabilities false) is a hard error;
 * known-supported passes; unknown support (policy undefined, e.g. ruby)
 * passes with a warning and is validated again at launch via the
 * capability drift warning.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getToolHandlers
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('set_breakpoint logMessage gating', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });

    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });

    new DebugMcpServer();
    callToolHandler = getToolHandlers(mockServer).callToolHandler;

    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active'
    });
    mockSessionManager.setBreakpoint.mockResolvedValue({
      breakpoint: {
        id: 'bp-1',
        file: '/path/to/test.py',
        line: 10,
        logMessage: 'x is {x}',
        verified: false
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function callSetBreakpoint(extra: Record<string, unknown> = {}) {
    return callToolHandler({
      method: 'tools/call',
      params: {
        name: 'set_breakpoint',
        arguments: {
          sessionId: 'test-session',
          file: '/path/to/test.py',
          line: 10,
          logMessage: 'x is {x}',
          ...extra
        }
      }
    });
  }

  it('rejects logMessage when the adapter policy declares no logpoint support', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'java', supportsLogPoints: false });

    await expect(callSetBreakpoint()).rejects.toThrow(/[Ll]ogpoint/);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('rejects logMessage when live adapter capabilities deny logpoints', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'python', supportsLogPoints: true });
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active',
      adapterCapabilities: { supportsLogPoints: false }
    });

    await expect(callSetBreakpoint()).rejects.toThrow(/[Ll]ogpoint/);
  });

  it('accepts and forwards logMessage when the policy supports logpoints', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'python', supportsLogPoints: true });

    const result = await callSetBreakpoint();

    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({
        file: expect.stringContaining('/path/to/test.py'),
        line: 10,
        logMessage: 'x is {x}'
      })
    );
    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.logMessage).toBe('x is {x}');
  });

  it('accepts with a warning when logpoint support is unknown', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'ruby' });

    const result = await callSetBreakpoint();

    expect(mockSessionManager.setBreakpoint).toHaveBeenCalled();
    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.warning).toMatch(/unknown|not advertise/i);
  });

  it('applies no gating when logMessage is absent', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'java', supportsLogPoints: false });
    mockSessionManager.setBreakpoint.mockResolvedValue({
      breakpoint: { id: 'bp-2', file: '/path/to/test.py', line: 10, verified: false }
    });

    const result = await callToolHandler({
      method: 'tools/call',
      params: {
        name: 'set_breakpoint',
        arguments: { sessionId: 'test-session', file: '/path/to/test.py', line: 10 }
      }
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
  });
});
