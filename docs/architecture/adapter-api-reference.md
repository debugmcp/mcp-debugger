# Adapter API Reference

Status: v0.19.0
Audience: Adapter authors and maintainers  
Source of truth: `@debugmcp/shared` interfaces and current implementation in `src/adapters/*`

This reference documents the contracts an adapter must satisfy to be discovered, loaded, and used by the mcp-debugger core. It also includes the dynamic loader and registry APIs that interact with adapters.

Contents
- IDebugAdapter (required for all adapters)
- AdapterFactory (base class for factories)
- AdapterLoader (dynamic runtime loader)
- AdapterRegistry (runtime registry and lifecycle management)
- Error types and diagnostics
- Environment variables

## IDebugAdapter

File: `packages/shared/src/interfaces/debug-adapter.ts`

Adapters must implement `IDebugAdapter`. This is an async-first, event-driven interface that abstracts DAP operations while remaining language-agnostic.

Key properties
- language: `DebugLanguage` — The language identifier (e.g., `'python'`, `'mock'`)
- name: `string` — Human-friendly adapter name

Lifecycle
- `initialize(): Promise<void>` — Prepare resources and validate environment
- `disconnect(): Promise<void>` — Disconnect from the debug adapter (closes the DAP connection but does not fully tear down the adapter)
- `dispose(): Promise<void>` — Full cleanup: releases all resources, resets state to UNINITIALIZED, and emits a `'disposed'` event. This is distinct from `disconnect()`, which only closes the connection.

State
- `getState(): AdapterState` — Current adapter state (see enum)
- `isReady(): boolean` — Whether adapter is ready for debugging
- `getCurrentThreadId(): number | null` — Active thread (if any)

Environment validation
- `validateEnvironment(): Promise<ValidationResult>` — Check runtime prerequisites
- `getRequiredDependencies(): DependencyInfo[]` — Declare dependencies (name/version/required)

Executable management
- `resolveExecutablePath(preferredPath?: string): Promise<string>` — Resolve language runtime path
- `getDefaultExecutableName(): string` — e.g., `'python'`, `'node'`, `'go'`
- `getExecutableSearchPaths(): string[]` — Platform-specific search locations

Adapter configuration (DAP adapter process)
- `buildAdapterCommand(config: AdapterConfig): AdapterCommand` — Command/args/env for launching the DAP adapter process
- `getAdapterModuleName(): string` — e.g., `'debugpy.adapter'`
- `getAdapterInstallCommand(): string` — e.g., `'pip install debugpy'`

Launch coordination (optional)
- `createLaunchBarrier?(command: string, args?: unknown): AdapterLaunchBarrier | undefined`
  - Allows an adapter to supply a coordination object when a particular DAP request (for example, `'launch'`) needs custom handling.
  - When present, `ProxyManager` forwards proxy status messages, DAP events, and exit notifications to the barrier instead of hard-coding language logic.
  - Typical use: js-debug’s launch flow resolves when a `stopped` event or `adapter_connected` status arrives; the adapter signals readiness via the barrier without forcing `ProxyManager` to know about JavaScript specifics.

Attach support (optional)
- `supportsAttach?(): boolean` — Whether the adapter supports attaching to running processes
- `supportsDetach?(): boolean` — Whether the adapter supports detaching without terminating the debuggee
- `transformAttachConfig?(config: GenericAttachConfig): LanguageSpecificAttachConfig` — Transforms generic attach config to language-specific format
- `getDefaultAttachConfig?(): Partial<GenericAttachConfig>` — Gets default attach configuration for this language

Debug configuration
- `transformLaunchConfig(config: GenericLaunchConfig): Promise<LanguageSpecificLaunchConfig>` (async to permit build/compilation steps before launch)
- `getDefaultLaunchConfig(): Partial<GenericLaunchConfig>`
 
### AdapterLaunchBarrier helper

File: `packages/shared/src/interfaces/adapter-launch-barrier.ts`

