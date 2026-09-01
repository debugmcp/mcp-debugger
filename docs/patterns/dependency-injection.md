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
Core service dependencies are injected through constructors, making them explicit and immutable.

### 2. Interface Segregation
Dependencies are defined as focused interfaces, not concrete implementations.

### 3. Dependency Inversion
High-level modules depend on abstractions, not concrete implementations.

## Implementation Examples

### SessionManager Dependency Injection

**Location**: `src/session/session-manager-core.ts`

> **Note**: `SessionManager` (in `session-manager.ts`) extends `SessionManagerOperations`, which extends `SessionManagerData`, which extends `SessionManagerCore`. The dependency injection and core logic live in `SessionManagerCore`. `SessionManager` implements `handleAutoContinue(sessionId)` which calls `this.continue(sessionId)` to auto-continue past entry breakpoints.

```typescript
// Define dependencies interface
export interface SessionManagerDependencies {
  fileSystem: IFileSystem;
  networkManager: INetworkManager;
  logger: ILogger;
  proxyManagerFactory: IProxyManagerFactory;
  sessionStoreFactory: ISessionStoreFactory;
  environment: IEnvironment;
  adapterRegistry: IAdapterRegistry;
}

// Constructor injection (in SessionManagerCore)
constructor(
  config: SessionManagerConfig,
  dependencies: SessionManagerDependencies
) {
  this.logger = dependencies.logger;
  this.fileSystem = dependencies.fileSystem;
  this.networkManager = dependencies.networkManager;
  this.environment = dependencies.environment;
  this.proxyManagerFactory = dependencies.proxyManagerFactory;
  this.sessionStoreFactory = dependencies.sessionStoreFactory;
  this.adapterRegistry = dependencies.adapterRegistry;

  // Use injected dependencies
  this.sessionStore = this.sessionStoreFactory.create();
  this.fileSystem.ensureDirSync(this.logDirBase);
}
```

### OperationsContext: the session-collaborator seam

**Location**: `src/session/operations-context.ts`

Constructor injection stops at the SessionManager boundary. Inside it, the debug
operations live in per-slice collaborators — `ProxyLauncher`, `DebugLauncher`,
`AttachController`, `BreakpointController`, `PauseCoordinator`,
`ExecutionController`, `ExpressionEvaluator`, `RedefineClassesController`,
`MirrorController` — and `OperationsContext` is what they are injected with. It
is the primary DI seam in the codebase today.

Two properties separate it from the constructor injection above:

1. **Every member is late bound.** Methods are arrows that call
   `this.<method>(...)` when invoked; data members are getters that re-read the
   facade field. That is load-bearing rather than stylistic: tests reassign
   `selectPolicy`, `stopProxyPreservingSession` and `closeSession` on a *live*
   SessionManager, and write the timing tunables (`attachVerifyTimeoutMs`,
   `stepGraceMs`, `pauseGraceMs`, …) as plain fields. A context built from
   references captured at construction time would silently ignore all of it.
2. **Each collaborator declares the narrowest slice it uses.** The constructor
   parameter types are `Pick<>` aliases over `OperationsContext`, so what a
   collaborator touches is readable from its signature and widening it is a
   visible edit.

```typescript
// src/session/operations-context.ts (excerpt)
export interface OperationsTunables {
  readonly attachVerifyTimeoutMs: number;
  readonly attachVerifyIntervalMs: number;
  readonly attachPauseStopTimeoutMs: number;
  readonly stepGraceMs: number;
  readonly pauseGraceMs: number;
}

export interface OperationsContext {
  readonly logger: ILogger;
  readonly fileSystem: IFileSystem;
  readonly adapterRegistry: IAdapterRegistry;
  readonly proxyManagerFactory: IProxyManagerFactory;
  readonly tunables: OperationsTunables;

  getSession(sessionId: string): ManagedSession;
  updateSession(sessionId: string, updates: Partial<ManagedSession>): void;
  updateState(session: ManagedSession, newState: SessionState): void;
  selectPolicy(language: string | DebugLanguage): AdapterPolicy;
  // ... the rest of what collaborators are allowed to reach for
}

// A collaborator names only the slice it needs — this is MirrorController's:
export type MirrorContext = Pick<OperationsContext, 'logger' | 'getSession' | 'updateSession'>;
```

