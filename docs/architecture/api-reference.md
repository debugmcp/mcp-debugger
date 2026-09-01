# mcp-debugger API Reference

> Internal API reference for the monorepo (packages plus dynamic adapter loading).
> Signatures here are the in-process TypeScript API. For the MCP tool surface
> (28 tools) see [`src/server/tool-schemas.ts`](../../src/server/tool-schemas.ts).

## Table of Contents

1. [IDebugAdapter Interface](#idebugadapter-interface)
2. [SessionManager API](#sessionmanager-api)
3. [ProxyManager API](#proxymanager-api)
4. [AdapterRegistry API](#adapterregistry-api)
5. [AdapterLease API](#adapterlease-api)
6. [Event System](#event-system)
7. [Type Definitions](#type-definitions)

## IDebugAdapter Interface

The core interface that all language adapters must implement.

**Source**: [packages/shared/src/interfaces/debug-adapter.ts](../../packages/shared/src/interfaces/debug-adapter.ts)

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

#### `validateEnvironment(executablePath?: string): Promise<ValidationResult>`
Comprehensive environment check for debugging readiness.

**Parameters**: `executablePath` (optional) — a user-specified interpreter/executable path to validate.

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

**Returns**: e.g., `'debugpy.adapter'`, `'js-debug'`

#### `getAdapterInstallCommand(): string`
Command to install the debug adapter.

**Returns**: e.g., `'pip install debugpy'`, `'bundled with @debugmcp/adapter-javascript'`

### Debug Configuration Methods

#### `transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig>`
Converts generic config to language-specific format (async to permit build/compilation steps before launch).

**Parameters**: Generic launch configuration
**Returns**: Promise resolving to language-specific configuration with additional fields

#### `getDefaultLaunchConfig(): Partial<GenericLaunchConfig>`
Default configuration values for the language.

**Returns**: Common default settings

### Attach Support Methods (Optional)

#### `supportsAttach?(): boolean`
Checks if the adapter supports attaching to running processes.

**Returns**: `true` if attach is supported

#### `supportsDetach?(): boolean`
Checks if the adapter supports detaching without terminating the debuggee.

**Returns**: `true` if detach is supported

#### `transformAttachConfig?(config: GenericAttachConfig): LanguageSpecificAttachConfig`
Transforms generic attach config to language-specific format. Only called if `supportsAttach()` returns `true`.

**Parameters**: Generic attach configuration
**Returns**: Language-specific attach configuration

#### `getDefaultAttachConfig?(): Partial<GenericAttachConfig>`
Gets default attach configuration for this language.

**Returns**: Default attach configuration with language-specific defaults

#### `usesDirectConnectForAttach?(): boolean`
Whether attach connects directly to an already-listening DAP server (e.g. `rdbg` started with `--open`) instead of spawning an adapter process. When `true`, no adapter command is built for attach sessions; the adapter policy returns a `'connect'` spawn config from the attach host/port.

**Returns**: `true` if attach uses direct connection

### Launch Barrier (Optional)

#### `createLaunchBarrier?(command: string, args?: unknown): AdapterLaunchBarrier | undefined`
Optionally provides a launch barrier that customizes how ProxyManager coordinates a specific DAP request (e.g., fire-and-forget launches).

**Parameters**:
- `command` - The DAP command name
- `args` - Optional command arguments

**Returns**: An `AdapterLaunchBarrier` instance or `undefined`

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

**Source**: [src/session/session-manager.ts](../../src/session/session-manager.ts) (thin facade); actual implementations are in `src/session/session-manager-core.ts`, `src/session/session-manager-data.ts`, and `src/session/session-manager-operations.ts` — the last a thin facade over the per-slice collaborators under `src/session/{launch,attach,breakpoints,execution,inspection,jvm,mirror}/`. Session persistence is in `src/session/session-store.ts`.

### Core Methods

#### `createSession(params: { language: DebugLanguage; name?: string; executablePath?: string }): Promise<DebugSessionInfo>`
Creates a new debug session. `SessionManager.createSession` spells the parameter as an inline object literal; the structurally identical named type `CreateSessionParams` is exported from [src/session/session-store.ts](../../src/session/session-store.ts) and is what `SessionStore.createSession(params: CreateSessionParams)` takes.

**Returns**: `DebugSessionInfo` — `{ id, language, name, state, createdAt, ... }`. The session id is `id`.

#### `startDebugging(sessionId, scriptPath, scriptArgs?, dapLaunchArgs?, dryRunSpawn?, adapterLaunchConfig?, breakOnExceptions?): Promise<DebugResult>`
Starts (or dry-runs) a launch-mode debug session. The parameters are **positional**, not an options object:

```typescript
startDebugging(
  sessionId: string,
  scriptPath: string,
  scriptArgs?: string[],
  dapLaunchArgs?: Partial<CustomLaunchRequestArguments>,  // { stopOnEntry?, justMyCode? }
  dryRunSpawn?: boolean,
  adapterLaunchConfig?: Record<string, unknown>,          // adapter-specific passthrough
  breakOnExceptions?: ExceptionBreakMode
): Promise<DebugResult>
```

Delegates to `DebugLauncher` (`src/session/launch/debug-launcher.ts`), which owns the launch sequence end to end.

**Returns**: `DebugResult` — `{ success, state, error?, data?, canContinue?, errorType?, errorCode? }`. For a dry run, `data` carries `dryRun`, `command` and `script`.

#### `restartDebugging(sessionId: string): Promise<DebugResult>`
Replays the session's last real launch and re-applies breakpoints (content anchors are re-resolved). Launch-mode sessions only. Exposed as the `restart_debugging` MCP tool.

#### `setBreakpoint(sessionId: string, bp: { file: string; line: number; condition?: string; logMessage?: string; suspendPolicy?: 'all' | 'thread'; requestedLine?: number; anchor?: { statement: string; nearLine?: number } }): Promise<{ breakpoint: Breakpoint; warning?: string }>`
Sets a breakpoint in a file. Internally sends a DAP `setBreakpoints` request for all breakpoints in the same source file. `requestedLine` records the originally requested line for loud snapping; `anchor` stores the content anchor that `restartDebugging` re-resolves (issue #271); `warning` carries live-sync failures. Neither extra field ever enters the DAP payload.

**Returns**: Breakpoint information plus an optional sync warning

#### `setFunctionBreakpoint(sessionId: string, bp: { functionName: string; condition?: string }): Promise<{ breakpoint: FunctionBreakpoint; warning?: string }>`
Sets a symbol-addressed (function) breakpoint (issue #271 phase 3).

#### `resolveFunctionBreakpointName(sessionId: string, requestedName: string): FunctionBreakpointNameResolution`
Resolves a function-breakpoint name through the session's adapter policy — the shared answer behind `set_breakpoint` and `remove_breakpoint` (issue #559). Synchronous.

#### `removeBreakpoint(sessionId: string, breakpointId: string): Promise<{ removed?: Breakpoint | FunctionBreakpoint; warning?: string }>`
Removes one breakpoint by the id `setBreakpoint`/`setFunctionBreakpoint` returned.

#### `removeBreakpointsByLocation(sessionId: string, file: string, line: number): Promise<{ removed: Breakpoint[]; warning?: string }>`
Removes every breakpoint at a `file:line` location.

#### `removeFunctionBreakpointsByName(sessionId: string, requestedName: string): Promise<FunctionBreakpointRemoval>`
Removes every function breakpoint a name addresses, in one DAP re-send (issue #559).

#### `clearBreakpoints(sessionId: string, file?: string): Promise<{ cleared: number; files: string[]; warning?: string }>`
Removes all of the session's breakpoints, or all breakpoints in one file.

#### `continue(sessionId: string): Promise<DebugResult>`
Resumes execution from a breakpoint. There is no `threadId` parameter — the session's current thread is used.

#### `stepOver(sessionId: string): Promise<DebugResult<StepResultData>>`
Steps over the current line.

#### `stepInto(sessionId: string): Promise<DebugResult<StepResultData>>`
Steps into a function call.

#### `stepOut(sessionId: string): Promise<DebugResult<StepResultData>>`
Steps out of the current function.

The three step methods take only a `sessionId` and return a typed result, not `void`. `StepResultData` adds a required `message` plus an optional `location` (`{ file, line, column? }`, taken from the top stack frame). If no `stopped` event arrives before the step grace window elapses, the call still succeeds with `data.pending = true` — that window is a reporting deadline, not a deadline on the debuggee.

#### `pause(sessionId: string, threadId?: number): Promise<DebugResult<PauseResultData>>`
Pauses execution. `PauseResultData` adds `message`, optional `stopReason`/`rawStopReason` (present only when this pause's own stop was recorded, never a stale earlier one) and an optional `location`.

#### `getStackTrace(sessionId: string, threadId?: number, includeInternals?: boolean): Promise<StackFrame[]>`
Gets the current call stack. If `threadId` is omitted, the session's current thread ID is used. If `includeInternals` is false (default), language-specific internal frames are filtered out via the adapter policy.

#### `getScopes(sessionId: string, frameId: number): Promise<Scope[]>`
Gets variable scopes for a stack frame.

#### `getVariables(sessionId: string, variablesReference: number, names?: string[]): Promise<Variable[]>`
Gets variables in a scope.

#### `evaluateExpression(sessionId: string, expression: string, frameId?: number, timeoutMs?: number): Promise<EvaluateResult>`
Evaluates an expression in the current context. Returns a structured `EvaluateResult` with `result`, `type`, `variablesReference`, and optional error text.

**Note**: The DAP `evaluate` `context` is chosen by the adapter policy's `getEvaluateContext()` (defaults to `'variables'`; the Ruby policy uses `'repl'`). There is no client-supplied context parameter.

#### `attachToProcess(sessionId: string, attachConfig): Promise<DebugResult<AttachResultData>>`
Attaches the debugger to a running process. `attachConfig` is an inline object:

```typescript
{
  port?: number;
  host?: string;
  processId?: number | string;
  timeout?: number;
  sourcePaths?: string[];
  stopOnEntry?: boolean;
  justMyCode?: boolean;
  verifyTimeout?: number;
  breakOnExceptions?: ExceptionBreakMode;
  adapterConfig?: Record<string, unknown>;
}
```

#### `detachFromProcess(sessionId: string, terminateProcess?: boolean): Promise<DebugResult>`
Detaches the debugger from an attached process.

#### `redefineClasses(sessionId: string, classesDir: string, sinceTimestamp?: number, timeoutMs?: number): Promise<RedefineClassesResult>`
Java only. Hot-swaps changed classes into a running JVM via a custom DAP `redefineClasses` request. `sinceTimestamp` (ms) limits the scan to `.class` files modified after that time (0/omitted = all); `timeoutMs` overrides the DAP request timeout. Exposed as the `redefine_classes` MCP tool.

#### `exposeSession(sessionId: string): Promise<ExposeSessionResult>`
Opens the session's read-only DAP mirror endpoint (issue #217) by sending the `mirrorExpose` pseudo-command to the proxy worker, which hosts a loopback-only, token-gated DAP server multiplexed onto the live adapter connection. Returns `{host, port, token}`; idempotent while exposed (same endpoint, token unrotated). Requires a running proxy. Exposed as the `expose_session` MCP tool.

#### `unexposeSession(sessionId: string): Promise<UnexposeSessionResult>`
Closes the mirror endpoint via the `mirrorUnexpose` pseudo-command and disconnects mirror clients (they receive a `terminated` event). A no-op success when not exposed; when the proxy is already gone it just clears the stale exposure record. Exposed as the `unexpose_session` MCP tool.

#### `listThreads(sessionId: string): Promise<Array<{ id: number; name: string }>>`
Lists all threads in the debug session.

#### `getLocalVariables(sessionId: string, includeSpecial?: boolean, names?: string[]): Promise<{ variables: Variable[]; frame: { name: string; file: string; line: number } | null; scopeName: string | null; anchorNote?: string; truncation?: VariableTruncationSummary }>`
Orchestrates stack trace → scopes → variables, then delegates to the language adapter's policy to extract just the locals. If `includeSpecial` is false (default), internal/special variables are filtered out; `names` is an optional exact-match, case-sensitive filter applied to the extracted locals. The return type is an inline object literal (there is no named result type). `anchorNote` explains any departure from "the top frame's local scope" (a lower frame was anchored, and/or a sibling scope supplied the variables); `truncation` appears when the size guards cut the response.

### Session Management

#### `getSession(sessionId: string): ManagedSession | undefined`
Retrieves session information.

#### `getAllSessions(): DebugSessionInfo[]`
Lists all active sessions.

#### `closeSession(sessionId: string): Promise<boolean>`
Tears down the proxy and removes the session from the store. Returns `false` when the session id is unknown. There is no `terminate()` method.

#### `closeAllSessions(): Promise<void>`
Closes every active session by calling `closeSession` on each. This is the shutdown path `DebugMcpServer.stop()` calls.

## ProxyManager API

Manages debug adapter process lifecycle and DAP communication.

**Source**: [src/proxy/proxy-manager.ts](../../src/proxy/proxy-manager.ts)

### Key Methods

#### `constructor(adapter: IDebugAdapter | null, proxyProcessLauncher, fileSystem, logger, runtimeEnv?, options?)`
Creates a new ProxyManager with an adapter (or `null` for language-agnostic support) and injected dependencies (process launcher, filesystem, logger, optional runtime environment, optional `ProxyManagerOptions`).

#### `start(config: ProxyConfig): Promise<void>`
Starts the debug adapter process and establishes connection.

#### `sendDapRequest(command: string, args?: any): Promise<any>`
Sends a DAP request and waits for response.

#### `stop(): Promise<void>`
Stops the debug adapter process and cleans up.

#### `getCurrentThreadId(): number | null`
Returns the currently tracked thread ID.

#### `isRunning(): boolean`
Returns whether the proxy process is running.

### Events

ProxyManager forwards DAP events from the adapter:
- Individually typed and re-emitted with extracted arguments (not the raw DAP event object): `stopped` as `(threadId: number | undefined, reason: string, data?: StoppedEvent['body'])`, `continued`, `terminated`, `exited` as `(exitCode?: number)`, `output`, `breakpoint`
- All other DAP events (including `thread`, `module`, etc.) are forwarded as the generic `dap-event` event with `(event: string, body: unknown)` signature
- Plus proxy lifecycle and status events: `initialized`, `init-received`, `error`, `exit` as `(code, signal?, expected?)`, `dry-run-complete`, `adapter-configured`, `adapter-capabilities`, `function-breakpoints-synced`, `breakpoints-synced`

## AdapterRegistry API

Manages available debug adapters.

**Source**: [src/adapters/adapter-registry.ts](../../src/adapters/adapter-registry.ts)

### Methods

#### `async register(language: string, factory: IAdapterFactory): Promise<void>`
Registers a new adapter factory.

**Example**:
```typescript
await registry.register('python', new PythonAdapterFactory());
```

#### `create(language: string, config: AdapterConfig): Promise<IDebugAdapter>`
Creates an adapter instance (async).

**Throws**: `AdapterNotFoundError` if language not supported

#### `isLanguageSupported(language: string): boolean`
Checks if a language has a registered adapter.

#### `getSupportedLanguages(): string[]`
Lists all registered languages.

#### `unregister(language: string): boolean`
Removes an adapter factory and disposes any active adapters for the language. Returns `false` if no factory was registered.

#### `getAdapterInfo(language: string): AdapterInfo | undefined`
Returns metadata for a registered adapter, or `undefined`.

#### `getAllAdapterInfo(): Map<string, AdapterInfo>`
Returns metadata for all registered adapters.

#### `async listLanguages(): Promise<string[]>`
Lists all known languages from static registration and dynamic discovery (used by server.ts for language advertisement).

#### `async listAvailableAdapters(): Promise<AdapterManifestEntry[]>`
Lists detailed adapter metadata (known adapters plus install status). `AdapterManifestEntry` is defined in [packages/shared/src/interfaces/adapter-registry.ts](../../packages/shared/src/interfaces/adapter-registry.ts).

#### `async getFactory(language: string): Promise<IAdapterFactory | undefined>`
Returns the factory for a language, loading it dynamically if necessary.

#### `async getFactoryResult(language: string): Promise<FactoryLoadResult>`
The same lookup, but reporting *why* a factory could not be produced instead of collapsing to `undefined`.

#### `async getFactoryMetadata(language: string): Promise<AdapterMetadata | undefined>`
Returns a language factory's own metadata (the `AdapterMetadata` exported by `@debugmcp/shared`, not the loader's manifest-shaped one in `src/adapters/adapter-loader.ts`).

#### `disposeAll(): Promise<void>`
Disposes all created adapters, clears factories, and resets the registry.

#### `getActiveAdapterCount(): number`
Returns the total number of active adapter instances across all languages.

## AdapterLease API

The registry caps concurrent adapters per language and frees a slot only when the adapter emits `'disposed'`, so every failure path between "create the adapter" and "hand it to the ProxyManager" has to give the slot back. `AdapterLease` makes that ownership explicit instead of a discipline (issue #557).

**Source**: [src/adapters/adapter-lease.ts](../../src/adapters/adapter-lease.ts)

`ProxyLauncher.start()` (`src/session/launch/proxy-launcher.ts`) is the caller: acquire the lease, do the setup inside `try`, hand ownership over with `transferTo`, and `release()` in `finally`.

#### `static acquire(registry, language: string, config: AdapterConfig, logger: ILogger): Promise<AdapterLease>`
Creates the adapter through the registry and takes ownership of it. A rejection from `create` yields no lease — nothing was allocated.

#### `readonly adapter: IDebugAdapter`
The leased adapter, valid whether or not the lease is still held.

#### `transferTo(factory: IProxyManagerFactory): IProxyManager`
Hands the adapter to a ProxyManager, which becomes its owner and disposer. Throws if the lease is no longer held. Ownership moves only after `factory.create` returns, so a throwing factory leaves the lease held and the caller's `finally` still disposes.

#### `release(): Promise<void>`
Disposes the adapter if this lease still owns it. Idempotent, a no-op after a transfer, and **never throws** — it is the `finally` of the setup block, so a teardown failure must not replace the error the caller is about to report.

#### `getState(): 'held' | 'transferred' | 'released'`
Which of the three ownership states the lease is in.

Disposal itself goes through the helpers in [src/adapters/adapter-disposal.ts](../../src/adapters/adapter-disposal.ts), shared by the lease and `ProxyManager.cleanup()`.

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
  RUBY = 'ruby',
  JAVASCRIPT = 'javascript',
  RUST = 'rust',
  GO = 'go',
  JAVA = 'java',
  DOTNET = 'dotnet',
  CPP = 'cpp',
  MOCK = 'mock',
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
  cwd?: string;  // Working directory for the adapter process (issue #320)
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
  // Environment errors
  ENVIRONMENT_INVALID = 'ENVIRONMENT_INVALID',
  EXECUTABLE_NOT_FOUND = 'EXECUTABLE_NOT_FOUND',
  ADAPTER_NOT_INSTALLED = 'ADAPTER_NOT_INSTALLED',
  INCOMPATIBLE_VERSION = 'INCOMPATIBLE_VERSION',
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_LOST = 'CONNECTION_LOST',
  // Protocol errors
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
  // Runtime errors
  DEBUGGER_ERROR = 'DEBUGGER_ERROR',
  SCRIPT_NOT_FOUND = 'SCRIPT_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
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

// 2. Set breakpoints (one call per breakpoint)
await sessionManager.setBreakpoint(sessionInfo.id, { file: 'app.py', line: 10 });
await sessionManager.setBreakpoint(sessionInfo.id, { file: 'app.py', line: 20 });

// 3. Start debugging (positional arguments, not an options object)
await sessionManager.startDebugging(
  sessionInfo.id,
  'app.py',
  [],                    // scriptArgs
  { stopOnEntry: true }  // dapLaunchArgs
);

// 4. Listen for events via the ProxyManager for the session
// Note: SessionManager IS an EventEmitter -- SessionManagerCore extends it (src/session/session-manager-core.ts:156). Subscribe to events through
// the ProxyManager associated with the session, or poll session state.
const session = sessionManager.getSession(sessionInfo.id);
session?.proxyManager?.on('stopped', (threadId, reason) => {
  console.log('Paused at:', reason);
});

// 5. Continue execution
await sessionManager.continue(sessionInfo.id);
```

### Creating a Custom Adapter

```typescript
class MyAdapter extends EventEmitter implements IDebugAdapter {
  // Implement all required methods
  // See MockDebugAdapter for complete example
}

// Register it
const registry = new AdapterRegistry({ enableDynamicLoading: false });
await registry.register('mylang', new MyAdapterFactory());

// Use it
const adapter = await registry.create('mylang', config);
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
- [CHANGELOG](../../CHANGELOG.md)
