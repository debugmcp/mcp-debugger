# Dependency Injection Pattern in MCP Debug Server

This document explains how the MCP Debug Server implements dependency injection to achieve testability, flexibility, and maintainability.

## Overview

The dependency injection (DI) pattern is used throughout the codebase to:
- Enable comprehensive unit testing without real external dependencies
- Allow swapping implementations (e.g., for different platforms)
- Make dependencies explicit and documented
- Facilitate modular architecture

## Core Principles

### 1. Constructor Injection
All dependencies are injected through constructors, making them explicit and immutable.

### 2. Interface Segregation
Dependencies are defined as focused interfaces, not concrete implementations.

### 3. Dependency Inversion
High-level modules depend on abstractions, not concrete implementations.

## Implementation Examples

### SessionManager Dependency Injection

**Location**: `src/session/session-manager.ts` (lines 48-56, 124-136)

```typescript
// Define dependencies interface
export interface SessionManagerDependencies {
  fileSystem: IFileSystem;
  networkManager: INetworkManager;
  logger: ILogger;
  proxyManagerFactory: IProxyManagerFactory;
  sessionStoreFactory: ISessionStoreFactory;
  debugTargetLauncher: IDebugTargetLauncher;
}

// Constructor injection
constructor(
  config: SessionManagerConfig,
  dependencies: SessionManagerDependencies
) {
  this.logger = dependencies.logger;
  this.fileSystem = dependencies.fileSystem;
  this.networkManager = dependencies.networkManager;
  this.proxyManagerFactory = dependencies.proxyManagerFactory;
  this.sessionStoreFactory = dependencies.sessionStoreFactory;
  this.debugTargetLauncher = dependencies.debugTargetLauncher;
  
  // Use injected dependencies
  this.sessionStore = this.sessionStoreFactory.create();
  this.fileSystem.ensureDirSync(this.logDirBase);
}
```

### ProxyManager Dependency Injection

**Location**: `src/proxy/proxy-manager.ts` (lines 137-145)

```typescript
export class ProxyManager extends EventEmitter implements IProxyManager {
  constructor(
    private proxyProcessLauncher: IProxyProcessLauncher,
    private fileSystem: IFileSystem,
    private logger: ILogger
  ) {
    super();
  }
}
```

Benefits:
- All dependencies are visible in the constructor signature
- Easy to create test instances with mock dependencies
- No hidden dependencies or global state

### Factory Pattern for Complex Dependencies

**Location**: `src/factories/proxy-manager-factory.ts`

```typescript
export interface IProxyManagerFactory {
  create(): IProxyManager;
}

export class ProxyManagerFactory implements IProxyManagerFactory {
  constructor(
    private proxyProcessLauncher: IProxyProcessLauncher,
    private fileSystem: IFileSystem,
    private logger: ILogger
  ) {}

  create(): IProxyManager {
    return new ProxyManager(
      this.proxyProcessLauncher,
      this.fileSystem,
      this.logger
    );
  }
}
```

This factory pattern allows SessionManager to create ProxyManager instances without knowing their dependencies.

## Interface Definitions

### Core External Dependencies

**Location**: `src/interfaces/external-dependencies.ts`

```typescript
// File system operations
export interface IFileSystem {
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  writeFile(path: string, data: string | Buffer): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  ensureDir(path: string): Promise<void>;
  ensureDirSync(path: string): void;
  pathExists(path: string): Promise<boolean>;
  // ... more methods
}

// Process management
export interface IProcessManager {
  spawn(command: string, args?: string[], options?: SpawnOptions): IChildProcess;
  exec(command: string): Promise<{ stdout: string; stderr: string }>;
}

// Network operations
export interface INetworkManager {
  createServer(): IServer;
  findFreePort(): Promise<number>;
}

// Logging
export interface ILogger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
}
```

### Process-Specific Interfaces

**Location**: `src/interfaces/process-interfaces.ts`

```typescript
export interface IProxyProcess extends EventEmitter {
  pid?: number;
  killed: boolean;
  kill(signal?: string): boolean;
  sendCommand(command: any): void;
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
}

export interface IProxyProcessLauncher {
  launchProxy(
    scriptPath: string,
    sessionId: string,
    env?: NodeJS.ProcessEnv
  ): IProxyProcess;
}
```

## Real-World Usage

### Production Container Configuration

**Location**: `src/container/dependencies.ts`

```typescript
import { FileSystemImpl } from '../implementations/file-system-impl.js';
import { ProcessManagerImpl } from '../implementations/process-manager-impl.js';
import { NetworkManagerImpl } from '../implementations/network-manager-impl.js';
import { createLogger } from '../utils/logger.js';

export function createProductionDependencies(): IDependencies {
  return {
    fileSystem: new FileSystemImpl(),
    processManager: new ProcessManagerImpl(),
    networkManager: new NetworkManagerImpl(),
    logger: createLogger('mcp-debug-server')
  };
}
```

### Test Container Configuration

**Location**: `tests/utils/test-utils.ts`