Adapters that implement `createLaunchBarrier` should return an object with the following responsibilities:
- `awaitResponse: boolean` — If `false`, `ProxyManager` does NOT await the DAP response; the request resolves once `waitUntilReady()` completes (fire-and-forget launches). If `true`, `ProxyManager` awaits both the DAP response AND `waitUntilReady()`, then disposes the barrier.
- `onRequestSent(requestId)` — Observe when the request leaves `ProxyManager`.
- `onProxyStatus(status, message)` / `onDapEvent(event, body)` — Receive raw proxy messages to determine readiness.
- `onProxyExit(code, signal)` — Fail fast if the proxy exits unexpectedly.
- `waitUntilReady()` — Resolve when launch coordination is complete; reject to bubble an error.
- `dispose()` — Clean up timers or listeners when the barrier is cleared.

If `createLaunchBarrier` returns `undefined`, ProxyManager falls back to the default behavior (awaiting the DAP response).

DAP protocol operations
- `sendDapRequest<T extends DebugProtocol.Response>(command: string, args?: unknown): Promise<T>`
- `handleDapEvent(event: DebugProtocol.Event): void`
- `handleDapResponse(response: DebugProtocol.Response): void`

Connection management
- `connect(host: string, port: number): Promise<void>`
- `disconnect(): Promise<void>`
- `isConnected(): boolean`

Error handling helpers
- `getInstallationInstructions(): string`
- `getMissingExecutableError(): string`
- `translateErrorMessage(error: Error): string`

Capabilities and features
- `supportsFeature(feature: DebugFeature): boolean`
- `getFeatureRequirements(feature: DebugFeature): FeatureRequirement[]`
- `getCapabilities(): AdapterCapabilities` — Mirrors DAP capabilities

Supporting types (selected)
- `AdapterState`: `UNINITIALIZED | INITIALIZING | READY | CONNECTED | DEBUGGING | DISCONNECTED | ERROR`
- `ValidationResult`: `{ valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[] }`
- `AdapterCommand`: `{ command: string; args: string[]; env?: Record<string,string> }`
- `AdapterConfig`: `{ sessionId, executablePath, adapterHost, adapterPort, logDir, scriptPath, scriptArgs?, launchConfig }`
- `GenericLaunchConfig`: `{ stopOnEntry?, justMyCode?, env?, cwd?, args? }`

Events
- DAP events: `'stopped' | 'continued' | 'terminated' | 'exited' | 'thread' | 'output' | 'breakpoint' | 'module'`
- Lifecycle: `'initialized' | 'connected' | 'disconnected' | 'disposed' | 'error'` (note: `'error'` carries an `Error` payload; `'disposed'` is emitted by `dispose()` after full cleanup)
- State changes: `'stateChanged'` with `(oldState, newState)`

Example (minimal)
```typescript
import { EventEmitter } from 'events';
import type { IDebugAdapter, AdapterState, DebugFeature, AdapterCapabilities } from '@debugmcp/shared';

export class ExampleAdapter extends EventEmitter implements IDebugAdapter {
  readonly language = 'example' as any;
  readonly name = 'Example Debug Adapter';
  private state: AdapterState = AdapterState.UNINITIALIZED;

  async initialize() { this.state = AdapterState.READY; this.emit('initialized'); }
  async dispose() { this.state = AdapterState.UNINITIALIZED; this.emit('disposed'); }
  getState() { return this.state; }
  isReady() { return this.state === AdapterState.READY || this.state === AdapterState.DEBUGGING; }
  getCurrentThreadId() { return null; }

  async validateEnvironment() { return { valid: true, errors: [], warnings: [] }; }
  getRequiredDependencies() { return []; }

  async resolveExecutablePath(preferred?: string) { return preferred ?? 'example'; }
  getDefaultExecutableName() { return 'example'; }
  getExecutableSearchPaths() { return []; }

  buildAdapterCommand(config) { return { command: 'example', args: ['--port', String(config.adapterPort)], env: process.env as any }; }
  getAdapterModuleName() { return 'example.adapter'; }
  getAdapterInstallCommand() { return 'npm install -g example-adapter'; }

  async transformLaunchConfig(cfg) { return cfg; }
  getDefaultLaunchConfig() { return { stopOnEntry: true }; }

  async sendDapRequest(command, args) { throw new Error('not implemented'); }
  handleDapEvent(_e) { /* map events to state; emit as needed */ }
  handleDapResponse(_r) { /* optional */ }

  async connect(_h, _p) { this.state = AdapterState.CONNECTED; this.emit('connected'); }
  async disconnect() { this.state = AdapterState.DISCONNECTED; this.emit('disconnected'); }
  isConnected() { return this.state === AdapterState.CONNECTED || this.state === AdapterState.DEBUGGING; }

  getInstallationInstructions() { return 'Install example-adapter per your OS instructions.'; }
  getMissingExecutableError() { return 'Example executable not found'; }
  translateErrorMessage(err: Error) { return err.message; }

  supportsFeature(_f: DebugFeature) { return false; }
  getFeatureRequirements(_f: DebugFeature) { return []; }
  getCapabilities(): AdapterCapabilities { return { supportsConfigurationDoneRequest: true }; }
}
```

