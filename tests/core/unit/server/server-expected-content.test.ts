/**
 * set_breakpoint expectedContent assertion tests (issue #271, phase 1).
 *
 * expectedContent is a set-time checksum on intent: the server hard-errors
 * BEFORE storing anything when the target line's trimmed content does not
 * match, and the error carries the actual nearby lines so the agent can
 * correct in one step.
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
  'def total_cart():',
  '    prices = load()  # fetch cart',
  '    total = sum(prices)',
  '    return total',
  '',
  'def main():'
].join('\n');

describe('set_breakpoint expectedContent (#271)', () => {
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

  it('sets the breakpoint when expectedContent is a distinctive substring (#367)', async () => {
    const result = await callSetBreakpoint({
      line: 3,
      expectedContent: 'sum(prices)'
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ line: 3 })
    );
  });

  it('warns when expectedContent matched only as a substring (issue #379)', async () => {
    const result = await callSetBreakpoint({
      line: 3,
      expectedContent: 'sum(prices)'
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(String(content.warning)).toMatch(/substring/i);
    expect(String(content.warning)).toContain('total = sum(prices)');
  });

  it('warns when expectedContent matched only after comment stripping (issue #379)', async () => {
    const result = await callSetBreakpoint({
      line: 3,
      expectedContent: 'total = sum(prices)  # recount'
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(String(content.warning)).toMatch(/comment/i);
  });

  it('emits no match warning for an exact expectedContent (issue #379)', async () => {
    const result = await callSetBreakpoint({
      line: 3,
      expectedContent: 'total = sum(prices)'
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.warning).toBeUndefined();
  });

  it('emits no warning when the line differs only by a trailing comment (issue #440)', async () => {
    // Full code of the line, minus the trailing '#' comment: an exact
    // whole-code match must not trigger the low-confidence advisory.
    const result = await callSetBreakpoint({
      line: 2,
      expectedContent: 'prices = load()'
    });

    const content = JSON.parse(result.content[0].text);
    expect(content.success).toBe(true);
    expect(content.warning).toBeUndefined();
  });

  it('rejects an empty expectedContent explicitly (#367)', async () => {
    await expect(
      callSetBreakpoint({ line: 3, expectedContent: '   ' })
    ).rejects.toThrow(/empty or whitespace-only/);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
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

  describe('the statement hint on a mismatch can be followed (issue #1142)', () => {
    async function refusalOf(args: Record<string, unknown>): Promise<string> {
      try {
        await callSetBreakpoint(args);
      } catch (error) {
        return (error as Error).message;
      }
      throw new Error('set_breakpoint did not refuse');
    }

    it('an off-by-one line names where the text is, and that statement then binds there', async () => {
      const refusal = await refusalOf({ line: 4, expectedContent: 'total = sum(prices)' });

      expect(refusal).toMatch(/Or address by content: set_breakpoint \{statement: "total = sum\(prices\)"\} — that text is on line 3\.$/);

      // Following the hint: the same text, as a statement.
      const followed = JSON.parse((await callSetBreakpoint({ statement: 'total = sum(prices)' })).content[0].text);
      expect(followed.success).toBe(true);
      expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith('test-session', expect.objectContaining({ line: 3 }));
    });

    it('text that is nowhere in the file earns no statement hint, where following one used to fail', async () => {
      const refusal = await refusalOf({ line: 3, expectedContent: 'THIS TEXT IS WRONG' });

      expect(refusal).toContain('Pick the correct line from the context above.');
      expect(refusal).not.toContain('statement: "THIS TEXT IS WRONG"');
      expect(refusal).toMatch(/ That expectedContent matches no line of the file\.$/);

      // What the old hint led to.
      await expect(callSetBreakpoint({ statement: 'THIS TEXT IS WRONG' })).rejects.toThrow(/not found/);
      expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
    });
  });

  it('requests the breakpoint at line with a warning when expectedContent cannot be checked on a remote attach (#1326)', async () => {
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      state: 'paused',
      sessionLifecycle: 'active',
      run: { attachMode: true, attachLocality: 'remote' }
    });

    const result = await callSetBreakpoint({ line: 3, expectedContent: 'total = sum(prices)' });
    const content = JSON.parse(result.content[0].text);

    expect(content.success).toBe(true);
    expect(content.line).toBe(3);
    expect(content.verified).toBe(false);
    expect(content.warning).toBe(
      "expectedContent was not checked: this is a remote attach, and the file on this host may differ from the target's source. " +
      'The breakpoint was requested at /path/to/test.py:3 by line addressing; ' +
      'verified, line, boundFile and message say whether and where it is bound.'
    );
    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ file: '/path/to/test.py', line: 3 })
    );
  });

  it('requests the breakpoint at line with the source-identifier warning for non-file source identifiers (Java FQCN, #1326)', async () => {
    mockSessionManager.getSessionPolicy.mockReturnValue({
      isNonFileSourceIdentifier: (f: string) => !f.includes('/')
    });
    mockSessionManager.setBreakpoint.mockResolvedValueOnce({
      breakpoint: {
        id: 'bp-fqcn-1',
        file: 'com.example.MyClass',
        line: 3,
        requestedLine: 3,
        verified: false
      }
    });

    const result = await callToolHandler({
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
    });
    const content = JSON.parse(result.content[0].text);

    expect(content.success).toBe(true);
    expect(content.file).toBe('com.example.MyClass');
    expect(content.line).toBe(3);
    expect(content.verified).toBe(false);
    expect(content.content).toBeUndefined();
    expect(content.context).toBeUndefined();
    expect(content.warning).toBe(
      'expectedContent was not checked: "com.example.MyClass" is a source identifier, not a file this server can read. ' +
      'The breakpoint was requested at com.example.MyClass:3 by line addressing; ' +
      'verified, line, boundFile and message say whether and where it is bound.'
    );
    expect(mockSessionManager.setBreakpoint).toHaveBeenCalledWith(
      'test-session',
      expect.objectContaining({ file: 'com.example.MyClass', line: 3 })
    );
  });

  it('rejects clearly when the file cannot be read for verification', async () => {
    vi.mocked(mockDependencies.fileSystem.readFile).mockRejectedValue(new Error('EACCES'));
    vi.mocked(mockDependencies.fileSystem.stat).mockRejectedValue(new Error('EACCES'));

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
