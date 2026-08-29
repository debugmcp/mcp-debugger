/**
 * Tool-schema snapshot fence for the src/server.ts extraction.
 *
 * Pins the exact tools/list, resources/list and prompts/list payloads for
 * every DEBUG_MCP_BP_ADDRESSING x DEBUG_MCP_VARIABLE_ACCESS combination the
 * server accepts (see src/utils/bp-addressing.ts and
 * src/utils/variable-access.ts). The snapshots were recorded from the
 * pre-split server.ts and must stay byte-identical through every commit that
 * moves code into src/server/ — a diff here means a description, key order,
 * or gating rule drifted.
 *
 * Environment is stubbed with vi.stubEnv the way the gating tests do: the
 * mock environment from createMockDependencies reads process.env live.
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
  getToolHandlers,
  getResourceHandlers,
  getPromptHandlers
} from './server-test-helpers.js';

vi.mock('@modelcontextprotocol/sdk/server/index.js');
vi.mock('@modelcontextprotocol/sdk/server/stdio.js');
vi.mock('../../../../src/session/session-manager.js');
vi.mock('../../../../src/container/dependencies.js');

/** Every value getBpAddressingMode() accepts, plus unset (falls back to 'content'). */
const BP_ADDRESSING_MODES: ReadonlyArray<string | undefined> = [undefined, 'line', 'assert', 'content'];

/** Every value getVariableAccessMode() accepts, plus unset (falls back to 'open'). */
const VARIABLE_ACCESS_MODES: ReadonlyArray<string | undefined> = [undefined, 'open', 'explicit'];

/** Fixed session fixture so the resource descriptors are deterministic. */
const SESSION_FIXTURE = [
  { id: 'sess-1', name: 'alpha', language: 'python' },
  { id: 'sess-2', name: 'beta', language: 'mock' }
];

function label(value: string | undefined): string {
  return value ?? 'unset';
}

describe('Server tool/resource/prompt list snapshot fence', () => {
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    const mockDependencies = createMockDependencies();
    vi.mocked(createProductionDependencies).mockReturnValue(mockDependencies as never);

    mockServer = createMockServer();
    vi.mocked(Server).mockImplementation(function () { return mockServer as never; });
    vi.mocked(StdioServerTransport).mockImplementation(function () { return createMockStdioTransport() as never; });

    const mockSessionManager = createMockSessionManager(mockDependencies.adapterRegistry);
    mockSessionManager.getAllSessions.mockReturnValue(SESSION_FIXTURE);
    vi.mocked(SessionManager).mockImplementation(function () { return mockSessionManager as never; });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  for (const bpMode of BP_ADDRESSING_MODES) {
    for (const vaMode of VARIABLE_ACCESS_MODES) {
      it(`DEBUG_MCP_BP_ADDRESSING=${label(bpMode)} DEBUG_MCP_VARIABLE_ACCESS=${label(vaMode)}`, async () => {
        vi.stubEnv('DEBUG_MCP_BP_ADDRESSING', bpMode);
        vi.stubEnv('DEBUG_MCP_VARIABLE_ACCESS', vaMode);
        vi.stubEnv('MCP_CONTAINER', undefined);

        new DebugMcpServer();
        const { listToolsHandler } = getToolHandlers(mockServer);
        const { listResourcesHandler } = getResourceHandlers(mockServer);
        const { listPromptsHandler } = getPromptHandlers(mockServer);

        const tools = await listToolsHandler({ method: 'tools/list', params: {} });
        const resources = await listResourcesHandler({ method: 'resources/list', params: {} });
        const prompts = await listPromptsHandler({ method: 'prompts/list', params: {} });

        const snapshot = JSON.stringify({ tools, resources, prompts }, null, 2) + '\n';
        await expect(snapshot).toMatchFileSnapshot(
          `./__snapshots__/tool-list/bp-${label(bpMode)}.va-${label(vaMode)}.json`
        );
      });
    }
  }
});
