# MCP Debug Server - Component Design

This document provides detailed design information for the major components of the MCP Debug Server.

## SessionManager

**Location**: `src/session/session-manager.ts`

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
   - From lines 121-122:
   ```typescript
   // WeakMap to store event handlers for cleanup
   private sessionEventHandlers = new WeakMap<ManagedSession, Map<string, (...args: any[]) => void>>();
   ```

3. **State Management**
   - Delegates state storage to SessionStore
   - Synchronizes state between ProxyManager events and session state
   - Handles state transitions with logging

### Public API

```typescript
class SessionManager {
  // Session lifecycle
  async createSession(params: { language: DebugLanguage; name?: string; pythonPath?: string; }): Promise<DebugSessionInfo>
  async startDebugging(sessionId: string, scriptPath: string, scriptArgs?: string[], dapLaunchArgs?: Partial<CustomLaunchRequestArguments>, dryRunSpawn?: boolean): Promise<DebugResult>
  async closeSession(sessionId: string): Promise<boolean>
  async closeAllSessions(): Promise<void>
  
  // Debugging operations
  async setBreakpoint(sessionId: string, file: string, line: number, condition?: string): Promise<Breakpoint>
  async stepOver(sessionId: string): Promise<DebugResult>
  async stepInto(sessionId: string): Promise<DebugResult>
  async stepOut(sessionId: string): Promise<DebugResult>
  async continue(sessionId: string): Promise<DebugResult>
  
  // Inspection
  async getVariables(sessionId: string, variablesReference: number): Promise<Variable[]>
  async getStackTrace(sessionId: string, threadId?: number): Promise<StackFrame[]>
  async getScopes(sessionId: string, frameId: number): Promise<DebugProtocol.Scope[]>
  
  // Query
  public getSession(sessionId: string): ManagedSession | undefined
  public getAllSessions(): DebugSessionInfo[]
}
```

### Event Handler Pattern

The SessionManager sets up comprehensive event handlers for each ProxyManager (lines 184-310):

```typescript
private setupProxyEventHandlers(
  session: ManagedSession, 
  proxyManager: IProxyManager,
  effectiveLaunchArgs: Partial<CustomLaunchRequestArguments>
): void {
  const handlers = new Map<string, (...args: any[]) => void>();
  
  // Named functions for each event
  const handleStopped = (threadId: number, reason: string) => {
    if (!effectiveLaunchArgs.stopOnEntry && reason === 'entry') {
      // Auto-continue if stopOnEntry=false
      this.continue(sessionId).catch(err => {
        this.logger.error(`Error auto-continuing:`, err);
      });
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

The cleanup mechanism ensures no memory leaks (lines 313-344):

```typescript
private cleanupProxyEventHandlers(session: ManagedSession, proxyManager: IProxyManager): void {
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
ProxyManager handles the spawning and communication with debug proxy processes. It implements a robust message passing system with timeout handling and state management.

### Key Design Decisions

1. **Process Isolation**
   - Each ProxyManager spawns a separate Node.js process
   - Communication via IPC (Inter-Process Communication)
   - Graceful shutdown with force-kill fallback

2. **Message Type System**
   - Strongly typed messages using TypeScript discriminated unions
   - From lines 92-117:
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
   - From lines 426-456:
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

// Timeout handler (line 290)
setTimeout(() => {
  if (this.pendingDapRequests.has(requestId)) {
    this.pendingDapRequests.delete(requestId);
    reject(new Error(ErrorMessages.dapRequestTimeout(command, 35)));
  }
}, 35000);
```

### Process Management

The proxy script discovery mechanism (lines 297-315):

```typescript
private async findProxyScript(): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Try .js first (for src/dev)
  let proxyWorkerPath = path.resolve(__dirname, '../proxy/proxy-bootstrap.js');
  
  if (!await this.fileSystem.pathExists(proxyWorkerPath)) {
    // Fallback to .cjs (for dist)
    proxyWorkerPath = path.resolve(__dirname, '../proxy/proxy-bootstrap.cjs');
    
    if (!await this.fileSystem.pathExists(proxyWorkerPath)) {
      throw new Error(`Bootstrap worker script not found.`);
    }
  }
  
  return proxyWorkerPath;
}
```

## DAP Proxy Worker

**Location**: `src/proxy/dap-proxy-worker.ts`

### Overview
The ProxyWorker is the core business logic component that runs in the proxy process. It manages the debugpy adapter lifecycle and DAP protocol communication.

### State Machine

The worker implements a strict state machine:

```typescript
enum ProxyState {
  UNINITIALIZED,   // Initial state
  INITIALIZING,    // Setting up adapter
  CONNECTED,       // Ready for debugging
  SHUTTING_DOWN,   // Cleanup in progress
  TERMINATED       // Final state
}
```

### Initialization Sequence

From the `handleInitCommand` method (lines 67-124):

1. **State Validation**
   ```typescript
   if (this.state !== ProxyState.UNINITIALIZED) {
     throw new Error(`Invalid state for init: ${this.state}`);
   }
   ```

2. **Logger Creation**
   ```typescript
   const logPath = path.join(payload.logDir, `proxy-${payload.sessionId}.log`);
   this.logger = await this.dependencies.loggerFactory(payload.sessionId, payload.logDir);
   ```

3. **Path Validation**
   ```typescript
   if (!path.isAbsolute(payload.scriptPath)) {
     throw new Error(`Script path is not absolute: ${payload.scriptPath}`);
   }
   const scriptExists = await this.dependencies.fileSystem.pathExists(payload.scriptPath);
   ```

4. **Dry Run Handling**
   ```typescript
   if (payload.dryRunSpawn) {
     this.handleDryRun(payload);
     return;
   }
   ```

### DAP Event Handling

The worker sets up comprehensive DAP event handlers (lines 198-248):

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
// Track request (line 301)
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
  createSession(params: SessionCreateParams): DebugSessionInfo
  
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
    `This may indicate that debugpy failed to start or is not installed. ` +
    `Check that Python and debugpy are properly installed and accessible.`
};
```

## Dependency Injection System

**Location**: `src/interfaces/external-dependencies.ts`

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
     create(): IProxyManager;
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
   }
   ```

### Benefits

1. **Testability** - Easy to mock external systems
2. **Flexibility** - Can swap implementations
3. **Clarity** - Clear dependency requirements
4. **Type Safety** - Compile-time dependency checking

## Next Steps

- See [Testing Architecture](./testing-architecture.md) for how these components are tested
- See [Dependency Injection Pattern](../patterns/dependency-injection.md) for detailed DI examples
- See [Error Handling Pattern](../patterns/error-handling.md) for error management strategies
