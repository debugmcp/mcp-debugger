/**
 * Shared test helpers and mock setup for server tests
 */
import { vi } from 'vitest';
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
    processLauncher: vi.fn(),
    proxyProcessLauncher: vi.fn(),
    debugTargetLauncher: vi.fn(),
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
        // Simple mock implementation
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
    onerror: undefined as any
  };
}

export function createMockSessionManager(mockAdapterRegistry: any) {
  return {
    createSession: vi.fn(),
    getAllSessions: vi.fn(),
    getSession: vi.fn(),
    closeSession: vi.fn(),
    closeAllSessions: vi.fn(),
    setBreakpoint: vi.fn(),
    startDebugging: vi.fn(),
    stepOver: vi.fn(),
    stepInto: vi.fn(),
    stepOut: vi.fn(),
    continue: vi.fn(),
    getVariables: vi.fn(),
    getStackTrace: vi.fn(),
    getScopes: vi.fn(),
    evaluateExpression: vi.fn(),
    getAdapterRegistry: vi.fn().mockReturnValue(mockAdapterRegistry),
    adapterRegistry: mockAdapterRegistry
  };
}

export function createMockStdioTransport() {
  return {};
}

export function getToolHandlers(mockServer: any) {
  const handlers = mockServer.setRequestHandler.mock.calls;
  return {
    listToolsHandler: handlers[0]?.[1], // First handler is for ListToolsRequestSchema
    callToolHandler: handlers[1]?.[1]   // Second handler is for CallToolRequestSchema
  };
}
