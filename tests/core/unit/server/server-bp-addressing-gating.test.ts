/**
 * DEBUG_MCP_BP_ADDRESSING gating tests (issue #271).
 *
 * The flag restricts breakpoint addressing features for A/B experiments; the
 * restriction must hold in BOTH the tools/list schema and the call handler
 * (schema omission alone doesn't stop a client that replays cached schemas),
 * and in the server instructions text served in the initialize handshake.
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
  findTool,
  getToolHandlers,
  type ListToolsHandler,
  type MockServer,
  type MockSessionManager,
  createDebugServerWithFacade
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/server', async () =>
  (await import('../../../test-utils/mocks/sdk-server-module.js')).sdkServerModuleMock());
vi.mock('@modelcontextprotocol/server/stdio');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('DEBUG_MCP_BP_ADDRESSING gating (#271)', () => {
  let mockServer: MockServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;

  beforeEach(() => {
    mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });
    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function buildServer() {
    createDebugServerWithFacade();
    return getToolHandlers(mockServer);
  }

  async function getSetBreakpointSchema(listToolsHandler: ListToolsHandler) {
    const { properties = {}, required = [] } = (await findTool(listToolsHandler, 'set_breakpoint')).inputSchema;
    return { properties, required };
  }

  it('omits expectedContent from the schema in line mode', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'line');
    const { listToolsHandler } = buildServer();

    const schema = await getSetBreakpointSchema(listToolsHandler);

    expect(schema.properties.expectedContent).toBeUndefined();
    expect(schema.properties.statement).toBeUndefined();
    expect(schema.properties.nearLine).toBeUndefined();
    expect(schema.required).toEqual(['sessionId', 'file', 'line']);
  });

  it('exposes expectedContent but not statement in assert mode', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'assert');
    const { listToolsHandler } = buildServer();

    const schema = await getSetBreakpointSchema(listToolsHandler);

    expect(schema.properties.expectedContent).toBeDefined();
    expect(schema.properties.statement).toBeUndefined();
    expect(schema.properties.nearLine).toBeUndefined();
    expect(schema.required).toContain('line');
  });

  it('exposes statement/nearLine in content mode and drops line from required', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'content');
    const { listToolsHandler } = buildServer();

    const schema = await getSetBreakpointSchema(listToolsHandler);

    expect(schema.properties.expectedContent).toBeDefined();
    expect(schema.properties.statement).toBeDefined();
    expect(schema.properties.nearLine).toBeDefined();
    expect(schema.properties.function).toBeDefined();
    // function breakpoints need no file, so only sessionId is universally required
    expect(schema.required).toEqual(['sessionId']);
  });

  it('exposes expectedContent by default (env unset -> content mode)', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', undefined as unknown as string);
    const { listToolsHandler } = buildServer();

    const schema = await getSetBreakpointSchema(listToolsHandler);

    expect(schema.properties.expectedContent).toBeDefined();
  });

  it('hard-errors an expectedContent argument in line mode, naming the env value', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'line');
    const { callToolHandler } = buildServer();
    mockSessionManager.getSession.mockReturnValue({
      id: 'test-session',
      sessionLifecycle: 'active'
    });
    mockSessionManager.getSessionPolicy.mockReturnValue({});

    await expect(
      callToolHandler({
        method: 'tools/call',
        params: {
          name: 'set_breakpoint',
          arguments: {
            sessionId: 'test-session',
            file: '/path/to/test.py',
            line: 3,
            expectedContent: 'anything'
          }
        }
      })
    ).rejects.toThrow(/DEBUG_MCP_BP_ADDRESSING=line/);
    expect(mockSessionManager.setBreakpoint).not.toHaveBeenCalled();
  });

  // The sentences issue #1331 and #1326 placed in the descriptions keep the
  // same gates: the attach path forms name function breakpoints only in content
  // mode, the loud-snap sentence appears only where snapping is reported, and
  // set_breakpoint's content-addressing scope sentence names only the features
  // the mode serves.
  it('gates the descriptions moved from the instructions by mode', async () => {
    const toolInMode = async (mode: string, tool: string) => {
      vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', mode);
      const { listToolsHandler } = buildServer();
      return findTool(listToolsHandler, tool);
    };
    const descriptionOf = async (mode: string, tool: string): Promise<string> =>
      (await toolInMode(mode, tool)).description ?? '';

    for (const mode of ['line', 'assert']) {
      expect(await descriptionOf(mode, 'attach_to_process'), mode).not.toContain('function breakpoint');
    }
    expect(await descriptionOf('content', 'attach_to_process')).toContain('function breakpoints, or a mapping');

    const lineBpDesc = await descriptionOf('line', 'set_breakpoint');
    expect(lineBpDesc).not.toContain('requested line N, bound to line M');
    for (const token of ['expectedContent', 'statement', 'local-attach', 'remote or unknown-host attach']) {
      expect(lineBpDesc).not.toContain(token);
    }

    const assertBp = await toolInMode('assert', 'set_breakpoint');
    expect(assertBp.description).toContain('requested line N, bound to line M');
    expect(assertBp.description).toContain(
      "expectedContent is checked against readable launch and local-attach files. On a remote or unknown-host attach, an attach path this host cannot resolve, or a class name, pass file and the target's own line: expectedContent is then skipped with a warning."
    );
    expect(assertBp.description).not.toContain('statement');
    const assertProps = assertBp.inputSchema.properties as Record<string, { description?: string }>;
    expect(assertProps.expectedContent.description).toBe(
      'Optional assertion: text you expect on the target line — a distinctive substring is enough (leading/trailing whitespace and trailing //- or #-comments are ignored). If it does not match, the breakpoint is NOT set and the error shows the actual content of that line and its neighbors — use this to catch stale or off-by-one line numbers before they cause confusing behavior'
    );

    const contentBp = await toolInMode('content', 'set_breakpoint');
    expect(contentBp.description).toContain('requested line N, bound to line M');
    expect(contentBp.description).toContain(
      "statement and expectedContent are checked against readable launch and local-attach files. On a remote or unknown-host attach, an attach path this host cannot resolve, or a class name, pass file and the target's own line: expectedContent is then skipped with a warning, and statement is refused."
    );
    const contentProps = contentBp.inputSchema.properties as Record<string, { description?: string }>;
    expect(contentProps.expectedContent.description).toBe(assertProps.expectedContent.description);
    expect(contentProps.statement.description).toBe(
      'Address by content instead of line number: the text of the target line, like an Edit-tool match — a distinctive substring is enough (leading/trailing whitespace and trailing //- or #-comments are ignored; an exact whole-line match always wins over substring matches). Preferred over line — it can only land on a line containing your text (an inexact or multi-candidate match adds a warning to the response) and survives file edits across restart_debugging. If the text appears on multiple lines, the error lists every match; add nearLine to pick one. Provide statement OR line, not both'
    );
  });

  // The server instructions name each content-addressing feature only in a
  // mode that serves it (issue #1331 moved the details to the schema, so each
  // mode's text names just the form its launch path uses).
  it('names content addressing in server instructions only in the modes that serve it', () => {
    const instructionsFor = (mode: string): string | undefined => {
      vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', mode);
      createDebugServerWithFacade();
      return (vi.mocked(Server).mock.calls.at(-1)![1] as { instructions?: string }).instructions;
    };

    const lineInstructions = instructionsFor('line');
    expect(lineInstructions).toBeDefined();
    for (const token of ['expectedContent', 'statement', 'nearLine', 'function breakpoint']) {
      expect(lineInstructions).not.toContain(token);
    }

    const assertInstructions = instructionsFor('assert');
    expect(assertInstructions).toContain('expectedContent');
    for (const token of ['statement', 'nearLine', 'function breakpoint']) {
      expect(assertInstructions).not.toContain(token);
    }

    const contentInstructions = instructionsFor('content');
    expect(contentInstructions).toContain('statement: "<text of the line>"');
    expect(contentInstructions).toContain('function breakpoint');
  });
});
