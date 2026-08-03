/**
 * Prompt handler tests: the debugging-workflow prompt serves the condensed
 * agent skill in-band (prompts/list + prompts/get).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import { DEBUGGING_WORKFLOW_PROMPT } from '../../../../src/skill-content.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getPromptHandlers
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('Server Prompts Tests', () => {
  let debugServer: DebugMcpServer;
  let mockServer: any;

  beforeEach(() => {
    const mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function() { return mockServer as any; });

    const mockStdioTransport = createMockStdioTransport();
    vi.mocked(StdioServerTransport).mockImplementation(function() { return mockStdioTransport as any; });

    const mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    vi.mocked(SessionManager).mockImplementation(function() { return mockSessionManager as any; });

    debugServer = new DebugMcpServer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists the debugging-workflow prompt', async () => {
    const { listPromptsHandler } = getPromptHandlers(mockServer);
    const result = await listPromptsHandler({ method: 'prompts/list', params: {} });

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0].name).toBe('debugging-workflow');
    expect(result.prompts[0].description).toContain('debug');
  });

  it('serves the workflow content for prompts/get', async () => {
    const { getPromptHandler } = getPromptHandlers(mockServer);
    const result = await getPromptHandler({
      method: 'prompts/get',
      params: { name: 'debugging-workflow' }
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content.text).toBe(DEBUGGING_WORKFLOW_PROMPT);
    expect(result.messages[0].content.text).toContain('close_debug_session');
  });

  it('rejects unknown prompt names', async () => {
    const { getPromptHandler } = getPromptHandlers(mockServer);
    await expect(
      getPromptHandler({ method: 'prompts/get', params: { name: 'nope' } })
    ).rejects.toThrow(McpError);
  });
});
