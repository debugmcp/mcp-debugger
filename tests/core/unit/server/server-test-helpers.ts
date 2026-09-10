/**
 * Shared test helpers and mock setup for server tests
 */
import { vi } from 'vitest';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { DebugMcpServer } from '../../../../src/server.js';
import { createProductionDependencies } from '../../../../src/container/dependencies.js';
import {
  createMockLogger,
  createMockNetworkManager,
  createMockProcessManager,
  createMockProxyProcessLauncher
} from '../../../test-utils/helpers/test-dependencies.js';
import { MockProxyManagerFactory } from '../../../../src/factories/proxy-manager-factory.js';
import { MockSessionStoreFactory } from '../../../../src/factories/session-store-factory.js';
import { createMockAdapterRegistry } from '../../../test-utils/mocks/mock-adapter-registry.js';

export function createMockDependencies(): ReturnType<typeof createProductionDependencies> {
  const mockLogger = createMockLogger();
  const mockAdapterRegistry = createMockAdapterRegistry();
  
  return {
    logger: mockLogger,
    fileSystem: {
      existsSync: vi.fn().mockReturnValue(true),
      ensureDirSync: vi.fn(),
      ensureDir: vi.fn().mockResolvedValue(undefined),
      pathExists: vi.fn().mockResolvedValue(true),
      readFile: vi.fn().mockResolvedValue('{}'),
      readTail: vi.fn().mockResolvedValue(''),
      writeFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(true),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockResolvedValue({ isFile: () => true }),
      unlink: vi.fn().mockResolvedValue(undefined),
      rmdir: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      copy: vi.fn().mockResolvedValue(undefined),
      outputFile: vi.fn().mockResolvedValue(undefined)
    },
    // Real shapes, not bare `vi.fn()`. Nothing in the server tests calls these, but a
    // double that satisfies none of its interfaces means the whole bag has to be cast at
    // every call site -- which then silences the members that ARE exercised too.
    processManager: createMockProcessManager(),
    networkManager: createMockNetworkManager(),
    proxyProcessLauncher: createMockProxyProcessLauncher(),
    proxyManagerFactory: new MockProxyManagerFactory(),
    sessionStoreFactory: new MockSessionStoreFactory(),
    environment: {
      get: vi.fn((key: string) => process.env[key]),
      getAll: vi.fn(() => ({ ...process.env })),
      getCurrentWorkingDirectory: vi.fn(() => process.cwd())
    },
    adapterRegistry: mockAdapterRegistry
  };
}

export function createMockServer() {
  return {
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
    sendResourceUpdated: vi.fn().mockResolvedValue(undefined),
    sendResourceListChanged: vi.fn().mockResolvedValue(undefined),
    onerror: undefined as any
  };
}

export function createMockSessionManager(mockAdapterRegistry: any) {
  const manager: any = {
    createSession: vi.fn(),
    getAllSessions: vi.fn(),
    getSession: vi.fn(),
    closeSession: vi.fn(),
    closeAllSessions: vi.fn(),
    setBreakpoint: vi.fn(),
    setFunctionBreakpoint: vi.fn(),
    // The session layer owns function-breakpoint names (issue #559). The
    // defaults are the no-policy answers: the name resolves to itself, and
    // nothing matches it.
    resolveFunctionBreakpointName: vi.fn((_sessionId: string, requestedName: string) => ({
      requestedName,
      effectiveName: requestedName
    })),
    removeFunctionBreakpointsByName: vi.fn(async (_sessionId: string, requestedName: string) => ({
      removed: [],
      functionName: requestedName,
      requestedName
    })),
    listFunctionBreakpoints: vi.fn().mockReturnValue([]),
    listBreakpoints: vi.fn().mockReturnValue([]),
    removeBreakpoint: vi.fn().mockResolvedValue({ removed: undefined }),
    removeBreakpointsByLocation: vi.fn().mockResolvedValue({ removed: [] }),
    clearBreakpoints: vi.fn().mockResolvedValue({ cleared: 0, files: [] }),
    startDebugging: vi.fn(),
    restartDebugging: vi.fn().mockResolvedValue({ success: false, state: 'created', error: 'not stubbed' }),
    stepOver: vi.fn(),
    stepInto: vi.fn(),
    stepOut: vi.fn(),
    continue: vi.fn(),
    getVariables: vi.fn(),
    // Delegates to getVariables so existing tests that stub/assert on
    // getVariables keep working now that the tool handler calls the
    // detailed variant (issues #356/#359).
    getVariablesDetailed: vi.fn(async (...args: unknown[]) => ({
      variables: (await manager.getVariables(...(args as [string, number, string[]?]))) ?? []
    })),
    getLocalVariables: vi.fn(),
    getStackTrace: vi.fn(),
    getStackTraceDetailed: vi.fn().mockResolvedValue({
      frames: [],
      totalFrameCount: 0,
      hiddenFrameCount: 0,
      allFramesInternal: false
    }),
    getScopes: vi.fn(),
    evaluateExpression: vi.fn(),
    getSessionPolicy: vi.fn().mockReturnValue({}),
    pause: vi.fn(),
    listThreads: vi.fn(),
    detachFromProcess: vi.fn(),
    attachToProcess: vi.fn(),
    redefineClasses: vi.fn(),
    exposeSession: vi.fn(),
    unexposeSession: vi.fn(),
    getAdapterRegistry: vi.fn().mockReturnValue(mockAdapterRegistry),
    adapterRegistry: mockAdapterRegistry,
    // EventEmitter surface used by DebugMcpServer for output-captured (issue #218)
    on: vi.fn(),
    removeListener: vi.fn()
  };
  return manager;
}

