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
import { createMockLogger } from '../../../test-utils/helpers/test-dependencies.js';
import { createMockAdapterRegistry } from '../../../test-utils/mocks/mock-adapter-registry.js';

export function createMockDependencies() {
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
    processManager: vi.fn(),
    networkManager: vi.fn(),
    proxyProcessLauncher: vi.fn(),
    proxyManagerFactory: vi.fn(),
    sessionStoreFactory: vi.fn(),
    environment: {
      get: vi.fn((key: string) => process.env[key]),
      getAll: vi.fn(() => ({ ...process.env })),
      getCurrentWorkingDirectory: vi.fn(() => process.cwd())
    },
    pathUtils: {
      isAbsolute: vi.fn((p: string) => {
        // Mock platform-appropriate behavior
        if (process.platform === 'win32') {
          return /^[A-Za-z]:[\\\/]/.test(p) || /^\\\\/.test(p);
        } else {
          return p.startsWith('/');
        }
      }),
      resolve: vi.fn((...args: string[]) => {
        // Simple mock: joins segments with '/' and collapses duplicate slashes.
        // Does NOT implement real resolve() semantics (absolute-path override,
        // '.'/'..' normalization, Windows separators) -- simple cases only.
        return args.join('/').replace(/\/+/g, '/');
      }),
      join: vi.fn((...args: string[]) => args.join('/')),
      dirname: vi.fn((p: string) => {
        const lastSlash = p.lastIndexOf('/');
        return lastSlash === -1 ? '.' : p.substring(0, lastSlash);
      }),
      basename: vi.fn((p: string, ext?: string) => {
        const lastSlash = p.lastIndexOf('/');
        const base = lastSlash === -1 ? p : p.substring(lastSlash + 1);
        if (ext && base.endsWith(ext)) {
          return base.substring(0, base.length - ext.length);
        }
        return base;
      }),
      sep: '/'
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