## AdapterFactory (IAdapterFactory Interface)

File: `packages/shared/src/factories/adapter-factory.ts` (base class), `packages/shared/src/interfaces/adapter-registry.ts` (interface)

Factories create adapter instances and expose metadata. The core contract is the `IAdapterFactory` interface. Most adapters implement this interface by extending the `AdapterFactory` base class, but extending it is not strictly required -- implementing `IAdapterFactory` directly is also valid.

Key API
- `constructor(metadata: AdapterMetadata)` — Provide name, description, version constraints, etc.
- `getMetadata(): AdapterMetadata` — Retrieve factory metadata
- `validate(): Promise<FactoryValidationResult>` — Override to ensure the environment supports creating adapters
- `isCompatibleWithCore(coreVersion: string): boolean` — Optional version gating
- `createAdapter(dependencies: AdapterDependencies): IDebugAdapter` — REQUIRED

Example factory
```typescript
import { AdapterFactory } from '@debugmcp/shared';
import type { AdapterDependencies, IDebugAdapter } from '@debugmcp/shared';
import { ExampleAdapter } from './ExampleAdapter';

export class ExampleAdapterFactory extends AdapterFactory {
  constructor() {
    super({
      language: 'example',
      displayName: 'Example',
      version: '0.1.0',
      author: 'mcp-debugger team',
      description: 'Example adapter',
      minimumDebuggerVersion: '0.14.0',
    });
  }

  async validate() {
    // Optionally check environment prerequisites
    return { valid: true, errors: [], warnings: [] };
  }

  createAdapter(deps: AdapterDependencies): IDebugAdapter {
    return new ExampleAdapter(/* deps as needed */);
  }
}
```

Export convention (required for dynamic loader)
- Package name: `@debugmcp/adapter-<language>`
- The loader requires a **named export** matching `<CapitalizedLanguage>AdapterFactory` (e.g., `python` -> `PythonAdapterFactory`, `javascript` -> `JavascriptAdapterFactory`). It instantiates this class with a zero-arg constructor.
- Some adapter packages also expose a default export for plugin-style loading (e.g., `adapter-go` and `adapter-java` export `{ name, factory }` as default). The dynamic loader does not use the default export, but it may be useful for custom integration scenarios.
```typescript
export { ExampleAdapterFactory } from './ExampleAdapterFactory.js';
```

## AdapterLoader

File: `src/adapters/adapter-loader.ts`

Purpose: Discover and dynamically import an adapter package by language at runtime.

Public methods
- `loadAdapter(language: string): Promise<IAdapterFactory>`
  - Attempts `import('@debugmcp/adapter-<language>')`
  - Falls back to URLs relative to the loader's own module location (using `import.meta.url`):
    - `../../node_modules/@debugmcp/adapter-<language>/dist/index.js`
    - `../../packages/adapter-<language>/dist/index.js`
  - Also attempts `createRequire` + `fileURLToPath` fallback
  - Extracts `<Language>AdapterFactory` named export, instantiates it, caches it
  - Throws with informative message on `MODULE_NOT_FOUND` or missing factory
- `isAdapterAvailable(language: string): Promise<boolean>`
  - Returns true if `loadAdapter` succeeds (and caches)
- `listAvailableAdapters(): Promise<Array<{ name, packageName, description?, installed }>>`
  - Currently uses a known adapter list and checks availability
  - Returns install status for each known adapter

Notes
- Internal cache keyed by `language` to avoid repeated imports
- Logs helpful diagnostics on failures (including suggested npm install)

