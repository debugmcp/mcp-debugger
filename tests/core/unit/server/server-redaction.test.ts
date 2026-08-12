/**
 * Server-layer redaction notice tests (issue #237).
 *
 * Masking itself happens in the session layer (see
 * session-manager-redaction.test.ts); the server's job is to surface a
 * top-level `redaction` notice object whenever a returned item carries the
 * `redacted` flag, and to mention redaction in the initialize instructions.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { SessionManager } from '../../../../src/session/session-manager.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import { buildServerInstructions } from '../../../../src/skill-content.js';
import {
  createMockDependencies,
  createMockServer,
  createMockSessionManager,
  createMockStdioTransport,
  getToolHandlers
} from './server-test-helpers.js';
import { OutputRingBuffer } from '../../../../src/session/output-buffer.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

describe('Server redaction notices (issue #237)', () => {
  let mockServer: any;
  let mockSessionManager: any;
  let mockDependencies: any;
  let callToolHandler: any;

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

    new DebugMcpServer();
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
    it('mentions redaction when enabled (the default)', () => {
      const instructions = buildServerInstructions();
      expect(instructions).toContain('<redacted:');
      expect(instructions).toContain('DEBUG_MCP_NO_REDACT');
    });

    it('drops the redaction rule when the server opted out', () => {
      const instructions = buildServerInstructions(undefined, { redactionEnabled: false });
      expect(instructions).not.toContain('<redacted:');
    });
  });
});
