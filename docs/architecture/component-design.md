# MCP Debug Server - Component Design

This document provides detailed design information for the major components of the MCP Debug Server.

## SessionManager

**Location**: `src/session/session-manager.ts` (facade), with logic split across a 4-class hierarchy:

| Class | File | Responsibility |
|-------|------|----------------|
| `SessionManagerCore` | `src/session/session-manager-core.ts` | Lifecycle, state management, event handler setup/cleanup, dependency injection |
| `SessionManagerData` | `src/session/session-manager-data.ts` | Data retrieval: variables, stack traces, scopes, local variables; `selectPolicy()` |
| `SessionManagerOperations` | `src/session/session-manager-operations.ts` | Debug operations: start, step, continue, pause, breakpoints, attach/detach, evaluate |
| `SessionManager` | `src/session/session-manager.ts` | Thin facade that extends `SessionManagerOperations` and implements `handleAutoContinue` |

The inheritance chain is: `SessionManagerCore` -> `SessionManagerData` -> `SessionManagerOperations` -> `SessionManager`.

### Overview
SessionManager is the central orchestrator for all debug sessions. It implements a facade pattern, providing a simplified interface for complex debugging operations while managing the lifecycle of ProxyManager instances.

### Key Design Decisions

1. **One ProxyManager per Session**
   - Each debug session gets its own ProxyManager instance
   - Enables concurrent debugging of multiple scripts
   - Isolates failures to individual sessions

2. **Event Handler Management**
   - Uses WeakMap to track event handlers per session
   - Ensures proper cleanup to prevent memory leaks
   ```typescript
   // WeakMap to store event handlers for cleanup
   protected sessionEventHandlers = new WeakMap<ManagedSession, Map<string, (...args: any[]) => void>>();
   ```

3. **State Management**
   - Delegates state storage to SessionStore
   - Synchronizes state between ProxyManager events and session state
   - Handles state transitions with logging

### Public API

```typescript
class SessionManager {
  // Session lifecycle (from SessionManagerCore)
  async createSession(params: { language: DebugLanguage; name?: string; executablePath?: string; }): Promise<DebugSessionInfo>
  async closeSession(sessionId: string): Promise<boolean>
  async closeAllSessions(): Promise<void>

  // Query (from SessionManagerCore)
  public getSession(sessionId: string): ManagedSession | undefined
  public getAllSessions(): DebugSessionInfo[]
  public getSessionPolicy(sessionId: string): AdapterPolicy

  // Data retrieval (from SessionManagerData)
  async getVariables(sessionId: string, variablesReference: number): Promise<Variable[]>
  async getStackTrace(sessionId: string, threadId?: number, includeInternals?: boolean): Promise<StackFrame[]>
  async getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]>
  async getLocalVariables(sessionId: string, includeSpecial?: boolean): Promise<{ variables: Variable[]; frame: {...} | null; scopeName: string | null }>

  // Debug operations (from SessionManagerOperations)
  async startDebugging(sessionId: string, scriptPath: string, scriptArgs?: string[], dapLaunchArgs?: Partial<CustomLaunchRequestArguments>, dryRunSpawn?: boolean, adapterLaunchConfig?: Record<string, unknown>): Promise<DebugResult>
  async setBreakpoint(sessionId: string, file: string, line: number, condition?: string): Promise<Breakpoint>
  async stepOver(sessionId: string): Promise<DebugResult>
  async stepInto(sessionId: string): Promise<DebugResult>
  async stepOut(sessionId: string): Promise<DebugResult>
  async continue(sessionId: string): Promise<DebugResult>
  async pause(sessionId: string): Promise<DebugResult>
  async evaluateExpression(sessionId: string, expression: string, frameId?: number, context?: string): Promise<EvaluateResult>
  async attachToProcess(sessionId: string, attachConfig: {...}): Promise<DebugResult>
  async detachFromProcess(sessionId: string, terminateProcess?: boolean): Promise<DebugResult>

  // Adapter registry (from SessionManagerCore)
  public adapterRegistry: IAdapterRegistry
}
```