Anything not listed on `OperationsContext` stays private to the facade: the
interface is the allow-list. Collaborator-to-collaborator dependencies are *not*
routed through it — they are ordinary constructor arguments
(`DebugLauncher(ctx, proxyLauncher, breakpoints)`,
`AttachController(ctx, proxyLauncher, breakpoints, pauseCoordinator)`) held as
captured instance references. Their methods resolve at call time, so an instance
spy intercepts, but reassigning a collaborator field after construction is not
observed.

`docs/architecture/component-design.md` carries the full collaborator table.

### ProxyManager Dependency Injection

**Location**: `src/proxy/proxy-manager.ts`

```typescript
export class ProxyManager extends EventEmitter implements IProxyManager {
  constructor(
    private adapter: IDebugAdapter | null,  // Optional adapter for language-agnostic support
    private proxyProcessLauncher: IProxyProcessLauncher,
    private fileSystem: IFileSystem,
    private logger: ILogger,
    runtimeEnv: ProxyRuntimeEnvironment = DEFAULT_RUNTIME_ENVIRONMENT
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
  create(adapter?: IDebugAdapter): IProxyManager;
}

export class ProxyManagerFactory implements IProxyManagerFactory {
  constructor(
    private proxyProcessLauncher: IProxyProcessLauncher,
    private fileSystem: IFileSystem,
    private logger: ILogger
  ) {}

  create(adapter?: IDebugAdapter): IProxyManager {
    return new ProxyManager(
      adapter || null,  // Pass adapter or null if not provided
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

**Location**: `packages/shared/src/interfaces/external-dependencies.ts` (defines `IFileSystem`, `IProcessManager`, `INetworkManager`, `ILogger`, `IEnvironment`) and `packages/shared/src/interfaces/process-interfaces.ts` (defines `IProxyProcessLauncher` and related IProcess/IProxyProcess types)

> **Heads-up: there are two `IFileSystem` declarations.**
> `src/interfaces/external-dependencies.ts` is an app-local near-duplicate of the
> shared module — same `IFileSystem`, `IChildProcess`, `IProcessManager`,
> `INetworkManager`, `IServer`, `ILogger`, `IProxyManagerFactory`, `IEnvironment`,
> `IDependencies`, `PartialDependencies`, `ILoggerFactory`, `IChildProcessFactory`.
> The only substantive difference is `IProxyManager`: the shared copy declares a
> minimal placeholder (`dispose()` only), because `@debugmcp/shared` cannot import
> from `src/`, while the app-local copy imports the real `IProxyManager` from
> `src/proxy/proxy-manager.ts` — so its `IProxyManagerFactory` is typed against the
> full interface. TypeScript is structural, so the two `IFileSystem`s are
> interchangeable and nothing breaks, which is exactly why the duplication is easy
> to miss. Most of `src/` imports the shared module; `src/adapters/adapter-lease.ts`
> and `src/session/launch/proxy-failure-diagnostics.ts` import the app-local one, as
> do several test helpers. Prefer `@debugmcp/shared` in new code.

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

// Process management (used by SessionManager-level dependencies)
export interface IProcessManager {
  spawn(command: string, args?: string[], options?: SpawnOptions): IChildProcess;
  exec(command: string): Promise<{ stdout: string; stderr: string }>;
}

// Process launching (note this is a different interface from IProcessManager)
// IProxyProcessLauncher is in process-interfaces.ts and is consumed by
// ProxyManagerFactory/ProxyManager — adapters receive AdapterDependencies
// (fileSystem, logger, environment, networkManager?) instead
// (see "Process-Specific Interfaces" below for its full definition).
// IProcessManager is in external-dependencies.ts and is the lower-level system abstraction.

// Network operations
export interface INetworkManager {
  createServer(): IServer;
  findFreePort(): Promise<number>;
}

// Logging
export interface ILogger {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
}
```

### Process-Specific Interfaces

**Location**: `packages/shared/src/interfaces/process-interfaces.ts`

