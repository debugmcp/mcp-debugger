/**
 * Server-layer redaction notice tests (issue #237).
 *
 * Masking itself happens in the session layer (see
 * session-manager-redaction.test.ts); the server's job is to surface a
 * top-level `redaction` notice object whenever a returned item carries the
 * `redacted` flag, to say in the initialize instructions that the snapshot's
 * locals are redacted, and to describe the placeholders in the descriptions
 * of the tools that return program values (issue #1331).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { Server } from '@modelcontextprotocol/server';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies, type Dependencies } from '../../../../src/container/dependencies.js';
import { buildServerInstructions } from '../../../../src/skill-content.js';
import { buildToolDefinitions } from '../../../../src/server/tool-schemas.js';
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
import { OutputRingBuffer } from '../../../../src/session/output-buffer.js';

vi.mock('@modelcontextprotocol/server', async () =>
  (await import('../../../test-utils/mocks/sdk-server-module.js')).sdkServerModuleMock());
vi.mock('@modelcontextprotocol/server/stdio');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('Server redaction notices (issue #237)', () => {
  let mockServer: MockServer;
  let mockSessionManager: MockSessionManager;
  let mockDependencies: Dependencies;
  let callToolHandler: CallToolHandler;

  beforeEach(() => {
    vi.useFakeTimers();

    mockDependencies = createMockDependencies();
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
      id: 'test-session',
      sessionLifecycle: 'ACTIVE'
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('get_variables', () => {
    it('adds a redaction notice when any returned variable was masked', async () => {
      mockSessionManager.getVariables.mockResolvedValue([
        { name: 'gh_token', value: '<redacted:github-pat>', type: 'str', expandable: false, redacted: true },
        { name: 'count', value: '42', type: 'int', expandable: false }
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_variables', arguments: { sessionId: 'test-session', scope: 100 } }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.redaction).toBeDefined();
      expect(content.redaction.masked).toBe(1);
      expect(content.redaction.notice).toContain('DEBUG_MCP_NO_REDACT=1');
    });

    it('omits the redaction object when nothing was masked', async () => {
      mockSessionManager.getVariables.mockResolvedValue([
        { name: 'count', value: '42', type: 'int', expandable: false }
      ]);

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_variables', arguments: { sessionId: 'test-session', scope: 100 } }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.redaction).toBeUndefined();
    });
  });

  describe('get_local_variables', () => {
    it('adds a redaction notice when any returned variable was masked', async () => {
      mockSessionManager.getLocalVariables.mockResolvedValue({
        variables: [
          { name: 'password', value: '<redacted:sensitive-name>', type: 'str', expandable: false, redacted: true },
          { name: 'x', value: '1', type: 'int', expandable: false }
        ],
        frame: { id: 1, name: 'main', file: 'test.py', line: 10 },
        scopeName: 'Locals'
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_local_variables', arguments: { sessionId: 'test-session' } }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.redaction).toBeDefined();
      expect(content.redaction.masked).toBe(1);
      expect(content.redaction.notice).toContain('DEBUG_MCP_NO_REDACT=1');
    });
  });

  describe('get_output', () => {
    it('adds a redaction notice when any returned entry was masked', async () => {
      const buffer = new OutputRingBuffer();
      buffer.push('stdout', 'token: <redacted:github-pat>\n', undefined, { redacted: true });
      buffer.push('stdout', 'ready\n');
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE',
        outputBuffer: buffer
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_output', arguments: { sessionId: 'test-session' } }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.entries).toHaveLength(2);
      expect(content.entries[0].redacted).toBe(true);
      expect(content.redaction.masked).toBe(1);
      expect(content.redaction.notice).toContain('DEBUG_MCP_NO_REDACT=1');
    });

    it('omits the redaction object for clean output', async () => {
      const buffer = new OutputRingBuffer();
      buffer.push('stdout', 'hello\n');
      mockSessionManager.getSession.mockReturnValue({
        id: 'test-session',
        sessionLifecycle: 'ACTIVE',
        outputBuffer: buffer
      });

      const result = await callToolHandler({
        method: 'tools/call',
        params: { name: 'get_output', arguments: { sessionId: 'test-session' } }
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.redaction).toBeUndefined();
    });
  });

  describe('server instructions', () => {
    it('say the snapshot locals are redacted when redaction is on (the default)', () => {
      const instructions = buildServerInstructions();
      expect(instructions).toContain("the top frame's locals (redacted and capped)");
    });

    it('say nothing of redaction when the server opted out', () => {
      const instructions = buildServerInstructions(undefined, { redactionEnabled: false });
      expect(instructions).not.toMatch(/redact/i);
    });
  });

  // The placeholder format and the opt-out moved from the instructions to the
  // descriptions of the tools that return program values (issue #1331),
  // worded to stay true when the server runs with DEBUG_MCP_NO_REDACT=1.
  describe('tool descriptions', () => {
    it('describe the placeholder, the redaction field and the opt-out on every tool that returns program values', () => {
      const tools = buildToolDefinitions({ supportedLanguages: ['python'], environment: mockDependencies.environment });
      for (const name of ['get_variables', 'get_local_variables', 'evaluate_expression', 'get_output']) {
        const description = tools.find((tool) => tool.name === name)?.description ?? '';
        expect(description, name).toContain('<redacted:rule-id>');
        expect(description, name).toContain('redaction field');
        expect(description, name).toContain('Unless the server runs with DEBUG_MCP_NO_REDACT=1');
      }
    });
  });
});