## AdapterRegistry

File: `src/adapters/adapter-registry.ts`

Purpose: Manage adapter factories and active adapter instances; optionally lazy-load adapters on demand.

Key runtime behavior
- Constructor accepts config; dynamic loading enabled in containers by default:
  - `enableDynamicLoading?: boolean` OR `process.env.MCP_CONTAINER === 'true'`
- `register(language, factory)` with optional validation and override rules
- `unregister(language)` disposes active adapters, removes timers, unregisters factory
- `create(language, config): Promise<IDebugAdapter>`
  - If factory missing and dynamic enabled → `AdapterLoader.loadAdapter`
  - Validates instance count against `maxInstancesPerLanguage`
  - Creates dependencies and adapter, calls `initialize()`, tracks active instance
  - Sets up auto-dispose based on adapter state changes
- Introspection
  - `getSupportedLanguages(): string[]` — currently registered factories (part of the `IAdapterRegistry` interface)
  - `listLanguages(): Promise<string[]>` — returns registered languages plus the hardcoded known-adapter catalog when dynamic loading is enabled (concrete implementation method)
  - `listAvailableAdapters(): Promise<AdapterMetadata[]>` — merges loader metadata with registered languages, marking registered languages as installed (concrete implementation method)
  - `getAdapterInfo(language)` / `getAllAdapterInfo()`
- Lifecycle
  - `disposeAll()` — disposes all adapters and clears registry

Auto-dispose
- Registry subscribes to adapter `'stateChanged'` events
- Starts a timer when state becomes `'disconnected'` or `'error'`
- Cancels timer if adapter becomes `'connected'` or `'debugging'` again

## Error Types and Diagnostics

From `@debugmcp/shared` (selected)
- `AdapterError` with `AdapterErrorCode` enum:
  - Environment: `ENVIRONMENT_INVALID`, `EXECUTABLE_NOT_FOUND`, `ADAPTER_NOT_INSTALLED`, `INCOMPATIBLE_VERSION`
  - Connection: `CONNECTION_FAILED`, `CONNECTION_TIMEOUT`, `CONNECTION_LOST`
  - Protocol: `INVALID_RESPONSE`, `UNSUPPORTED_OPERATION`
  - Runtime: `DEBUGGER_ERROR`, `SCRIPT_NOT_FOUND`, `PERMISSION_DENIED`
  - Generic: `UNKNOWN_ERROR`

Dynamic loader error messages
- Missing package:
  - `Failed to load adapter for 'python' from package '@debugmcp/adapter-python'. Adapter not installed. Install with: npm install @debugmcp/adapter-python`
- Missing factory:
  - `Factory class PythonAdapterFactory not found in @debugmcp/adapter-python`

Troubleshooting checklist
- `npm ls @debugmcp/adapter-*` to verify installation
- Confirm named export of `<Lang>AdapterFactory` class
- Check container runtime deps (e.g., `which` + `isexe` if used)
- For stdio transport, ensure stdout is NDJSON-only; use provided preloader
- Increase logging (server debug; `DEBUG=mcp:*` in clients if supported)
- Use `scripts/diagnose-stdio-client.mjs` to verify connect → list → create → close

## Environment Variables

- `MCP_CONTAINER=true`
  - Enables dynamic loading by default in the registry
  - Container-friendly behavior and logging locations
- `CONSOLE_OUTPUT_SILENCED=1` (set internally for transport runs that must suppress console output)
  - Ensures stdio silencer/mirroring is active in container entrypoint
- Standard logging envs or CLI flags (see README and docs)

## Minimal Adapter Package Template

Files
```
packages/adapter-example/
  package.json
  src/ExampleAdapter.ts
  src/ExampleAdapterFactory.ts
  src/index.ts
  tsconfig.json
```

Entry export (`src/index.ts`)
```typescript
// Named export required by the dynamic loader
export { ExampleAdapterFactory } from './ExampleAdapterFactory.js';
```

Installation and discovery
- Build your adapter to `dist/`
- Install as a dependency alongside `@debugmcp/mcp-debugger`
- The loader will find it via `import('@debugmcp/adapter-example')` or monorepo fallback paths
