/**
 * set_breakpoint statement anchors (issue #271, phase 2).
 *
 * Statement addressing recruits Edit-tool-style content matching instead of
 * line arithmetic: the server resolves `statement` (+ optional `nearLine`)
 * to a line before anything reaches the session layer, stores the anchor on
 * the breakpoint record, and rejects ambiguous or non-executable anchors
 * with self-explanatory errors.
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
  'def a():',                 // 1
  '    total = sum(prices)',  // 2
  '',                         // 3
  'def b():',                 // 4
  '    total = sum(prices)',  // 5
  '    return total',         // 6
].join('\n');

describe('set_breakpoint statement anchors (#271)', () => {
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
    mockSessionManager.setBreakpoint.mockImplementation(
      async (_sessionId: string, bp: { line: number; anchor?: unknown }) => ({
        breakpoint: {
          id: 'bp-1',
          file: '/path/to/test.py',
          line: bp.line,
          requestedLine: bp.line,
          verified: false,
          ...(bp.anchor ? { anchor: bp.anchor } : {})
        }
      })
    );
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

  it('resolves a unique statement to its line and stores the anchor', async () => {
    const result = await callSetBreakpoint({ statement: 'return total' });

    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({
        line: 6,
        requestedLine: 6,
        anchor: { statement: 'return total' }
      })
    );
    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.line).toBe(6);
    expect(content.anchor).toEqual({ statement: 'return total' });
  });

  it('records nearLine on the anchor when provided', async () => {
    await callSetBreakpoint({ statement: 'total = sum(prices)', nearLine: 4 });

    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({
        line: 5,
        anchor: { statement: 'total = sum(prices)', nearLine: 4 }
      })
    );
  });

  it('errors on ambiguity, listing each match', async () => {
    let thrown: Error | undefined;
    try {
      await callSetBreakpoint({ statement: 'total = sum(prices)' });
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain('matches 2 lines');
    expect(thrown!.message).toContain('2: total = sum(prices)');
    expect(thrown!.message).toContain('5: total = sum(prices)');
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('errors when the statement is not found', async () => {
    await expect(
      callSetBreakpoint({ statement: 'does_not_exist()' })
    ).rejects.toThrow(/not found/);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('rejects blank or comment anchors', async () => {
    await expect(
      callSetBreakpoint({ statement: '# just a comment' })
    ).rejects.toThrow(/comment or blank/);
  });

  it('rejects statement combined with line', async () => {
    await expect(
      callSetBreakpoint({ statement: 'return total', line: 6 })
    ).rejects.toThrow(/not both/i);
  });

  it('accepts a redundant expectedContent that matches the statement (#280)', async () => {
    const result = await callSetBreakpoint({
      statement: 'return total',
      expectedContent: '  return total  '
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ line: 6, anchor: { statement: 'return total' } })
    );
  });

  it('rejects statement combined with a DIFFERENT expectedContent (#280)', async () => {
    await expect(
      callSetBreakpoint({ statement: 'return total', expectedContent: 'total = sum(prices)' })
    ).rejects.toThrow(/disagree/);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('rejects function combined with file, line, or statement', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'python', supportsFunctionBreakpoints: true });

    await expect(
      callSetBreakpoint({ function: 'compute' })
    ).rejects.toThrow(/not file-scoped/);

    await expect(
      callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId: 'test-session', function: 'compute', line: 3 }
        }
      })
    ).rejects.toThrow(/cannot be combined/);

    await expect(
      callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId: 'test-session', function: 'compute', statement: 'return total' }
        }
      })
    ).rejects.toThrow(/cannot be combined/);
  });

  it('rejects function combined with logMessage or suspendPolicy', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'python', supportsFunctionBreakpoints: true });

    await expect(
      callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId: 'test-session', function: 'compute', logMessage: 'x={x}' }
        }
      })
    ).rejects.toThrow(/logMessage/);

    await expect(
      callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: { sessionId: 'test-session', function: 'compute', suspendPolicy: 'thread' }
        }
      })
    ).rejects.toThrow(/suspendPolicy/);
  });

  it('rejects nearLine without statement', async () => {
    await expect(
      callSetBreakpoint({ line: 6, nearLine: 5 })
    ).rejects.toThrow(/nearLine/);
  });

  it('requires either line or statement', async () => {
    await expect(callSetBreakpoint({})).rejects.toThrow(/[Mm]issing required/);
  });

  it('rejects statement for attach sessions', async () => {
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active',
      attachMode: true
    });

    await expect(
      callSetBreakpoint({ statement: 'return total' })
    ).rejects.toThrow(/line addressing/i);
  });

  it('is rejected in assert mode, naming the env value', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'assert');

    await expect(
      callSetBreakpoint({ statement: 'return total' })
    ).rejects.toThrow(/DEBUG_MCP_BP_ADDRESSING=assert/);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('composes with condition and logMessage', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({ name: 'python', supportsLogPoints: true });

    await callSetBreakpoint({
      statement: 'return total',
      condition: 'total > 10',
      logMessage: 'total={total}'
    });

    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({
        line: 6,
        condition: 'total > 10',
        logMessage: 'total={total}'
      })
    );
  });
});
