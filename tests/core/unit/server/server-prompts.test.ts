/**
 * Prompt handler tests: the debugging-workflow prompt serves the condensed
 * agent skill in-band (prompts/list + prompts/get).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError, type PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import { DEBUGGING_WORKFLOW_PROMPT } from '../../../../src/skill-content.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getPromptHandlers,
  type MockServer
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

/** The text of a prompt message part; a non-text part is a test failure, not a cast. */
function textOf(content: PromptMessage['content']): string {
  if (content.type !== 'text') {
    throw new Error(`expected a text part, got ${content.type}`);
  }
  return content.text;
}

describe('Server Prompts Tests', () => {
  let debugServer: DebugMcpServer;
  let mockServer: MockServer;

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
    expect(textOf(result.messages[0].content)).toBe(DEBUGGING_WORKFLOW_PROMPT);
    expect(textOf(result.messages[0].content)).toContain('close_debug_session');
  });

  it('rejects unknown prompt names', async () => {
    const { getPromptHandler } = getPromptHandlers(mockServer);
    await expect(
      getPromptHandler({ method: 'prompts/get', params: { name: 'nope' } })
    ).rejects.toThrow(McpError);
  });

  it('points attach guidance at the Kubernetes recipe (issue #452)', async () => {
    const { getPromptHandler } = getPromptHandlers(mockServer);
    const result = await getPromptHandler({
      method: 'prompts/get',
      params: { name: 'debugging-workflow' }
    });

    const text = textOf(result.messages[0].content);
    // The consolidated attach/k8s guidance (#424): debuggee-side paths,
    // python's pathMappings lever (#450), and the docs pointer.
    expect(text).toContain('docs/kubernetes.md');
    expect(text).toContain('pathMappings');
  });
});
