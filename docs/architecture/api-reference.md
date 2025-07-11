# mcp-debugger API Reference

> **⚠️ DRAFT DOCUMENTATION**  
> This API reference is based on mcp-debugger v0.10.0 and will be updated as the architecture evolves.

## Table of Contents

1. [IDebugAdapter Interface](#idebugadapter-interface)
2. [SessionManager API](#sessionmanager-api)
3. [ProxyManager API](#proxymanager-api)
4. [AdapterRegistry API](#adapterregistry-api)
5. [Event System](#event-system)
6. [Type Definitions](#type-definitions)

## IDebugAdapter Interface

The core interface that all language adapters must implement.

**Source**: [src/adapters/debug-adapter-interface.ts](../../src/adapters/debug-adapter-interface.ts)

### Properties

```typescript
readonly language: DebugLanguage;  // Language identifier
readonly name: string;             // Human-readable adapter name
```

### Lifecycle Methods

#### `initialize(): Promise<void>`
Initializes the adapter and prepares it for use.

**When called**: After adapter creation, before any operations  
**Expected behavior**: Validate environment, set up internal state  
**Emits**: `'initialized'` event on success

#### `dispose(): Promise<void>`
Cleans up resources and connections.

**When called**: When session ends or adapter is no longer needed  
**Expected behavior**: Close connections, clean up resources  
**Emits**: `'disposed'` event

### State Management Methods

#### `getState(): AdapterState`
Returns the current adapter state.

**Returns**: One of: `UNINITIALIZED`, `INITIALIZING`, `READY`, `CONNECTED`, `DEBUGGING`, `DISCONNECTED`, `ERROR`

#### `isReady(): boolean`
Quick check if adapter is ready for debugging.

**Returns**: `true` if adapter can accept debug operations

#### `getCurrentThreadId(): number | null`
Gets the currently active thread ID during debugging.

**Returns**: Thread ID or `null` if not debugging

### Environment Validation Methods

#### `validateEnvironment(): Promise<ValidationResult>`
Comprehensive environment check for debugging readiness.

**Returns**:
```typescript
{
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

**Example**:
```typescript
const result = await adapter.validateEnvironment();
if (!result.valid) {
  console.error('Environment issues:', result.errors);
}
```

#### `getRequiredDependencies(): DependencyInfo[]`
Lists all dependencies needed for debugging.

**Returns**: Array of dependency information with install commands

### Executable Management Methods

#### `resolveExecutablePath(preferredPath?: string): Promise<string>`
Finds or validates the language runtime executable.

**Parameters**: 
- `preferredPath` - User-specified path (optional)

**Returns**: Resolved executable path  
**Throws**: `AdapterError` if executable not found

#### `getDefaultExecutableName(): string`
Platform-aware default executable name.

**Returns**: e.g., `'python'`, `'node'`, `'go'`

#### `getExecutableSearchPaths(): string[]`
Paths to search for the executable.

**Returns**: Array of paths (usually from PATH environment variable)

### Adapter Configuration Methods

#### `buildAdapterCommand(config: AdapterConfig): AdapterCommand`
Constructs the command to launch the debug adapter process.

**Parameters**:
```typescript
{
  sessionId: string;
  executablePath: string;
  adapterHost: string;
  adapterPort: number;
  logDir: string;
  scriptPath: string;
  scriptArgs?: string[];
  launchConfig: GenericLaunchConfig;
}
```

**Returns**:
```typescript
{
  command: string;      // Executable to run
  args: string[];       // Command line arguments
  env?: Record<string, string>;  // Environment variables
}
```

#### `getAdapterModuleName(): string`
Debug adapter module identifier.

**Returns**: e.g., `'debugpy.adapter'`, `'node-debug2'`

#### `getAdapterInstallCommand(): string`
Command to install the debug adapter.

**Returns**: e.g., `'pip install debugpy'`, `'npm install -g node-debug2'`

### Debug Configuration Methods

#### `transformLaunchConfig(config: GenericLaunchConfig): LanguageSpecificLaunchConfig`
Converts generic config to language-specific format.

**Parameters**: Generic launch configuration  
**Returns**: Language-specific configuration with additional fields

#### `getDefaultLaunchConfig(): Partial<GenericLaunchConfig>`
Default configuration values for the language.

**Returns**: Common default settings

### Path Translation Methods

#### `translateScriptPath(scriptPath: string, context: PathContext): string`
Handles language-specific path requirements.

**Parameters**:
```typescript
{
  isContainer: boolean;
  workspaceRoot: string;
  platform: NodeJS.Platform;
}
```

**Returns**: Translated path suitable for the debug adapter

#### `translateBreakpointPath(filePath: string, context: PathContext): string`
Translates paths for breakpoint locations.

**Parameters**: Same as `translateScriptPath`  
**Returns**: Translated breakpoint file path

### DAP Protocol Methods

#### `sendDapRequest<T>(command: string, args?: unknown): Promise<T>`
Sends a DAP request (usually delegated to ProxyManager).

**Parameters**:
- `command` - DAP command name
- `args` - Command arguments

**Returns**: DAP response

#### `handleDapEvent(event: DebugProtocol.Event): void`
Processes incoming DAP events.

**Critical**: Must update internal state based on events!

**Example**:
```typescript
handleDapEvent(event: DebugProtocol.Event): void {
  if (event.event === 'stopped') {
    this.currentThreadId = event.body?.threadId;
    this.transitionTo(AdapterState.DEBUGGING);
  }
  this.emit(event.event, event.body);
}
```

#### `handleDapResponse(response: DebugProtocol.Response): void`
Processes DAP responses if special handling needed.

### Connection Management Methods

#### `connect(host: string, port: number): Promise<void>`
Establishes connection to debug adapter.

**Parameters**: Host and port for connection  
**Emits**: `'connected'` event on success

#### `disconnect(): Promise<void>`
Closes debug adapter connection.

**Emits**: `'disconnected'` event

#### `isConnected(): boolean`
Connection status check.

**Returns**: `true` if connected to debug adapter

### Error Handling Methods

#### `getInstallationInstructions(): string`
User-friendly installation guide for the debugger.

**Returns**: Multi-line instructions with platform-specific commands

#### `getMissingExecutableError(): string`
Error message when runtime is not found.

**Returns**: Helpful error with installation hints

#### `translateErrorMessage(error: Error): string`
Converts generic errors to language-specific messages.

**Parameters**: Original error  
**Returns**: User-friendly error message

### Feature Support Methods

#### `supportsFeature(feature: DebugFeature): boolean`
Checks if a DAP feature is supported.

**Parameters**: Feature from `DebugFeature` enum  
**Returns**: `true` if supported

#### `getFeatureRequirements(feature: DebugFeature): FeatureRequirement[]`
Requirements for enabling a feature.

**Returns**: Array of requirements (dependencies, versions, etc.)

#### `getCapabilities(): AdapterCapabilities`
Full DAP capabilities declaration.

**Returns**: Object matching DAP Capabilities specification

## SessionManager API

Manages debug sessions and coordinates adapters with ProxyManager.

**Source**: [src/session/session-manager.ts](../../src/session/session-manager.ts)

### Core Methods

#### `createSession(params: CreateSessionParams): Promise<SessionInfo>`
Creates a new debug session.

**Parameters**:
```typescript
{
  language: DebugLanguage;
  name?: string;
  config?: Partial<LaunchConfig>;
}
```

**Returns**: Session information with unique ID

#### `startDebugging(params: StartDebuggingParams): Promise<DebugResult>`
Starts debugging for a session.

**Parameters**:
```typescript
{
  sessionId: string;
  script: string;
  launchConfig?: Partial<LaunchConfig>;
  executablePath?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}
```

**Returns**: Debug result with success status

#### `setBreakpoints(sessionId: string, file: string, breakpoints: SourceBreakpoint[]): Promise<Breakpoint[]>`
Sets breakpoints in a file.

**Returns**: Array of verified breakpoints with actual locations

#### `continue(sessionId: string, threadId?: number): Promise<void>`
Resumes execution from a breakpoint.

#### `stepOver(sessionId: string, threadId?: number): Promise<void>`
Steps over the current line.

#### `stepInto(sessionId: string, threadId?: number): Promise<void>`
Steps into a function call.

#### `stepOut(sessionId: string, threadId?: number): Promise<void>`
Steps out of the current function.

#### `pause(sessionId: string): Promise<void>`
Pauses execution.

#### `terminate(sessionId: string): Promise<void>`
Terminates the debug session.

#### `getStackTrace(sessionId: string, threadId: number): Promise<StackFrame[]>`
Gets the current call stack.

#### `getScopes(sessionId: string, frameId: number): Promise<Scope[]>`
Gets variable scopes for a stack frame.

#### `getVariables(sessionId: string, variablesReference: number): Promise<Variable[]>`
Gets variables in a scope.

#### `evaluateExpression(sessionId: string, expression: string, frameId?: number): Promise<string>`
Evaluates an expression in the current context.

### Session Management

#### `getSession(sessionId: string): SessionInfo | null`
Retrieves session information.

#### `listSessions(): SessionInfo[]`
Lists all active sessions.

#### `deleteSession(sessionId: string): Promise<void>`
Removes a session and cleans up resources.

## ProxyManager API

Manages debug adapter process lifecycle and DAP communication.

**Source**: [src/proxy/proxy-manager.ts](../../src/proxy/proxy-manager.ts)

### Key Methods

#### `constructor(adapter: IDebugAdapter, config: ProxyConfig)`
Creates a new ProxyManager with an adapter.

#### `start(config: StartConfig): Promise<void>`
Starts the debug adapter process and establishes connection.

#### `sendDapRequest(command: string, args?: any): Promise<any>`
Sends a DAP request and waits for response.

#### `stop(): Promise<void>`
Stops the debug adapter process and cleans up.

### Events

ProxyManager forwards all DAP events from the adapter:
- `stopped`, `continued`, `terminated`, `exited`
- `thread`, `output`, `breakpoint`, `module`
- Plus adapter lifecycle events

## AdapterRegistry API

Manages available debug adapters.

**Source**: [src/adapters/adapter-registry.ts](../../src/adapters/adapter-registry.ts)

### Methods

#### `register(language: string, factory: IAdapterFactory): void`
Registers a new adapter factory.

**Example**:
```typescript
registry.register('python', new PythonAdapterFactory());
```

#### `create(language: string, config: AdapterConfig): IDebugAdapter`
Creates an adapter instance.

**Throws**: `AdapterNotFoundError` if language not supported

#### `isLanguageSupported(language: string): boolean`
Checks if a language has a registered adapter.

#### `getSupportedLanguages(): string[]`
Lists all registered languages.

## Event System

### Adapter Events

All adapters emit these events:

```typescript
interface AdapterEvents {
  // DAP events
  'stopped': (event: DebugProtocol.StoppedEvent) => void;
  'continued': (event: DebugProtocol.ContinuedEvent) => void;
  'terminated': (event: DebugProtocol.TerminatedEvent) => void;
  'exited': (event: DebugProtocol.ExitedEvent) => void;
  'thread': (event: DebugProtocol.ThreadEvent) => void;
  'output': (event: DebugProtocol.OutputEvent) => void;
  'breakpoint': (event: DebugProtocol.BreakpointEvent) => void;
  'module': (event: DebugProtocol.ModuleEvent) => void;
  
  // Lifecycle events
  'initialized': () => void;
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: AdapterError) => void;
  
  // State events
  'stateChanged': (oldState: AdapterState, newState: AdapterState) => void;
}
```

### DAP Event Sequences

**Critical**: Understanding event order is crucial! See [DAP Sequence Reference](../development/dap-sequence-reference.md)

Common sequences:
1. **Breakpoint hit**: `stopped` (reason: 'breakpoint')
2. **Continue**: Request → (no event if explicit) → Running
3. **Program end**: `exited` → `terminated`
4. **User stop**: `terminated` (may have `exited` if killed)

## Type Definitions

### Core Types

```typescript
enum DebugLanguage {
  PYTHON = 'python',
  MOCK = 'mock',
  // Future: NODE = 'node', GO = 'go', etc.
}

enum AdapterState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  CONNECTED = 'connected',
  DEBUGGING = 'debugging',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface AdapterCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
}
```

### Error Types

```typescript
class AdapterError extends Error {
  constructor(
    message: string,
    public code: AdapterErrorCode,
    public recoverable: boolean = false
  );
}

enum AdapterErrorCode {
  ENVIRONMENT_INVALID = 'ENVIRONMENT_INVALID',
  EXECUTABLE_NOT_FOUND = 'EXECUTABLE_NOT_FOUND',
  ADAPTER_NOT_INSTALLED = 'ADAPTER_NOT_INSTALLED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  // ... more codes
}
```

## Usage Examples

### Creating and Starting a Debug Session

```typescript
// 1. Create session
const sessionInfo = await sessionManager.createSession({
  language: 'python',
  name: 'My Debug Session'
});

// 2. Set breakpoints
await sessionManager.setBreakpoints(
  sessionInfo.sessionId,
  'app.py',
  [{ line: 10 }, { line: 20 }]
);

// 3. Start debugging
await sessionManager.startDebugging({
  sessionId: sessionInfo.sessionId,
  script: 'app.py',
  launchConfig: { stopOnEntry: true }
});

// 4. Listen for events
sessionManager.on('stopped', (event) => {
  console.log('Paused at:', event.body.reason);
});

// 5. Continue execution
await sessionManager.continue(sessionInfo.sessionId);
```

### Creating a Custom Adapter

```typescript
class MyAdapter extends EventEmitter implements IDebugAdapter {
  // Implement all required methods
  // See MockDebugAdapter for complete example
}

// Register it
const registry = new AdapterRegistry(dependencies);
registry.register('mylang', new MyAdapterFactory());

// Use it
const adapter = registry.create('mylang', config);
```

## Best Practices

1. **Always handle events** - Update adapter state based on DAP events
2. **Emit events** - Notify listeners of state changes
3. **Provide context in errors** - Include helpful messages and recovery hints
4. **Log important operations** - Use the provided logger for debugging
5. **Test thoroughly** - Use mock adapter for integration tests

## See Also

- [Architecture Overview](./README.md)
- [Adapter Development Guide](./adapter-development-guide.md)
- [DAP Sequence Reference](../development/dap-sequence-reference.md)
- [Migration Guide](../migration-guide.md)
