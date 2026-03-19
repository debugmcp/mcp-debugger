# Adapter Policy Pattern Documentation

## Overview

The mcp-debugger uses a **dual-pattern architecture** that combines two complementary adapter patterns:
1. **IDebugAdapter**: Full adapter implementations for complete language support
2. **AdapterPolicy**: Lightweight policies for language-specific behaviors in session management

This document explains the AdapterPolicy pattern and how it relates to the main IDebugAdapter interface.

## The Two Patterns Explained

### IDebugAdapter (Primary Pattern)
- **Purpose**: Complete debug adapter implementation
- **Scope**: Handles all DAP protocol communication and language runtime management
- **Location**: `packages/adapter-<language>/`
- **Examples**: `JavascriptDebugAdapter`, `PythonDebugAdapter`, `MockDebugAdapter`, `RustDebugAdapter`, `GoDebugAdapter`

### AdapterPolicy (Supporting Pattern)
- **Purpose**: Language-specific policies for session management
- **Scope**: Lightweight behaviors used by SessionManager and DAP proxy layer
- **Location**: `packages/shared/src/interfaces/adapter-policy-*.ts`
- **All policies**: `DefaultAdapterPolicy`, `PythonAdapterPolicy`, `JsDebugAdapterPolicy`, `RustAdapterPolicy`, `GoAdapterPolicy`, `JavaAdapterPolicy`, `DotnetAdapterPolicy`, `MockAdapterPolicy`

## AdapterPolicy Interface

The `AdapterPolicy` interface is defined in `packages/shared/src/interfaces/adapter-policy.ts`. It provides both required and optional methods for language-specific behaviors:

```typescript
export interface AdapterPolicy {
  // === Identity ===
  name: string;                              // e.g., 'default', 'python', 'js-debug', 'rust', 'go', 'java', 'dotnet', 'mock'

  // === Child Session / Multi-session Support ===
  supportsReverseStartDebugging: boolean;
  childSessionStrategy: ChildSessionStrategy; // 'none' | 'launchWithPendingTarget' | 'attachByPort' | 'adoptInParent'
  shouldDeferParentConfigDone(parentConfig: Record<string, unknown>): boolean;
  buildChildStartArgs(pendingId: string, parentConfig: Record<string, unknown>):
    { command: 'launch' | 'attach'; args: Record<string, unknown> };
  isChildReadyEvent(evt: DebugProtocol.Event): boolean;

  // === DAP adapter configuration ===
  getDapAdapterConfiguration(): { type: string };
  getDebuggerConfiguration(): {
    requiresStrictHandshake?: boolean;
    skipConfigurationDone?: boolean;
    supportsVariableType?: boolean;
  };
  getInitializationBehavior(): {
    deferConfigDone?: boolean;
    addRuntimeExecutable?: boolean;
    trackInitializeResponse?: boolean;
    requiresInitialStop?: boolean;
    defaultStopOnEntry?: boolean;
    sendLaunchBeforeConfig?: boolean;
    sendAttachBeforeInitialized?: boolean;
  };
  getDapClientBehavior(): DapClientBehavior;

  // === Executable resolution ===
  resolveExecutablePath(providedPath?: string): string | undefined;
  validateExecutable?(executablePath: string): Promise<boolean>;

  // === Command queueing ===
  requiresCommandQueueing(): boolean;
  shouldQueueCommand(command: string, state: AdapterSpecificState): CommandHandling;
  processQueuedCommands?(commands: unknown[], state: AdapterSpecificState): unknown[];

  // === State management ===
  createInitialState(): AdapterSpecificState;
  updateStateOnCommand?(command: string, args: unknown, state: AdapterSpecificState): void;
  updateStateOnResponse?(command: string, response: unknown, state: AdapterSpecificState): void;
  updateStateOnEvent?(event: string, body: unknown, state: AdapterSpecificState): void;
  isInitialized(state: AdapterSpecificState): boolean;
  isConnected(state: AdapterSpecificState): boolean;

  // === Adapter matching ===
  matchesAdapter(adapterCommand: { command: string; args: string[] }): boolean;

  // === Adapter process spawning (optional) ===
  getAdapterSpawnConfig?(payload: { ... }): { command: string; args: string[]; ... } | undefined;

  // === Stack frame filtering (optional) ===
  filterStackFrames?(frames: StackFrame[], includeInternals: boolean): StackFrame[];
  isInternalFrame?(frame: StackFrame): boolean;

  // === Variable extraction (optional) ===
  extractLocalVariables?(stackFrames, scopes, variables, includeSpecial?): Variable[];
  getLocalScopeName?(): string | string[];

  // === Session readiness (optional) ===
  isSessionReady?(state: SessionState, options: { stopOnEntry?: boolean }): boolean;

  // === Non-file source identifiers (optional, e.g. Java FQCNs) ===
  isNonFileSourceIdentifier?(sourceIdentifier: string): boolean;

  // === Language-specific handshake (optional) ===
  performHandshake?(context: { proxyManager; sessionId; dapLaunchArgs?; scriptPath; ... }): Promise<void>;
}
```