export function createMockStdioTransport() {
  return {};
}

/**
 * A live ToolContext for the handler tests in ./handlers.
 *
 * It is a real DebugMcpServer — which is what implements ToolContext — with
 * its session manager and logger swapped for mocks, rather than a hand-rolled
 * object literal: the handlers read their dependencies off the context at call
 * time, and a literal would be free to drift away from the interface they
 * program against. Tests replace further members (fileChecker, lineReader,
 * validateSession) by assigning to the returned context, which is exactly what
 * the live-read contract is there for.
 *
 * The caller MUST vi.mock the dependency container: DebugMcpServer builds its
 * real dependencies in the constructor, and an unmocked one opens winston's
 * shared file transport (and a session log dir) per construction, none of
 * which is ever stopped.
 */
export function createMockToolContext(): DebugMcpServer {
  if (!vi.isMockFunction(createProductionDependencies)) {
    throw new Error(
      'createMockToolContext requires the test file to vi.mock ../src/container/dependencies.js — ' +
      'otherwise every call opens a real winston file transport that is never closed.'
    );
  }
  vi.mocked(createProductionDependencies).mockReturnValue(
    createMockDependencies() as unknown as ReturnType<typeof createProductionDependencies>
  );
  const server = new DebugMcpServer({ logLevel: 'info' });
  Object.assign(server, {
    sessionManager: createMockSessionManager(createMockAdapterRegistry()),
    logger: createMockLogger()
  });
  return server;
}

/**
 * Find the handler registered for a request schema. Lookup is by schema
 * identity rather than registration position, so the registration order in
 * src/server.ts (tools, resources, prompts) is not a hidden test contract;
 * @modelcontextprotocol/sdk/types.js is never mocked, so the identity is safe.
 */
function findHandler(mockServer: any, schema: unknown) {
  const call = mockServer.setRequestHandler.mock.calls.find(
    ([registered]: [unknown, unknown]) => registered === schema
  );
  return call?.[1];
}

export function getToolHandlers(mockServer: any) {
  return {
    listToolsHandler: findHandler(mockServer, ListToolsRequestSchema),
    callToolHandler: findHandler(mockServer, CallToolRequestSchema)
  };
}

// Debuggee-output resource handlers (issue #218).
export function getResourceHandlers(mockServer: any) {
  return {
    listResourcesHandler: findHandler(mockServer, ListResourcesRequestSchema),
    readResourceHandler: findHandler(mockServer, ReadResourceRequestSchema),
    subscribeHandler: findHandler(mockServer, SubscribeRequestSchema),
    unsubscribeHandler: findHandler(mockServer, UnsubscribeRequestSchema)
  };
}

export function getPromptHandlers(mockServer: any) {
  return {
    listPromptsHandler: findHandler(mockServer, ListPromptsRequestSchema),
    getPromptHandler: findHandler(mockServer, GetPromptRequestSchema)
  };
}
