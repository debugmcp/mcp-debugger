# Adapter API Reference

Status: v0.15.0  
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
- `dispose(): Promise<void>` — Cleanup resources and connections

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

Debug configuration
- `transformLaunchConfig(config: GenericLaunchConfig): LanguageSpecificLaunchConfig`
- `getDefaultLaunchConfig(): Partial<GenericLaunchConfig>`

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
- Lifecycle: `'initialized' | 'connected' | 'disconnected' | 'error'`
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
  async dispose() { this.state = AdapterState.DISCONNECTED; this.emit('disconnected'); }
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

  transformLaunchConfig(cfg) { return cfg; }
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

## AdapterFactory (Base)

File: `packages/shared/src/factories/adapter-factory.ts`

Factories create adapter instances and expose metadata. They should extend `AdapterFactory` and implement `createAdapter`.

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
      name: 'example',
      displayName: 'Example',
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
- Default export structure (from adapter package entry):
```typescript
export { ExampleAdapterFactory } from './ExampleAdapterFactory.js';
export default { name: 'example', factory: ExampleAdapterFactory };
```
- The loader expects a named class `<CapitalizedLanguage>AdapterFactory`

## AdapterLoader

File: `src/adapters/adapter-loader.ts`

Purpose: Discover and dynamically import an adapter package by language at runtime.

Public methods
- `loadAdapter(language: string): Promise<IAdapterFactory>`
  - Attempts `import('@debugmcp/adapter-<language>')`
  - Falls back to URLs relative to the runtime bundle:
    - `../node_modules/@debugmcp/adapter-<language>/dist/index.js`
    - `../packages/adapter-<language>/dist/index.js`
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
  - `getSupportedLanguages(): string[]` — currently registered factories
  - `listLanguages(): Promise<string[]>` — installed languages via loader
  - `listAvailableAdapters(): Promise<AdapterMetadata[]>` — installed metadata via loader
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
- Confirm export structure `{ name: '<lang>', factory: <Lang>AdapterFactory }`
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
export { ExampleAdapterFactory } from './ExampleAdapterFactory.js';
export default { name: 'example', factory: ExampleAdapterFactory };
```

Installation and discovery
- Build your adapter to `dist/`
- Install as a dependency alongside `@debugmcp/mcp-debugger`
- The loader will find it via `import('@debugmcp/adapter-example')` or monorepo fallback paths