**Note:** `handleAutoContinue()` is an abstract method in `SessionManagerCore`. The concrete `SessionManager` class overrides it but currently logs a warning and leaves the session paused rather than implementing auto-continue.

### Event Handler Pattern

The SessionManager sets up comprehensive event handlers for each ProxyManager:

```typescript
protected setupProxyEventHandlers(
  session: ManagedSession,
  proxyManager: IProxyManager,
  effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>
): void {
  const handlers = new Map<string, (...args: any[]) => void>();

  // Named functions for each event
  const handleStopped = (threadId: number | undefined, reason: string) => {
    // Design intent: auto-continue for stopOnEntry=false on 'entry' stops.
    // Note: The concrete SessionManager.handleAutoContinue() currently logs a warning
    // and does not actually continue (session stays paused). Non-entry stops
    // transition to PAUSED.
    if (!effectiveLaunchArgs.stopOnEntry && reason === 'entry') {
      this.handleAutoContinue().catch(err => { /* log error */ });
    } else {
      this._updateSessionState(session, SessionState.PAUSED);
    }
  };

  // Register and track all handlers
  proxyManager.on('stopped', handleStopped);
  handlers.set('stopped', handleStopped);

  // Store for cleanup
  this.sessionEventHandlers.set(session, handlers);
}
```

### Cleanup Strategy

The cleanup mechanism ensures no memory leaks:

```typescript
protected cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void {
  // Safety check to prevent double cleanup
  if (!this.sessionEventHandlers.has(session)) return;

  const handlers = this.sessionEventHandlers.get(session);
  if (!handlers) return;

  handlers.forEach((handler, eventName) => {
    try {
      proxyManager.removeListener(eventName, handler);
    } catch (error) {
      // Continue cleanup despite errors
    }
  });

  this.sessionEventHandlers.delete(session);
}
```

## ProxyManager

**Location**: `src/proxy/proxy-manager.ts`

### Overview
ProxyManager spawns and communicates with a debug proxy worker process over IPC (Inter-Process Communication). The proxy worker process, in turn, manages the actual debug adapter. ProxyManager does not communicate directly with the debug adapter; instead, it sends commands to the proxy worker via IPC messages, and the proxy worker relays them to the debug adapter over DAP.

### Key Design Decisions

1. **Process Isolation**
   - Each ProxyManager spawns a separate Node.js process
   - Communication via IPC (Inter-Process Communication)
   - Graceful shutdown with force-kill fallback

2. **Message Type System**
   - Strongly typed messages using TypeScript discriminated unions
   ```typescript
   type ProxyMessage = 
     | ProxyStatusMessage 
     | ProxyDapEventMessage 
     | ProxyDapResponseMessage 
     | ProxyErrorMessage;
   ```

3. **Functional Core Integration**
   - Uses pure functions from dap-core for state management
   - Commands pattern for side effects
   ```typescript
   const result = handleProxyMessage(this.dapState, message);
   
   // Execute commands from functional core
   for (const command of result.commands) {
     switch (command.type) {
       case 'log':
         this.logger[command.level](command.message, command.data);
         break;
       case 'emitEvent':
         this.emit(command.event as any, ...command.args);
         break;
       // ...
     }
   }
   ```

### Request Tracking

ProxyManager tracks pending DAP requests with timeout handling:

```typescript
private pendingDapRequests = new Map<string, {
  resolve: (response: DebugProtocol.Response) => void;
  reject: (error: Error) => void;
  command: string;
}>();

// Timeout handler
setTimeout(() => {
  if (this.pendingDapRequests.has(requestId)) {
    this.pendingDapRequests.delete(requestId);
    reject(new Error(ErrorMessages.dapRequestTimeout(command, 35)));
  }
}, 35000);
```

### Process Management

The proxy script discovery mechanism uses directory-based resolution:

```typescript
private async findProxyScript(): Promise<string> {
  const modulePath = fileURLToPath(this.runtimeEnv.moduleUrl);
  const moduleDir = path.dirname(modulePath);
  const dirParts = moduleDir.split(path.sep);
  const lastPart = dirParts[dirParts.length - 1];
  const secondLast = dirParts[dirParts.length - 2];

  let distPath: string;
  if (lastPart === 'dist') {
    distPath = path.join(moduleDir, 'proxy', 'proxy-bootstrap.js');
  } else if (lastPart === 'proxy' && secondLast === 'dist') {
    distPath = path.join(moduleDir, 'proxy-bootstrap.js');
  } else {
    // Fallback to development layout
    distPath = path.resolve(moduleDir, '../../dist/proxy/proxy-bootstrap.js');
  }

  if (!(await this.fileSystem.pathExists(distPath))) {
    throw new Error(`Bootstrap worker script not found at: ${distPath}`);
  }

  return distPath;
}
```

## DAP Proxy Worker

**Location**: `src/proxy/dap-proxy-worker.ts`

### Overview
The ProxyWorker is the core business logic component that runs in the proxy process. It manages the debug adapter lifecycle and DAP protocol communication using the Adapter Policy pattern for language-specific behavior.

### State Machine

The worker implements a strict state machine:

```typescript
enum ProxyState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  CONNECTED = 'connected',
  SHUTTING_DOWN = 'shutting_down',
  TERMINATED = 'terminated'
}
```

### Initialization Sequence

From the `handleInitCommand` method:

1. **State Validation**
   ```typescript
   if (this.state !== ProxyState.UNINITIALIZED) {
     throw new Error(`Invalid state for init: ${this.state}`);
   }
   ```

2. **Payload Validation** (via `validateProxyInitPayload` in `src/utils/type-guards.ts`)
   ```typescript
   // Checks field presence and performs limited structural validation (e.g., verifying
   // required fields exist and are non-null). Does not perform full runtime type validation.
   const validatedPayload = validateProxyInitPayload(payload);
   ```

3. **Logger Creation**
   ```typescript
   const logPath = path.join(payload.logDir, `proxy-${payload.sessionId}.log`);
   this.logger = await this.dependencies.loggerFactory(payload.sessionId, payload.logDir);
   ```

4. **Dry Run Handling**
   ```typescript
   if (payload.dryRunSpawn) {
     this.handleDryRun(payload);
     return;
   }
   ```

### DAP Event Handling

The worker sets up comprehensive DAP event handlers:

```typescript
private setupDapEventHandlers(): void {
  this.connectionManager.setupEventHandlers(this.dapClient, {
    onInitialized: async () => {
      await this.handleInitializedEvent();
    },
    onStopped: (body) => {
      this.logger!.info('[Worker] DAP event: stopped', body);
      this.sendDapEvent('stopped', body);
    },
    onTerminated: (body) => {
      this.logger!.info('[Worker] DAP event: terminated', body);
      this.sendDapEvent('terminated', body);
      this.shutdown();
    },
    // ... other handlers
  });
}
```

### Request Timeout Management

The worker uses `CallbackRequestTracker` for timeout handling:

```typescript
// Track request
this.requestTracker.track(payload.requestId, payload.dapCommand);

try {
  const response = await this.dapClient.sendRequest(payload.dapCommand, payload.dapArgs);
  this.requestTracker.complete(payload.requestId);
  this.sendDapResponse(payload.requestId, true, response);
} catch (error) {
  this.requestTracker.complete(payload.requestId);
  this.sendDapResponse(payload.requestId, false, undefined, message);
}
```

## SessionStore

**Location**: `src/session/session-store.ts`

### Overview
SessionStore provides centralized storage and management for debug sessions with thread-safe operations.

### Design Features

1. **Centralized State Management**
   - Single source of truth for session data
   - Encapsulates state mutations
   - Provides query methods

2. **ID Generation**
   - Uses UUID v4 for session IDs
   - Ensures uniqueness across sessions

3. **Type Safety**
   - Strict typing for session data
   - Separate internal (ManagedSession) and external (DebugSessionInfo) representations

### Key Methods

