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
import type { Stats } from 'fs';
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

const PY_FILE = [
  'def a():',                 // 1
  '    total = sum(prices)',  // 2
  '',                         // 3
  'def b():',                 // 4
  '    total = sum(prices)',  // 5
  '    return total',         // 6
].join('\n');

describe('set_breakpoint statement anchors (#271)', () => {
  let mockServer: MockServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;
  let callToolHandler: CallToolHandler;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(mockDependencies.fileSystem.readFile).mockResolvedValue(PY_FILE);
    // Deliberately partial Stats: the anchor path reads only isFile/size/mtimeMs.
    vi.mocked(mockDependencies.fileSystem.stat).mockResolvedValue({
      isFile: () => true,
      size: PY_FILE.length,
      mtimeMs: 1000
    } as Stats);
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });
    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });

    createDebugServerWithFacade();
    callToolHandler = getToolHandlers(mockServer).callToolHandler;

    mockSessionManager.getSession.mockReturnValue({
      run: {},
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

  it('warns when nearLine picked among multiple matches (issue #379)', async () => {
    const result = await callSetBreakpoint({ statement: 'total = sum(prices)', nearLine: 4 });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.line).toBe(5);
    expect(String(content.warning)).toContain('matches 2 lines (2, 5)');
    expect(String(content.warning)).toContain('selected line 5');
  });

  it('emits no ambiguity warning when the statement is unique (issue #379)', async () => {
    const result = await callSetBreakpoint({ statement: 'return total', nearLine: 5 });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.warning).toBeUndefined();
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

  it('resolves a distinctive substring when no whole line matches (#367)', async () => {
    const result = await callSetBreakpoint({ statement: 'return' });

    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({
        line: 6,
        anchor: { statement: 'return' }
      })
    );
    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.line).toBe(6);
  });

  it('errors on ambiguous substring matches, listing each match (#367)', async () => {
    let thrown: Error | undefined;
    try {
      await callSetBreakpoint({ statement: 'sum(prices)' });
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown!.message).toContain('matches 2 lines');
    expect(thrown!.message).toContain('2: total = sum(prices)');
    expect(thrown!.message).toContain('5: total = sum(prices)');
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

  it('accepts an expectedContent that differs from the statement only by a trailing comment (issue #379)', async () => {
    // assertLineContent tolerates stale trailing comments, so the
    // contradictory-intent gate must not be stricter than the assertion.
    const result = await callSetBreakpoint({
      statement: 'return total',
      expectedContent: 'return total  # tally'
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

  it('refuses statement on an attach session (unknown locality) as a {success: false, error, state} tool answer naming file and line (issues #497, #1326)', async () => {
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      state: 'paused',
      sessionLifecycle: 'active',
      run: { attachMode: true }
    });

    const result = await callSetBreakpoint({ statement: 'return total' });
    const content = JSON.parse(result.content[0].text);

    expect(content).toEqual({
      success: false,
      error:
        "statement addressing is not supported for an attach session whose target host is not known " +
        "(the debuggee's loaded source may differ from the file on the mcp-debugger host); " +
        'use line addressing (file and line, without statement) instead.',
      state: 'paused'
    });
    expect(content.error).not.toMatch(/class name or remote path/);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  it('falls back to plain line addressing with an exact warning when line + expectedContent is passed on an attach with unknown locality (issues #497, #1326)', async () => {
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      state: 'paused',
      sessionLifecycle: 'active',
      run: { attachMode: true }
    });

    const result = await callSetBreakpoint({ line: 6, expectedContent: 'does not even match' });
    const content = JSON.parse(result.content[0].text);

    expect(content.success).toBe(true);
    expect(content.line).toBe(6);
    expect(content.verified).toBe(false);
    expect(content.warning).toBe(
      "expectedContent was not checked: the attach target's host is not known. " +
      'The breakpoint was requested at /path/to/test.py:6 by line addressing; ' +
      'verified, line, boundFile and message say whether and where it is bound.'
    );
    expect(content.note).toBe(
      "content and context omitted: the target host of this attach is not known, so the host file may not be the debuggee's source"
    );
    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ file: '/path/to/test.py', line: 6 })
    );
  });

  describe('attach locality (issues #903, #899, #1326)', () => {
    const REMOTE_EXPECTED_CONTENT_WARNING =
      "expectedContent was not checked: this is a remote attach, and the file on this host may differ from the target's source. " +
      'The breakpoint was requested at /path/to/test.py:6 by line addressing; ' +
      'verified, line, boundFile and message say whether and where it is bound.';

    function attachSession(attachLocality: 'pid' | 'loopback' | 'remote' | 'unknown', state = 'paused'): void {
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        state,
        sessionLifecycle: 'active',
        run: { attachMode: true, attachLocality }
      });
    }

    it.each(['pid', 'loopback'] as const)('allows statement addressing on a %s attach whose file is on this host', async (locality) => {
      attachSession(locality);
      vi.mocked(mockDependencies.fileSystem.pathExists).mockResolvedValue(true);

      const result = await callSetBreakpoint({ statement: 'return total' });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.line).toBe(6);
      expect(content.anchor).toEqual({ statement: 'return total' });
    });

    it('allows expectedContent on a local attach whose file is on this host, and still rejects mismatches', async () => {
      attachSession('pid');
      vi.mocked(mockDependencies.fileSystem.pathExists).mockResolvedValue(true);

      const result = await callSetBreakpoint({ line: 6, expectedContent: 'return total' });
      expect(JSON.parse(result.content[0].text).success).toBe(true);

      await expect(
        callSetBreakpoint({ line: 6, expectedContent: 'wrong text' })
      ).rejects.toThrow(/does not match expectedContent/);
    });

    it('refuses statement as {success: false, error, state} on a local attach when the file is not on this host', async () => {
      attachSession('loopback');
      vi.mocked(mockDependencies.fileSystem.pathExists).mockResolvedValue(false);

      const result = await callSetBreakpoint({ statement: 'return total' });
      const content = JSON.parse(result.content[0].text);

      expect(content).toEqual({
        success: false,
        error:
          'statement addressing is not supported for this attach session ("/path/to/test.py" is not usable on the mcp-debugger host, so its content cannot be checked); ' +
          'use line addressing (file and line, without statement) instead.',
        state: 'paused'
      });
      expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
    });

    it('falls back to line addressing with the local-attach warning when line + expectedContent is passed and the file is not on this host', async () => {
      attachSession('loopback');
      vi.mocked(mockDependencies.fileSystem.pathExists).mockResolvedValue(false);

      const result = await callSetBreakpoint({ line: 6, expectedContent: 'return total' });
      const content = JSON.parse(result.content[0].text);

      expect(content.success).toBe(true);
      expect(content.line).toBe(6);
      expect(content.verified).toBe(false);
      expect(content.content).toBeUndefined();
      expect(content.context).toBeUndefined();
      expect(content.warning).toBe(
        "expectedContent was not checked: this attach's path is not usable on this host. " +
        'The breakpoint was requested at /path/to/test.py:6 by line addressing; ' +
        'verified, line, boundFile and message say whether and where it is bound.'
      );
    });

    it('includes the file-checker detail when a local attach receives a relative path with expectedContent', async () => {
      attachSession('loopback');

      const result = await callSetBreakpoint({ file: 'relative/test.py', line: 6, expectedContent: 'return total' });
      const content = JSON.parse(result.content[0].text);

      expect(content.success).toBe(true);
      expect(content.line).toBe(6);
      expect(content.warning).toBe(
        'expectedContent was not checked: this attach\'s path is not usable on this host (Path must be absolute. Received: "relative/test.py"). ' +
        'The breakpoint was requested at relative/test.py:6 by line addressing; ' +
        'verified, line, boundFile and message say whether and where it is bound.'
      );
    });

    describe('unchecked-expectedContent fallback across all six breakpoint outcomes (#1326)', () => {
      it('1. queued (session not running yet: verified false, default message)', async () => {
        attachSession('remote', 'stopped');
        mockSessionManager.setBreakpoint.mockResolvedValueOnce({
          breakpoint: {
            id: 'bp-queued',
            file: '/path/to/test.py',
            line: 6,
            requestedLine: 6,
            verified: false
          }
        });

        const content = JSON.parse((await callSetBreakpoint({ line: 6, expectedContent: 'return total' })).content[0].text);

        expect(content.success).toBe(true);
        expect(content.verified).toBe(false);
        expect(content.line).toBe(6);
        expect(content.requestedLine).toBe(6);
        expect(content.message).toBe('Breakpoint set at /path/to/test.py:6');
        expect(content.warning).toBe(REMOTE_EXPECTED_CONTENT_WARNING);
      });

      it('2. refused (adapter declined live sync, stamping messageOrigin refusal + sync warning)', async () => {
        attachSession('remote');
        mockSessionManager.setBreakpoint.mockResolvedValueOnce({
          breakpoint: {
            id: 'bp-refused',
            file: '/path/to/test.py',
            line: 6,
            requestedLine: 6,
            verified: false,
            message: 'No executable code at line 6',
            messageOrigin: 'refusal'
          },
          warning: 'Adapter rejected breakpoints for test.py: No executable code at line 6'
        });

        const content = JSON.parse((await callSetBreakpoint({ line: 6, expectedContent: 'return total' })).content[0].text);

        expect(content.success).toBe(true);
        expect(content.verified).toBe(false);
        expect(content.message).toBe('No executable code at line 6');
        expect(content.warning).toBe(
          `Adapter rejected breakpoints for test.py: No executable code at line 6; ${REMOTE_EXPECTED_CONTENT_WARNING}`
        );
      });

      it('3. unverified with adapter message (waiting for module load)', async () => {
        attachSession('remote');
        mockSessionManager.setBreakpoint.mockResolvedValueOnce({
          breakpoint: {
            id: 'bp-unverified',
            file: '/path/to/test.py',
            line: 6,
            requestedLine: 6,
            verified: false,
            message: 'Breakpoint in file that does not exist.'
          }
        });

        const content = JSON.parse((await callSetBreakpoint({ line: 6, expectedContent: 'return total' })).content[0].text);

        expect(content.success).toBe(true);
        expect(content.verified).toBe(false);
        expect(content.message).toBe('Breakpoint in file that does not exist.');
        expect(content.warning).toBe(
          `Breakpoint in file that does not exist.; ${REMOTE_EXPECTED_CONTENT_WARNING}`
        );
      });

      it('4. moved in the same file (requestedLine 6, bound line 8)', async () => {
        attachSession('remote');
        mockSessionManager.setBreakpoint.mockResolvedValueOnce({
          breakpoint: {
            id: 'bp-snap-1',
            file: '/path/to/test.py',
            line: 8,
            requestedLine: 6,
            verified: true
          }
        });

        const content = JSON.parse((await callSetBreakpoint({ line: 6, expectedContent: 'return total' })).content[0].text);

        expect(content.success).toBe(true);
        expect(content.verified).toBe(true);
        expect(content.line).toBe(8);
        expect(content.requestedLine).toBe(6);
        expect(content.message).toBe('Breakpoint moved by the debugger: requested line 6, bound to line 8');
        expect(content.warning).toBe(
          `${REMOTE_EXPECTED_CONTENT_WARNING}; Breakpoint moved by the debugger: requested line 6, bound to line 8`
        );
      });

      it('5. bound in another file (boundFile + boundLine preserved, requested file:line named in warning)', async () => {
        attachSession('remote');
        mockSessionManager.setBreakpoint.mockResolvedValueOnce({
          breakpoint: {
            id: 'bp-cross-file',
            file: '/path/to/test.py',
            line: 6,
            requestedLine: 6,
            boundFile: '/remote/build/test.py',
            boundLine: 20,
            verified: true
          }
        });

        const content = JSON.parse((await callSetBreakpoint({ line: 6, expectedContent: 'return total' })).content[0].text);

        expect(content.success).toBe(true);
        expect(content.verified).toBe(true);
        expect(content.file).toBe('/path/to/test.py');
        expect(content.line).toBe(6);
        expect(content.requestedLine).toBe(6);
        expect(content.boundFile).toBe('/remote/build/test.py');
        expect(content.boundLine).toBe(20);
        expect(content.warning).toBe(REMOTE_EXPECTED_CONTENT_WARNING);
      });

      it('6. verified at the requested location', async () => {
        attachSession('remote');
        mockSessionManager.setBreakpoint.mockResolvedValueOnce({
          breakpoint: {
            id: 'bp-remote-1',
            file: '/path/to/test.py',
            line: 6,
            requestedLine: 6,
            verified: true
          }
        });

        const content = JSON.parse((await callSetBreakpoint({ line: 6, expectedContent: 'return total' })).content[0].text);

        expect(content).toEqual({
          success: true,
          breakpointId: 'bp-remote-1',
          file: '/path/to/test.py',
          line: 6,
          requestedLine: 6,
          verified: true,
          message: 'Breakpoint set at /path/to/test.py:6',
          warning: REMOTE_EXPECTED_CONTENT_WARNING,
          note:
            "content and context omitted: the target of this attach is not on the mcp-debugger host, so the host file is not the debuggee's source"
        });
        expect(mockDependencies.fileSystem.pathExists).not.toHaveBeenCalled();
        expect(mockDependencies.fileSystem.readFile).not.toHaveBeenCalled();
      });

      it('preserves a transport sync warning beside the unchecked-expectedContent warning', async () => {
        attachSession('remote');
        mockSessionManager.setBreakpoint.mockResolvedValueOnce({
          breakpoint: {
            id: 'bp-sync-warn',
            file: '/path/to/test.py',
            line: 6,
            requestedLine: 6,
            verified: false
          },
          warning: 'Failed to send breakpoints to debug adapter: request timed out'
        });

        const content = JSON.parse((await callSetBreakpoint({ line: 6, expectedContent: 'return total' })).content[0].text);

        expect(content.success).toBe(true);
        expect(content.verified).toBe(false);
        expect(content.warning).toBe(
          `Failed to send breakpoints to debug adapter: request timed out; ${REMOTE_EXPECTED_CONTENT_WARNING}`
        );
      });
    });

    it('refuses statement on a remote attach as a {success: false, error, state} tool answer naming file and line (#1326)', async () => {
      attachSession('remote');

      const result = await callSetBreakpoint({ statement: 'return total' });
      const content = JSON.parse(result.content[0].text);

      expect(content).toEqual({
        success: false,
        error:
          "statement addressing is not supported for a remote attach session " +
          "(the debuggee's loaded source may differ from the file on the mcp-debugger host); " +
          'use line addressing (file and line, without statement) instead.',
        state: 'paused'
      });
      expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
      expect(mockDependencies.fileSystem.pathExists).not.toHaveBeenCalled();
    });

    it('tells the caller to omit both statement and nearLine when statement + nearLine is refused (#1326)', async () => {
      attachSession('remote');

      const result = await callSetBreakpoint({ statement: 'total = sum(prices)', nearLine: 4 });
      const content = JSON.parse(result.content[0].text);

      expect(content).toEqual({
        success: false,
        error:
          "statement addressing is not supported for a remote attach session " +
          "(the debuggee's loaded source may differ from the file on the mcp-debugger host); " +
          'use line addressing (file and line, without statement or nearLine) instead.',
        state: 'paused'
      });
      expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
    });

    it('still rejects statement combined with line as InvalidParams on a remote attach (#1326)', async () => {
      attachSession('remote');

      await expect(
        callSetBreakpoint({ line: 6, statement: 'return total' })
      ).rejects.toThrow(/Provide line or statement, not both/);
      expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
    });

    it('omits content and context on a remote attach, and says so', async () => {
      attachSession('remote');

      const result = await callSetBreakpoint({ line: 2 });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.content).toBeUndefined();
      expect(content.context).toBeUndefined();
      expect(content.note).toMatch(/content and context omitted/);
      expect(mockDependencies.fileSystem.readFile).not.toHaveBeenCalled();
    });

    it('still reads the host file for content on a local attach', async () => {
      attachSession('pid');
      vi.mocked(mockDependencies.fileSystem.pathExists).mockResolvedValue(true);

      const result = await callSetBreakpoint({ line: 2 });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.note).toBeUndefined();
      expect(content.content).toBe('    total = sum(prices)');
    });

    describe("a child of a remote attach debugs that attach's target (issues #1214, #1326)", () => {
      // The attach is the run's: adoption gives the child the record its root wrote.
      beforeEach(() => {
        const run = { attachMode: true, attachLocality: 'remote' };
        const sessions: Record<string, Record<string, unknown>> = {
          'root-session': { id: 'root-session', state: 'running', sessionLifecycle: 'active', run },
          'test-session': { id: 'test-session', state: 'paused', sessionLifecycle: 'active', parentSessionId: 'root-session', run }
        };
        mockSessionManager.getSession.mockImplementation((sessionId: string) => sessions[sessionId]);
      });

      it('requests the breakpoint at line and warns with the remote-attach reason when line + expectedContent is passed', async () => {
        const result = await callSetBreakpoint({ line: 6, expectedContent: 'return total' });
        const content = JSON.parse(result.content[0].text);

        expect(content.success).toBe(true);
        expect(content.line).toBe(6);
        expect(content.warning).toBe(REMOTE_EXPECTED_CONTENT_WARNING);
        expect(mockDependencies.fileSystem.pathExists).not.toHaveBeenCalled();
      });

      it('refuses statement as {success: false, error, state} naming the remote target and file + line', async () => {
        const result = await callSetBreakpoint({ statement: 'return total' });
        const content = JSON.parse(result.content[0].text);

        expect(content).toEqual({
          success: false,
          error:
            "statement addressing is not supported for a remote attach session " +
            "(the debuggee's loaded source may differ from the file on the mcp-debugger host); " +
            'use line addressing (file and line, without statement) instead.',
          state: 'paused'
        });
        expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
        expect(mockDependencies.fileSystem.pathExists).not.toHaveBeenCalled();
      });

      it('skips the host file check and omits content and context, and says so', async () => {
        const result = await callSetBreakpoint({ line: 2 });

        const content = JSON.parse(result.content[0].text);
        expect(content.success).toBe(true);
        expect(content.content).toBeUndefined();
        expect(content.context).toBeUndefined();
        expect(content.note).toMatch(/content and context omitted/);
        expect(mockDependencies.fileSystem.pathExists).not.toHaveBeenCalled();
        expect(mockDependencies.fileSystem.readFile).not.toHaveBeenCalled();
      });
    });
  });

  it('keeps the class-name wording for non-file source identifiers on statement refusal, with and without nearLine (#1326)', async () => {
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      state: 'created',
      sessionLifecycle: 'active',
      run: {}
    });
    mockSessionManager.getSessionPolicy.mockReturnValue({
      isNonFileSourceIdentifier: () => true
    });

    const withoutNear = await callToolHandler({
      method: 'tools/call',
      params: {
        name: 'set_breakpoint',
        arguments: {
          sessionId: 'test-session',
          file: 'com.example.MyClass',
          statement: 'return total'
        }
      }
    });
    expect(JSON.parse(withoutNear.content[0].text)).toEqual({
      success: false,
      error:
        'statement addressing requires a source file readable by the mcp-debugger server; ' +
        '"com.example.MyClass" is a class name or remote path — use line addressing (file and line, without statement) instead.',
      state: 'created'
    });

    const withNear = await callToolHandler({
      method: 'tools/call',
      params: {
        name: 'set_breakpoint',
        arguments: {
          sessionId: 'test-session',
          file: 'com.example.MyClass',
          statement: 'return total',
          nearLine: 40
        }
      }
    });
    expect(JSON.parse(withNear.content[0].text)).toEqual({
      success: false,
      error:
        'statement addressing requires a source file readable by the mcp-debugger server; ' +
        '"com.example.MyClass" is a class name or remote path — use line addressing (file and line, without statement or nearLine) instead.',
      state: 'created'
    });
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
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
