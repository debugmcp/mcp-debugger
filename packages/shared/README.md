# @debugmcp/shared

Shared interfaces, types, and base classes for the [mcp-debugger](https://github.com/debugmcp/mcp-debugger) monorepo. This package defines the contracts that all language adapters and core components depend on.

## Installation

Within the monorepo, add as a workspace dependency:

```bash
pnpm add @debugmcp/shared@workspace:*
```

## Exports

Everything below is exported from the package root (`import { ... } from '@debugmcp/shared'`).

### Core Interfaces

| Export | Kind | Description |
|--------|------|-------------|
| `IDebugAdapter` | interface | Main contract for language debug adapters |
| `IAdapterFactory` | interface | Factory for creating adapter instances |
| `IAdapterRegistry` | interface | Registry for managing adapter factories |

### Debug Adapter Types

| Export | Kind | Description |
|--------|------|-------------|
| `AdapterState` | enum | Adapter lifecycle states |
| `AdapterConfig` | type | Configuration for an adapter instance |
| `AdapterCommand` | type | Launch/config command descriptor |
| `AdapterCapabilities` | type | DAP capability flags |
| `GenericLaunchConfig` | type | Base launch configuration |
| `LanguageSpecificLaunchConfig` | type | Language-specific launch config extensions |
| `DebugFeature` | enum | Enumeration of debug features |
| `FeatureRequirement` | type | Requirement descriptor for a debug feature |
| `ExceptionBreakpointFilter` | type | Exception breakpoint filter descriptor |
| `AdapterEvents` | type | Event signatures emitted by adapters |
| `ConfigMigration` | type | Config migration descriptor |

### Validation

| Export | Kind | Description |
|--------|------|-------------|
| `ValidationResult` | type | Result of adapter/environment validation |
| `ValidationError` | type | Validation error detail |
| `ValidationWarning` | type | Validation warning detail |
| `DependencyInfo` | type | Info about a required dependency |
| `FactoryValidationResult` | type | Result of factory validation |

### Adapter Registry

| Export | Kind | Description |
|--------|------|-------------|
| `AdapterDependencies` | type | Dependencies required by adapters |
| `AdapterMetadata` | type | Metadata about an adapter implementation |
| `AdapterInfo` | type | Public info about a registered adapter |
| `AdapterRegistryConfig` | type | Registry configuration options |
| `AdapterFactoryMap` | type | Map of language to factory |
| `ActiveAdapterMap` | type | Map of language to active adapter |
| `BaseAdapterFactory` | class | Abstract base for adapter factories |

### Dependency Injection

| Export | Kind | Description |
|--------|------|-------------|
| `IDependencies` | interface | Full dependency container |
| `PartialDependencies` | type | Partial dependency container for overrides |
| `IFileSystem` | interface | File system operations |
| `IChildProcess` | interface | Child process abstraction |
| `IProcessManager` | interface | Process management |
| `INetworkManager` | interface | Network operations |
| `IServer` | interface | Server abstraction |
| `ILogger` | interface | Logging interface |
| `IProxyManager` | interface | Debug proxy management |
| `IProxyManagerFactory` | interface | Factory for proxy managers |
| `IEnvironment` | interface | Environment information |
| `ILoggerFactory` | interface | Factory for loggers |
| `IChildProcessFactory` | interface | Factory for child processes |

### Process Abstractions

| Export | Kind | Description |
|--------|------|-------------|
| `IProcess` | interface | Generic process abstraction |
| `IProcessOptions` | type | Options for spawning a process |
| `IProxyProcessLauncher` | interface | Launcher for proxy processes |
| `IProxyProcess` | interface | Running proxy process handle |

### Adapter Policies

| Export | Kind | Description |
|--------|------|-------------|
| `AdapterPolicy` | interface | Language-specific adapter behavior contract |
| `ChildSessionStrategy` | type | Strategy for child debug sessions |
| `AdapterSpecificState` | type | Per-adapter custom state |
| `CommandHandling` | type | How the adapter handles launch commands |
| `DefaultAdapterPolicy` | class | Lightweight default/placeholder policy |
| `PythonAdapterPolicy` | class | Python/debugpy policy |
| `JsDebugAdapterPolicy` | class | JavaScript/js-debug policy |
| `RustAdapterPolicy` | class | Rust/CodeLLDB policy |
| `RustAdapterPolicyInterface` | type | Rust policy interface (for mocking) |
| `GoAdapterPolicy` | class | Go/Delve policy |
| `JavaAdapterPolicy` | class | Java/JDI bridge policy |
| `DotnetAdapterPolicy` | class | .NET/netcoredbg policy |
| `MockAdapterPolicy` | class | Mock adapter policy for testing |

### DAP Client Behavior

| Export | Kind | Description |
|--------|------|-------------|
| `DapClientBehavior` | interface | DAP client behavior configuration |
| `DapClientContext` | type | Context passed to DAP client callbacks |
| `ReverseRequestResult` | type | Result of a DAP reverse request |
| `ChildSessionConfig` | type | Configuration for DAP child sessions |
| `AdapterLaunchBarrier` | type | Coordination barrier for adapter launch |

### Models & Enums

| Export | Kind | Description |
|--------|------|-------------|
| `DebugLanguage` | enum | Supported languages (Python, JavaScript, Rust, Go, Java, Dotnet, Mock) |
| `SessionState` | enum | Session states (CREATED → READY → RUNNING ⇄ PAUSED → STOPPED) |
| `SessionLifecycleState` | enum | Coarse lifecycle (CREATED → ACTIVE → TERMINATED) |
| `ExecutionState` | enum | Fine-grained execution state |
| `ProcessIdentifierType` | enum | Process identifier types for attach mode |
| `SessionConfig` | type | Session creation configuration |
| `Breakpoint` | type | Breakpoint descriptor |
| `DebugSession` | type | Internal debug session representation |
| `DebugSessionInfo` | type | Public session information |
| `CustomLaunchRequestArguments` | type | Custom launch request args |
| `GenericAttachConfig` | type | Base attach configuration |
| `LanguageSpecificAttachConfig` | type | Language-specific attach config |
| `Variable` | type | Variable descriptor |
| `StackFrame` | type | Stack frame descriptor |
| `DebugLocation` | type | Source location (file + line) |

### Factories & Base Classes

| Export | Kind | Description |
|--------|------|-------------|
| `AdapterFactory` | class | Factory base class for adapter implementations |

### Error Classes

| Export | Kind | Description |
|--------|------|-------------|
| `AdapterError` | class | Base error for adapter operations |
| `AdapterErrorCode` | enum | Error codes for adapter errors |
| `AdapterNotFoundError` | class | Thrown when a requested adapter is not registered |
| `FactoryValidationError` | class | Thrown when factory validation fails |
| `DuplicateRegistrationError` | class | Thrown when registering a duplicate adapter |

### Type Guards & Utilities

| Export | Kind | Description |
|--------|------|-------------|
| `isAdapterFactory` | function | Type guard for `IAdapterFactory` |
| `isAdapterRegistry` | function | Type guard for `IAdapterRegistry` |
| `mapLegacyState` | function | Map `SessionState` → `SessionLifecycleState` + `ExecutionState` |
| `mapToLegacyState` | function | Map `SessionLifecycleState` + `ExecutionState` → `SessionState` |

### FileSystem Abstraction

| Export | Kind | Description |
|--------|------|-------------|
| `FileSystem` | interface | Minimal file system interface for DI |
| `NodeFileSystem` | class | Node.js `fs` implementation of `FileSystem` |
| `setDefaultFileSystem` | function | Set the global default `FileSystem` instance |
| `getDefaultFileSystem` | function | Get the global default `FileSystem` instance |

### Re-exports

| Export | Source | Description |
|--------|--------|-------------|
| `DebugProtocol` | `@vscode/debugprotocol` | VSCode Debug Adapter Protocol type namespace |

## Package Structure

```
src/
├── interfaces/     # Core contracts, adapter policies, DI interfaces
├── models/         # Enums, data structures, type aliases
└── factories/      # Base factory classes
```

## Contributing

When adding new shared types:

1. Place interfaces and policies in `src/interfaces/`
2. Place enums, data types, and type aliases in `src/models/`
3. Place base/factory classes in `src/factories/`
4. Export from `src/index.ts`
5. Add to the appropriate table in this README

## License

MIT