```typescript
export interface IProxyProcess extends IProcess {
  sessionId: string;
  sendCommand(command: object): void;
  waitForInitialization(timeout?: number): Promise<void>;
}

export interface IProxyProcessLauncher {
  launchProxy(
    scriptPath: string,
    sessionId: string,
    env?: Record<string, string>
  ): IProxyProcess;
}
```

## Real-World Usage

### Production Container Configuration

**Location**: `src/container/dependencies.ts`

```typescript
import { FileSystemImpl, ProcessManagerImpl, NetworkManagerImpl, ... } from '../implementations/index.js';
import { createLogger } from '../utils/logger.js';

export function createProductionDependencies(config: ContainerConfig = {}): Dependencies {
  const logger = createLogger('debug-mcp', { level: config.logLevel, ... });
  const environment = new ProcessEnvironment();
  const fileSystem = new FileSystemImpl();
  const processManager = new ProcessManagerImpl();
  const networkManager = new NetworkManagerImpl();

  // Process launchers
  const proxyProcessLauncher = new ProxyProcessLauncherImpl(processManager);

  // Factories
  const proxyManagerFactory = new ProxyManagerFactory(proxyProcessLauncher, fileSystem, logger);
  const sessionStoreFactory = new SessionStoreFactory();

  // Adapter registry (with dynamic loading enabled, overrides forbidden)
  const adapterRegistry = new AdapterRegistry({
    validateOnRegister: false,
    allowOverride: false,
    enableDynamicLoading: true
  });

  return {
    fileSystem, processManager, networkManager, logger, environment,
    proxyProcessLauncher,
    proxyManagerFactory, sessionStoreFactory, adapterRegistry
  };
}
```

### Test Container Configuration

**Location**: `tests/test-utils/helpers/test-dependencies.ts`

```typescript
// Returns a Dependencies object (defined in tests/test-utils/helpers/test-dependencies.ts)
// containing: fileSystem, processManager, networkManager, logger,
//             proxyProcessLauncher,
//             proxyManagerFactory, sessionStoreFactory
export function createMockDependencies(): Dependencies {
  const logger = createMockLogger();
  const fileSystem = createMockFileSystem();
  const processManager = createMockProcessManager();
  const networkManager = createMockNetworkManager();

  const proxyProcessLauncher = createMockProxyProcessLauncher();

  const proxyManagerFactory = new MockProxyManagerFactory();
  proxyManagerFactory.createFn = () => new MockProxyManager();
  const sessionStoreFactory = new MockSessionStoreFactory();

  return {
    fileSystem, processManager, networkManager, logger,
    proxyProcessLauncher,
    proxyManagerFactory, sessionStoreFactory
  };
}

// A separate SessionManager-specific mock helper (also named createMockDependencies)
// lives in tests/core/unit/session/session-manager-test-utils.ts and returns
// SessionManagerDependencies.

export function createMockFileSystem(): IFileSystem {
  return {
    readFile: vi.fn(),
    readTail: vi.fn(),
    writeFile: vi.fn(),
    exists: vi.fn(),
    existsSync: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    ensureDir: vi.fn(),
    ensureDirSync: vi.fn(),
    pathExists: vi.fn(),
    remove: vi.fn(),
    copy: vi.fn(),
    outputFile: vi.fn()
  };
}
```

## Testing Benefits

### Example: Testing SessionManager

**Location**: `tests/core/unit/session/session-manager-*.test.ts`

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
      environment: createMockEnvironment(),
      adapterRegistry: createMockAdapterRegistry()
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

**Location**: `tests/unit/proxy/proxy-manager.start.test.ts` and its siblings
(`proxy-manager.handshake.test.ts`, `proxy-manager-message-handling.test.ts`,
`proxy-manager.branch-coverage.test.ts`)

Because every ProxyManager collaborator is an interface, the suite hands it a
hand-rolled `IProxyProcessLauncher` that returns a fake `IProxyProcess` — an
`EventEmitter` whose `sendCommand` scripts the IPC replies the manager is
waiting for. No process is spawned; the test drives the whole handshake by
emitting messages.

