/**
 * Tests for the structured tool:response log line (issue #397).
 *
 * The `success` field must reflect the tool payload's own `success` boolean —
 * a handler that returns { success: false } without throwing is a failed tool
 * call and must not be logged as success: true.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { SessionState } from '@debugmcp/shared';
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

describe('tool:response logging (issue #397)', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function () { return mockServer as any; });

    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function () { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function () { return mockSessionManager as any; });

    new DebugMcpServer();
    callToolHandler = getToolHandlers(mockServer).callToolHandler;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function toolResponseLogEntries(): Array<Record<string, unknown>> {
    return mockDependencies.logger.info.mock.calls
      .filter((call: unknown[]) => call[0] === 'tool:response')
      .map((call: unknown[]) => call[1] as Record<string, unknown>);
  }

  it('logs success: false when the tool payload reports failure', async () => {
    mockSessionManager.attachToProcess.mockResolvedValue({
      success: false,
      state: SessionState.ERROR,
      error: 'Attach did not become debuggable: no threads reported within 5000ms'
    });

    const result = await callToolHandler({
      method: 'tools/call',
      params: {
        name: 'attach_to_process',
        arguments: { sessionId: 'sess-1', port: 5678 }
      }
    });

    // Sanity: the payload itself reports failure without throwing
    expect(JSON.parse(result.content[0].text).success).toBe(false);

    const entries = toolResponseLogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ tool: 'attach_to_process', success: false });
  });

  it('logs success: true when the tool payload reports success', async () => {
    mockSessionManager.attachToProcess.mockResolvedValue({
      success: true,
      state: SessionState.PAUSED,
      data: { message: 'Attached' }
    });

    const result = await callToolHandler({
      method: 'tools/call',
      params: {
        name: 'attach_to_process',
        arguments: { sessionId: 'sess-1', port: 5678 }
      }
    });

    expect(JSON.parse(result.content[0].text).success).toBe(true);

    const entries = toolResponseLogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ tool: 'attach_to_process', success: true });
  });
});