```typescript
class SessionStore {
  // Creation
  createSession(params: CreateSessionParams): DebugSessionInfo
  
  // Retrieval
  get(sessionId: string): ManagedSession | undefined
  getOrThrow(sessionId: string): ManagedSession
  getAll(): DebugSessionInfo[]
  getAllManaged(): ManagedSession[]
  
  // Updates
  updateState(sessionId: string, state: SessionState): void
  
  // Metadata
  size(): number
}
```

## Error Message System

**Location**: `src/utils/error-messages.ts`

### Overview
Centralized error messages ensure consistency and provide helpful troubleshooting information to users.

### Design Principles

1. **User-Friendly Messages**
   - Clear description of what went wrong
   - Actionable troubleshooting steps
   - Context about typical causes

2. **Parameterized Messages**
   - Functions that accept context (timeouts, commands)
   - Consistent formatting across errors

3. **Categories**
   - DAP request timeouts
   - Proxy initialization failures
   - Step operation timeouts
   - Adapter readiness timeouts

### Example Implementation

```typescript
export const ErrorMessages = {
  dapRequestTimeout: (command: string, timeout: number) => 
    `Debug adapter did not respond to '${command}' request within ${timeout}s. ` +
    `This typically means the debug adapter has crashed or lost connection. ` +
    `Try restarting your debug session. If the problem persists, check the debug adapter logs.`,
    
  proxyInitTimeout: (timeout: number) =>
    `Debug proxy initialization did not complete within ${timeout}s. ` +
    `This may indicate that the debug adapter failed to start or is not properly configured. ` +
    `Check that the required debug adapter is installed and accessible.`
};
```

## Dependency Injection System

**Location**: Shared low-level interface contracts exist in `packages/shared/src/interfaces/` and app-local interface modules under `src/interfaces/`. The application's concrete dependency graph and public `Dependencies` shape are defined in `src/container/dependencies.ts`. The `SessionManagerDependencies` aggregate is defined in `src/session/session-manager-core.ts`.

### Overview
The dependency injection system enables comprehensive testing by abstracting all external dependencies behind interfaces.

### Interface Hierarchy

1. **Core Interfaces**
   ```typescript
   export interface IFileSystem { /* fs operations */ }
   export interface IProcessManager { /* process spawning */ }
   export interface INetworkManager { /* network operations */ }
   export interface ILogger { /* logging */ }
   ```

2. **Factory Interfaces**
   ```typescript
   export interface IProxyManagerFactory {
     create(adapter?: IDebugAdapter): IProxyManager;
   }
   export interface ISessionStoreFactory {
     create(): SessionStore;
   }
   ```

3. **Aggregate Dependencies**
   ```typescript
   export interface SessionManagerDependencies {
     fileSystem: IFileSystem;
     networkManager: INetworkManager;
     logger: ILogger;
     proxyManagerFactory: IProxyManagerFactory;
     sessionStoreFactory: ISessionStoreFactory;
     debugTargetLauncher: IDebugTargetLauncher;
     environment: IEnvironment;
     adapterRegistry: IAdapterRegistry;
   }
   ```

   The top-level `Dependencies` container (in `src/container/dependencies.ts`) also includes launcher services that are used by the proxy and session layers:
   - `processLauncher: IProcessLauncher` -- general-purpose process spawning
   - `proxyProcessLauncher: IProxyProcessLauncher` -- spawning proxy worker child processes
   - `debugTargetLauncher: IDebugTargetLauncher` -- spawning the debug target (uses `processLauncher` and `networkManager`)

### Benefits

1. **Testability** - Easy to mock external systems
2. **Flexibility** - Can swap implementations
3. **Clarity** - Clear dependency requirements
4. **Type Safety** - Compile-time dependency checking

## Next Steps

- See [Testing Architecture](./testing-architecture.md) for how these components are tested
- See [Dependency Injection Pattern](../patterns/dependency-injection.md) for detailed DI examples
- See [Error Handling Pattern](../patterns/error-handling.md) for error management strategies