## How the Patterns Work Together

### 1. Session Creation Flow
```
Client Request → Server → SessionManager
                            ↓
                    AdapterRegistry.create()
                            ↓
                    Creates IDebugAdapter instance
                            ↓
                    SessionManager.selectPolicy()
                            ↓
                    Gets AdapterPolicy for behaviors
```

### 2. During Debugging Operations

#### IDebugAdapter handles:
- Building adapter command lines
- Managing DAP protocol communication
- Environment validation
- Connection management
- Feature capabilities

#### AdapterPolicy handles:
- Executable path validation (language-specific)
- Handshake procedures (e.g., JavaScript's multi-session negotiation)
- Stack frame filtering (e.g., hiding Node.js internals)
- Variable extraction logic (e.g., Python's locals vs JavaScript's scopes)

## All Adapter Policies

| Policy | File | `name` | DAP type | Multi-session | Command queueing |
|--------|------|--------|----------|---------------|------------------|
| `DefaultAdapterPolicy` | `adapter-policy.ts` | `'default'` | `'default'` | No | No |
| `PythonAdapterPolicy` | `adapter-policy-python.ts` | `'python'` | `'debugpy'` | No | No |
| `JsDebugAdapterPolicy` | `adapter-policy-js.ts` | `'js-debug'` | `'pwa-node'` | Yes | Yes |
| `RustAdapterPolicy` | `adapter-policy-rust.ts` | `'rust'` | `'lldb'` | No | No |
| `GoAdapterPolicy` | `adapter-policy-go.ts` | `'go'` | `'dlv-dap'` | No | No |
| `JavaAdapterPolicy` | `adapter-policy-java.ts` | `'java'` | `'java'` | No | No |
| `DotnetAdapterPolicy` | `adapter-policy-dotnet.ts` | `'dotnet'` | `'coreclr'` | No | No |
| `MockAdapterPolicy` | `adapter-policy-mock.ts` | `'mock'` | `'mock'` | No | No |

### Key Differences Between Policies

**DefaultAdapterPolicy** is a lightweight placeholder used while the proxy worker determines which concrete policy to activate. All its methods return safe no-op values. `isInitialized()` and `isConnected()` always return `false`; `matchesAdapter()` always returns `false`.

**JsDebugAdapterPolicy** is the most complex policy:
- `supportsReverseStartDebugging: true` and `childSessionStrategy: 'launchWithPendingTarget'`
- Requires strict initialization sequence (tracked via `JsAdapterState` with `initializeResponded` and `startSent` flags)
- `requiresCommandQueueing()` returns `true` -- commands are queued until initialize response, then reordered (configs -> configurationDone -> launch -> others)
- Provides a full `performHandshake()` implementation for the js-debug multi-session setup
- `isChildReadyEvent()` waits for `'thread'` or `'stopped'` (not `'initialized'`)
- `filterStackFrames()` removes `<node_internals>` frames

**PythonAdapterPolicy**:
- `resolveExecutablePath()` checks `PYTHON_PATH` env var, then defaults to `'python'` (Windows) or `'python3'` (Unix)
- `validateExecutable()` spawns Python to detect Windows Store aliases
- `extractLocalVariables()` filters out `special variables`, `function variables`, dunder variables, and `_pydev*` internals
- `getLocalScopeName()` returns `['Locals']`

**RustAdapterPolicy**:
- `resolveExecutablePath()` prefers an explicitly provided path, then `CARGO_PATH` env var, otherwise returns `undefined` to let downstream adapter discovery decide. Despite the name, this does not resolve the vendored CodeLLDB path; actual adapter spawn path selection happens in `getAdapterSpawnConfig()`.
- `validateExecutable()` checks filesystem existence of the candidate executable, then spawns it with `--version` and verifies stdout contains `codelldb`
- `getAdapterSpawnConfig()` resolves a vendored CodeLLDB binary based on platform/arch
- `getLocalScopeName()` returns `['Local', 'Locals']`

**GoAdapterPolicy**:
- `resolveExecutablePath()` checks `DLV_PATH` env var, defaults to `'dlv'`
- `getInitializationBehavior()` returns `{ defaultStopOnEntry: false, sendLaunchBeforeConfig: true }` to work around Delve's "unknown goroutine" quirk
- `filterStackFrames()` removes `/runtime/` and `/testing/` frames
- `extractLocalVariables()` only retrieves the `Locals` scope (not `Arguments`), filtering out `_`-prefixed internal variables unless `includeSpecial` is true
- `getLocalScopeName()` returns `['Locals', 'Arguments']` (for reporting purposes, but `extractLocalVariables` only uses `Locals`)

**JavaAdapterPolicy**:
- `resolveExecutablePath()` checks `JAVA_HOME` env var, constructs `$JAVA_HOME/bin/java`
- `isNonFileSourceIdentifier()` detects Java FQCNs (no path separators, does not end with `.java`) so the server skips file existence checks
- `getInitializationBehavior()` returns `{ sendLaunchBeforeConfig: true }` because JdiDapServer sends `'initialized'` during initialize
- `filterStackFrames()` removes JDK internal frames (`java.*`, `javax.*`, `sun.*`) and frames with file paths containing `/jdk/` or `/rt.jar/`

**DotnetAdapterPolicy**:
- `resolveExecutablePath()` checks `NETCOREDBG_PATH` env var, defaults to `'netcoredbg'`
- `getDapAdapterConfiguration()` returns `{ type: 'coreclr' }`
- `getInitializationBehavior()` returns `{ sendAttachBeforeInitialized: false }` (standard DAP sequence)
- `extractLocalVariables()` filters out C# compiler-generated variables (`<>`, `CS$<>`, `$VB$`, `<>t__`, `<>s__`) unless `includeSpecial` is true
- `getLocalScopeName()` returns `['Locals']`
- `filterStackFrames()` removes frames with no source file and `System.*`/`Microsoft.*` frames
- Supports TCP-to-stdio bridge launches when upstream provides `adapterCommand`; falls back to direct `netcoredbg --interpreter=vscode --server=<port>` mode otherwise. The policy itself does not create the bridge command; it trusts upstream code (`DotnetDebugAdapter.buildAdapterCommand`) to supply `adapterCommand` when bridge mode is required.

**MockAdapterPolicy**:
- `resolveExecutablePath()` returns `providedPath || 'mock'`
- `filterStackFrames()` returns all frames unfiltered
- `extractLocalVariables()` returns all variables from the first scope
- `getDapClientBehavior()` returns minimal config with `childInitTimeout: 1000` (shorter for testing)

## Usage in Session Management

### The selectPolicy() Pattern

Session management classes use a `selectPolicy()` method to get the appropriate policy:

```typescript
export class SessionManagerData extends SessionManagerCore {
  protected selectPolicy(language: string | DebugLanguage): AdapterPolicy {
    switch (language) {
      case 'python':
      case DebugLanguage.PYTHON:
        return PythonAdapterPolicy;
      case 'javascript':
      case DebugLanguage.JAVASCRIPT:
        return JsDebugAdapterPolicy;
      case 'rust':
      case DebugLanguage.RUST:
        return RustAdapterPolicy;
      case 'go':
      case DebugLanguage.GO:
        return GoAdapterPolicy;
      case 'java':
      case DebugLanguage.JAVA:
        return JavaAdapterPolicy;
      case 'dotnet':
      case DebugLanguage.DOTNET:
        return DotnetAdapterPolicy;
      case 'mock':
      case DebugLanguage.MOCK:
        return MockAdapterPolicy;
      default:
        return DefaultAdapterPolicy;
    }
  }

  async getStackTrace(sessionId: string): Promise<StackFrame[]> {
    // ... get frames from DAP

    // Apply language-specific filtering
    const policy = this.selectPolicy(session.language);
    if (policy.filterStackFrames) {
      frames = policy.filterStackFrames(frames, includeInternals);
    }

    return frames;
  }
}
```

## Migration from Hardcoded Conditionals

### Before (Hardcoded)
```typescript
// In session-manager-operations.ts
if (session.language === 'python') {
  // Python-specific validation
  const valid = await this.isValidPythonExecutable(executablePath);
}

if (session.language === 'javascript') {
  // JavaScript-specific handshake
  await this.performJsHandshake(proxyManager, ...);
}
```

### After (Policy-Based)
```typescript
// In session-manager-operations.ts
const policy = this.selectPolicy(session.language);

// Validation
if (policy.validateExecutable) {
  const valid = await policy.validateExecutable(executablePath);
}

// Handshake
if (policy.performHandshake) {
  await policy.performHandshake(context);
}
```

## When to Use Each Pattern

### Use IDebugAdapter when:
- Adding complete support for a new language
- Implementing DAP protocol handling
- Managing adapter process lifecycle
- Defining language capabilities

### Use AdapterPolicy when:
- Adding language-specific behaviors to session management
- Customizing stack trace presentation
- Implementing language-specific validation
- Handling unique handshake requirements

## Adding Support for a New Language

To add complete support for a new language, you need both:

### 1. Create the IDebugAdapter Implementation
```typescript
// packages/adapter-<language>/src/<language>-debug-adapter.ts
export class MyLangDebugAdapter extends EventEmitter implements IDebugAdapter {
  // Full implementation of all IDebugAdapter methods
}
```

### 2. Create the AdapterPolicy
```typescript
// packages/shared/src/interfaces/adapter-policy-<language>.ts
export const MyLangAdapterPolicy: AdapterPolicy = {
  name: 'mylang',
  supportsReverseStartDebugging: false,
  childSessionStrategy: 'none',
  // ... implement all required methods
  getDapAdapterConfiguration: () => ({ type: 'mylang' }),
  resolveExecutablePath: (providedPath?: string) => providedPath || 'mylang',
  getDebuggerConfiguration: () => ({}),
  requiresCommandQueueing: () => false,
  shouldQueueCommand: () => ({ shouldQueue: false, shouldDefer: false }),
  createInitialState: () => ({ initialized: false, configurationDone: false }),
  isInitialized: (state) => state.initialized,
  isConnected: (state) => state.initialized,
  matchesAdapter: (cmd) => cmd.command.includes('mylang'),
  getInitializationBehavior: () => ({}),
  getDapClientBehavior: () => ({}),
  // ... optional methods as needed
};
```

### 3. Register in selectPolicy()
```typescript
case 'mylang':
case DebugLanguage.MYLANG:
  return MyLangAdapterPolicy;
```

## Benefits of the Dual-Pattern Architecture

1. **Separation of Concerns**
   - IDebugAdapter: Complete adapter implementation
   - AdapterPolicy: Lightweight session behaviors

2. **Incremental Refactoring**
   - Policies can be added without changing adapter implementations
   - Language conditionals can be migrated gradually

3. **Type Safety**
   - Both patterns are fully typed
   - Compile-time checking for interface compliance

4. **Testability**
   - Policies are simple static objects, easy to test
   - Adapters can be tested independently

5. **Maintainability**
   - Language-specific code is centralized
   - Clear boundaries between concerns

## Summary

The dual-pattern architecture provides a robust foundation for multi-language debugging:
- **IDebugAdapter** provides the complete adapter infrastructure
- **AdapterPolicy** provides lightweight language-specific behaviors
- Together, they enable clean, maintainable, and extensible language support

This architecture successfully eliminates language-specific conditionals from the core business logic while maintaining flexibility for language-specific requirements.
