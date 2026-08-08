/**
 * DEBUG_MCP_BP_ADDRESSING gating tests (issue #271).
 *
 * The flag restricts breakpoint addressing features for A/B experiments; the
 * restriction must hold in BOTH the tools/list schema and the call handler
 * (schema omission alone doesn't stop a client that replays cached schemas),
 * and in the server instructions text served in the initialize handshake.
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

describe('DEBUG_MCP_BP_ADDRESSING gating (#271)', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;

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
    new DebugMcpServer();
    return getToolHandlers(mockServer);
  }

  async function getSetBreakpointSchema(listToolsHandler: any) {
    const { tools } = await listToolsHandler({ method: 'tools/list', params: {} });
    const tool = tools.find((t: { name: string }) => t.name === 'set_breakpoint');
    expect(tool).toBeDefined();
    return tool.inputSchema as {
      properties: Record<string, unknown>;
      required: string[];
    };
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

  it('exposes expectedContent in assert mode', async () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'assert');
    const { listToolsHandler } = buildServer();

    const schema = await getSetBreakpointSchema(listToolsHandler);

    expect(schema.properties.expectedContent).toBeDefined();
    expect(schema.required).toContain('line');
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

  it('mentions expectedContent in server instructions only outside line mode', () => {
    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'line');
    new DebugMcpServer();
    const lineInstructions = (vi.mocked(Server).mock.calls.at(-1)![1] as {
      instructions?: string;
    }).instructions;
    expect(lineInstructions).toBeDefined();
    expect(lineInstructions).not.toContain('expectedContent');

    vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', 'content');
    new DebugMcpServer();
    const contentInstructions = (vi.mocked(Server).mock.calls.at(-1)![1] as {
      instructions?: string;
    }).instructions;
    expect(contentInstructions).toContain('expectedContent');
  });
});