```typescript
class FakeProxyProcess extends EventEmitter implements IProxyProcess {
  pid = 4242;
  send = vi.fn().mockReturnValue(true);
  sendCommand = vi.fn();
  kill = vi.fn().mockReturnValue(true);
  waitForInitialization = vi.fn().mockResolvedValue(undefined);
  // ... the remaining IProxyProcess members
}

beforeEach(() => {
  fakeProcess = new FakeProxyProcess();

  // Script the reply the manager blocks on: acknowledge the init command.
  fakeProcess.sendCommand.mockImplementation((cmd) => {
    if (cmd.cmd === 'init') {
      process.nextTick(() => {
        fakeProcess.emit('message', {
          type: 'status', status: 'init_received', sessionId: cmd.sessionId
        });
      });
    }
  });

  launchProxySpy = vi.fn().mockImplementation(() => {
    setImmediate(() => fakeProcess.emit('spawn'));
    return fakeProcess;
  });

  // Object literals stand in for the interfaces (the real file casts each one).
  proxyManager = new ProxyManager(
    null,                                             // no adapter
    { launchProxy: launchProxySpy },                  // fake launcher
    { pathExists: vi.fn().mockResolvedValue(true) },  // stub file system
    { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
  );
});

it('launches the proxy process and sends the init command', async () => {
  await proxyManager.start(baseConfig);
  expect(launchProxySpy).toHaveBeenCalled();
});
```

The suite owns its teardown too: `afterEach` calls `removeAllListeners()` on both
the fake and the manager and flushes with a `setImmediate`, so a straggling emit
cannot fire into whichever test the shuffled ordering runs next (issue #420).

A reusable `FakeProxyProcessLauncher` also lives in
`tests/implementations/test/fake-process-launcher.ts` for suites that would
rather take one off the shelf.

## Advanced Patterns

### Ownership as an Injected Dependency: `AdapterLease`

**Location**: `src/adapters/adapter-lease.ts`

Dependency injection answers "who hands me this collaborator". `AdapterLease`
answers the next question — "who is responsible for disposing it, and until
when" — for the one resource where getting it wrong is expensive. The adapter
registry caps concurrent adapters per language (`maxInstancesPerLanguage`,
default 10, in `src/adapters/adapter-registry.ts`) and frees a slot only when the
adapter emits `disposed`, so an adapter stranded by a throw during launch setup
leaks a slot permanently. Ten stranded slots turn every later launch of that
language into `Maximum adapter instances (10) reached` — a message that says
nothing about the error that actually caused it (issue #557).

Ownership used to be a time window inside `ProxyLauncher.start` guarded by a
`let adapterOwnedByProxy = false` flag: it had to be assigned at exactly one
point and consulted from exactly one catch, so the next `throw` site added
outside that window would silently reopen the leak. The lease is
behaviour-equivalent on every path, and correctness stops being a discipline:

```typescript
// src/session/launch/proxy-launcher.ts (shape)
const lease = await AdapterLease.acquire(
  this.ctx.adapterRegistry,
  session.language,
  inputs.adapterConfig,
  this.ctx.logger
);
try {
  const plan = await this.prepareAdapterLaunch(session, lease.adapter, inputs, request);

  // Ownership moves here: ProxyManager.cleanup() becomes the disposer,
  // and the release below turns into a no-op.
  const proxyManager = lease.transferTo(this.ctx.proxyManagerFactory);
  session.proxyManager = proxyManager;
  await proxyManager.start(plan.proxyConfig);

  return plan.launchConfig;
} finally {
  await lease.release();  // disposes on every failure path; no-op after a transfer
}
```

The lease tracks three states rather than a boolean — `held`, `transferred`,
`released`. `transferred` and `released` are both "not ours any more", but
confusing them is how a caller ends up looking for a disposed adapter inside a
running proxy, so a misuse raises an error naming which one actually happened.
The lease covers only the setup window; after a transfer the ProxyManager owns
disposal.

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

  create(adapter?: IDebugAdapter): IProxyManager {
    if (!this.instance) {
      this.instance = new ProxyManager(
        adapter || null,
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