```typescript
export function createTestDependencies(): Partial<IDependencies> {
  return {
    fileSystem: createMockFileSystem(),
    processManager: createMockProcessManager(),
    networkManager: createMockNetworkManager(),
    logger: createMockLogger()
  };
}

export function createMockFileSystem(): IFileSystem {
  return {
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    ensureDirSync: vi.fn(),
    pathExists: vi.fn().mockResolvedValue(true),
    // ... implement all methods
  };
}
```

## Testing Benefits

### Example: Testing SessionManager

**Location**: `tests/unit/session/session-manager.test.ts`

```typescript
describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockDependencies: SessionManagerDependencies;

  beforeEach(() => {
    // Create all mock dependencies
    mockDependencies = {
      fileSystem: createMockFileSystem(),
      networkManager: createMockNetworkManager(),
      logger: createMockLogger(),
      proxyManagerFactory: createMockProxyManagerFactory(),
      sessionStoreFactory: createMockSessionStoreFactory(),
      debugTargetLauncher: createMockDebugTargetLauncher()
    };

    // Create SessionManager with mocks
    sessionManager = new SessionManager(
      { logDirBase: '/tmp/test' },
      mockDependencies
    );
  });

  it('should create session directory on initialization', () => {
    expect(mockDependencies.fileSystem.ensureDirSync)
      .toHaveBeenCalledWith('/tmp/test');
  });

  it('should use network manager to find free port', async () => {
    vi.mocked(mockDependencies.networkManager.findFreePort)
      .mockResolvedValue(5678);
    
    // Test will use mocked port
    // ... rest of test
  });
});
```

### Example: Testing with Fake Implementations

**Location**: `tests/unit/proxy/proxy-manager-lifecycle.test.ts`

```typescript
describe('ProxyManager', () => {
  let proxyManager: ProxyManager;
  let fakeLauncher: FakeProxyProcessLauncher;

  beforeEach(() => {
    // Use fake implementation instead of mock
    fakeLauncher = new FakeProxyProcessLauncher();
    
    proxyManager = new ProxyManager(
      fakeLauncher,  // Fake implementation
      createMockFileSystem(),  // Mock
      createMockLogger()  // Mock
    );
  });

  it('should handle proxy messages', async () => {
    // Prepare fake to simulate behavior
    fakeLauncher.prepareProxy((proxy) => {
      setTimeout(() => {
        proxy.simulateMessage({
          type: 'status',
          status: 'initialized'
        });
      }, 100);
    });

    // Test uses fake behavior
    await proxyManager.start(config);
    // ... assertions
  });
});
```

## Advanced Patterns

### Partial Dependencies

For gradual migration or optional features:

```typescript
export type PartialDependencies = Partial<IDependencies>;

export function createComponentWithDefaults(
  deps: PartialDependencies
): Component {
  const fullDeps = {
    ...createDefaultDependencies(),
    ...deps
  };
  return new Component(fullDeps as IDependencies);
}
```

### Dependency Validation

Ensure required dependencies are provided:

```typescript
constructor(dependencies: SessionManagerDependencies) {
  // Validate required dependencies
  if (!dependencies.logger) {
    throw new Error('Logger is required');
  }
  if (!dependencies.fileSystem) {
    throw new Error('FileSystem is required');
  }
  
  // Assign after validation
  this.logger = dependencies.logger;
  this.fileSystem = dependencies.fileSystem;
}
```

### Lazy Dependency Creation

For expensive dependencies:

```typescript
export class LazyProxyManagerFactory implements IProxyManagerFactory {
  private instance?: IProxyManager;
  
  create(): IProxyManager {
    if (!this.instance) {
      this.instance = new ProxyManager(
        this.launcher,
        this.fileSystem,
        this.logger
      );
    }
    return this.instance;
  }
}
```

## Best Practices

1. **Define Interfaces First** - Start with the interface, not the implementation
2. **Keep Interfaces Focused** - Follow Interface Segregation Principle
3. **Use Constructor Injection** - Make dependencies explicit
4. **Avoid Service Locators** - Don't hide dependencies
5. **Create Factories for Complex Objects** - When objects need runtime parameters
6. **Test with Mocks/Fakes** - Never use real external dependencies in unit tests
7. **Document Dependencies** - Make it clear what each dependency provides

## Anti-Patterns to Avoid

### ❌ Hidden Dependencies
```typescript
// Bad - hidden dependency on global
class BadComponent {
  doSomething() {
    const logger = getGlobalLogger(); // Hidden dependency!
    logger.info('doing something');
  }
}
```

### ❌ Property Injection
```typescript
// Bad - dependencies can be changed after construction
class BadComponent {
  logger?: ILogger;  // Can be undefined!
  
  doSomething() {
    this.logger?.info('maybe works?');
  }
}
```

### ❌ Concrete Dependencies
```typescript
// Bad - depends on concrete implementation
import { WinstonLogger } from 'winston';

class BadComponent {
  constructor(private logger: WinstonLogger) {} // Tied to Winston!
}
```

## Summary

The dependency injection pattern in MCP Debug Server:
- Enables 90%+ test coverage by making everything testable
- Provides flexibility to swap implementations
- Makes the codebase more maintainable
- Documents component relationships explicitly

By following these patterns, the codebase remains modular, testable, and easy to understand.
