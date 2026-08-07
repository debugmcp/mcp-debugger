/**
 * Loud snapping tests (issue #271, phase 1).
 *
 * When the adapter binds a breakpoint to a different line than requested, the
 * response must say so prominently instead of silently mutating the line.
 * Line mode (the A/B control arm) must stay byte-identical to pre-#271
 * behavior: requestedLine is never sent to the session layer.
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

const PY_FILE = [
  'def total_cart():',      // 1
  '    prices = load()',    // 2
  '',                       // 3 (requested)
  '    total = sum(prices)' // 4 (adapter binds here)
].join('\n');

describe('set_breakpoint loud snapping (#271)', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    mockDependencies.fileSystem.readFile.mockResolvedValue(PY_FILE);
    mockDependencies.fileSystem.stat.mockResolvedValue({
      isFile: () => true,
      size: PY_FILE.length,
      mtimeMs: 1000
    });
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
    mockSessionManager.getSessionPolicy.mockReturnValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function callSetBreakpoint(args: Record<string, unknown> = {}) {
    return callToolHandler({
      method: 'tools/call',
      params: {
        name: 'set_breakpoint',
        arguments: {
          sessionId: 'test-session',
          file: '/path/to/test.py',
          line: 3,
          ...args
        }
      }
    });
  }

  it('passes requestedLine to the session layer by default (content mode)', async () => {
    mockSessionManager.setBreakpoint.mockResolvedValue({
      breakpoint: { id: 'bp-1', file: '/path/to/test.py', line: 3, requestedLine: 3, verified: true }
    });

    await callSetBreakpoint();

    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ line: 3, requestedLine: 3 })
    );
  });

  it('omits requestedLine in line mode (control arm purity)', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'line');
    mockSessionManager.setBreakpoint.mockResolvedValue({
      breakpoint: { id: 'bp-1', file: '/path/to/test.py', line: 3, verified: true }
    });

    await callSetBreakpoint();

    const options = mockSessionManager.setBreakpoint.mock.calls[0][1];
    expect('requestedLine' in options).toBe(false);
  });

  it('reports a snap prominently in message, warning, and requestedLine', async () => {
    mockSessionManager.setBreakpoint.mockResolvedValue({
      breakpoint: { id: 'bp-1', file: '/path/to/test.py', line: 4, requestedLine: 3, verified: true }
    });

    const result = await callSetBreakpoint();
    const content = JSON.parse(result.content[0].text);

    expect(content.success).toBe(true);
    expect(content.line).toBe(4);
    expect(content.requestedLine).toBe(3);
    expect(content.message).toContain('requested line 3, bound to line 4');
    expect(content.warning).toContain('requested line 3, bound to line 4');
    // bound-line content is echoed for orientation
    expect(content.message).toContain('total = sum(prices)');
  });

  it('emits no snap warning when the adapter honors the requested line', async () => {
    mockSessionManager.setBreakpoint.mockResolvedValue({
      breakpoint: { id: 'bp-1', file: '/path/to/test.py', line: 3, requestedLine: 3, verified: true }
    });

    const result = await callSetBreakpoint();
    const content = JSON.parse(result.content[0].text);

    expect(content.success).toBe(true);
    expect(content.warning).toBeUndefined();
    expect(content.message).not.toContain('bound to');
  });

  it('surfaces the session-layer sync warning in the response', async () => {
    mockSessionManager.setBreakpoint.mockResolvedValue({
      breakpoint: { id: 'bp-1', file: '/path/to/test.py', line: 3, requestedLine: 3, verified: false },
      warning: 'Breakpoint state updated, but live sync failed: adapter exploded'
    });

    const result = await callSetBreakpoint();
    const content = JSON.parse(result.content[0].text);

    expect(content.success).toBe(true);
    expect(content.warning).toContain('adapter exploded');
  });
});
