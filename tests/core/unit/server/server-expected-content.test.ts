/**
 * set_breakpoint expectedContent assertion tests (issue #271, phase 1).
 *
 * expectedContent is a set-time checksum on intent: the server hard-errors
 * BEFORE storing anything when the target line's trimmed content does not
 * match, and the error carries the actual nearby lines so the agent can
 * correct in one step.
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
  'def total_cart():',
  '    prices = load()',
  '    total = sum(prices)',
  '    return total',
  '',
  'def main():'
].join('\n');

describe('set_breakpoint expectedContent (#271)', () => {
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
    mockSessionManager.setBreakpoint.mockResolvedValue({
      breakpoint: {
        id: 'bp-1',
        file: '/path/to/test.py',
        line: 3,
        verified: false
      }
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function callSetBreakpoint(args: Record<string, unknown>) {
    return callToolHandler({
      method: 'tools/call',
      params: {
        name: 'set_breakpoint',
        arguments: {
          sessionId: 'test-session',
          file: '/path/to/test.py',
          ...args
        }
      }
    });
  }

  it('sets the breakpoint when the line content matches', async () => {
    const result = await callSetBreakpoint({
      line: 3,
      expectedContent: 'total = sum(prices)'
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ line: 3 })
    );
  });

  it('rejects with expected/actual and context when the content does not match', async () => {
    let thrown: Error | undefined;
    try {
      await callSetBreakpoint({ line: 4, expectedContent: 'total = sum(prices)' });
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain('does not match expectedContent');
    expect(thrown!.message).toContain('Expected: "total = sum(prices)"');
    expect(thrown!.message).toMatch(/Actual:\s+"return total"/);
    expect(thrown!.message).toMatch(/>\s+4 \|/);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('rejects expectedContent for attach sessions (no host-readable file)', async () => {
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active',
      attachMode: true
    });

    await expect(
      callSetBreakpoint({ line: 3, expectedContent: 'total = sum(prices)' })
    ).rejects.toThrow(/line addressing/i);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('rejects expectedContent for non-file source identifiers (Java FQCN)', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({
      isNonFileSourceIdentifier: (f: string) => !f.includes('/')
    });

    await expect(
      callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: {
            sessionId: 'test-session',
            file: 'com.example.MyClass',
            line: 3,
            expectedContent: 'total = sum(prices)'
          }
        }
      })
    ).rejects.toThrow(/line addressing/i);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('rejects clearly when the file cannot be read for verification', async () => {
    mockDependencies.fileSystem.readFile.mockRejectedValue(new Error('EACCES'));
    mockDependencies.fileSystem.stat.mockRejectedValue(new Error('EACCES'));

    await expect(
      callSetBreakpoint({ line: 3, expectedContent: 'total = sum(prices)' })
    ).rejects.toThrow(/could not read/i);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('applies no content check when expectedContent is absent', async () => {
    const result = await callSetBreakpoint({ line: 4 });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(mockSessionManager.setBreakpoint).toHaveBeenCalled();
  });
});
