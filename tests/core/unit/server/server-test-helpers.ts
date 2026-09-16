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
  GetPromptRequestSchema,
  type EmptyResult,
  type GetPromptResult,
  type ListPromptsResult,
  type ListResourcesResult,
  type ReadResourceResult,
  type Tool
} from '@modelcontextprotocol/sdk/types.js';
import type { IAdapterRegistry } from '@debugmcp/shared';
import { DebugMcpServer } from '../../../../src/server.js';
import type { SessionManager } from '../../../../src/session/session-manager.js';
import type { ToolResult } from '../../../../src/server/tool-result.js';
import {
  createProductionDependencies,
  type Dependencies
} from '../../../../src/container/dependencies.js';
import {
  createMockLogger,
  createMockNetworkManager,
  createMockProcessManager,
  createMockProxyProcessLauncher
} from '../../../test-utils/helpers/test-dependencies.js';
import { MockProxyManagerFactory } from '../../../../src/factories/proxy-manager-factory.js';
import { MockSessionStoreFactory } from '../../../../src/factories/session-store-factory.js';
import { createMockAdapterRegistry } from '../../../test-utils/mocks/mock-adapter-registry.js';

export function createMockDependencies(): Dependencies {
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
    onerror: undefined as ((error: Error) => void) | undefined
  };
}

export type MockServer = ReturnType<typeof createMockServer>;
export type MockSessionManager = ReturnType<typeof createMockSessionManager>;

/**
 * The request shape the server tests hand to a registered handler. Every
 * field is optional: the handlers only read `params`, and many tests omit
 * the JSON-RPC envelope entirely.
 */
export type TestRequest = { method?: string; params?: Record<string, unknown>; jsonrpc?: string };
export type CallToolHandler = (request: TestRequest) => Promise<ToolResult>;
export type ListToolsHandler = (request?: TestRequest) => Promise<{ tools: Tool[] }>;

/**
 * A SessionManager double whose keys are pinned to the real class: a member
 * the class no longer has fails to compile here (excess-property check on
 * the `satisfies` literal), which is the drift guard. Every member stays a
 * bare `vi.fn()` so tests can keep returning partial session objects.
 */
export function createMockSessionManager(mockAdapterRegistry: IAdapterRegistry) {
  // Hoisted: getVariablesDetailed delegates to it, and a self-reference inside
  // the literal would be a TS7022 circularity once the literal is inferred.
  const getVariables = vi.fn();
  const manager = {
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
    getVariables,
    // Delegates to getVariables so existing tests that stub/assert on
    // getVariables keep working now that the tool handler calls the
    // detailed variant (issues #356/#359).
    getVariablesDetailed: vi.fn(async (...args: unknown[]) => ({
      variables: (await getVariables(...(args as [string, number, string[]?]))) ?? []
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
    adapterRegistry: mockAdapterRegistry,
    // EventEmitter surface used by DebugMcpServer for output-captured (issue #218)
    on: vi.fn(),
    removeListener: vi.fn()
  } satisfies Partial<Record<keyof SessionManager, unknown>>;
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
  vi.mocked(createProductionDependencies).mockReturnValue(createMockDependencies());
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
function findHandler(mockServer: MockServer, schema: unknown): unknown {
  const call = mockServer.setRequestHandler.mock.calls.find(
    ([registered]: unknown[]) => registered === schema
  );
  return call?.[1];
}

// The `as <Handler>` casts below are the one sanctioned cast per lookup:
// `mock.calls` of an untyped `vi.fn` is `any[]`, so the registered handler
// comes back as `unknown` and only the schema identity says which it is.
export function getToolHandlers(mockServer: MockServer) {
  return {
    listToolsHandler: findHandler(mockServer, ListToolsRequestSchema) as ListToolsHandler,
    callToolHandler: findHandler(mockServer, CallToolRequestSchema) as CallToolHandler
  };
}

// Debuggee-output resource handlers (issue #218).
export function getResourceHandlers(mockServer: MockServer) {
  return {
    listResourcesHandler: findHandler(mockServer, ListResourcesRequestSchema) as
      (request?: TestRequest) => Promise<ListResourcesResult>,
    readResourceHandler: findHandler(mockServer, ReadResourceRequestSchema) as
      (request: TestRequest) => Promise<ReadResourceResult>,
    subscribeHandler: findHandler(mockServer, SubscribeRequestSchema) as
      (request: TestRequest) => Promise<EmptyResult>,
    unsubscribeHandler: findHandler(mockServer, UnsubscribeRequestSchema) as
      (request: TestRequest) => Promise<EmptyResult>
  };
}

export function getPromptHandlers(mockServer: MockServer) {
  return {
    listPromptsHandler: findHandler(mockServer, ListPromptsRequestSchema) as
      (request?: TestRequest) => Promise<ListPromptsResult>,
    getPromptHandler: findHandler(mockServer, GetPromptRequestSchema) as
      (request: TestRequest) => Promise<GetPromptResult>
  };
}
