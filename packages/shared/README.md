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
| `AdapterModes` | type | Per-mode capability declaration: `{ launch, attach }` |
| `AttachMechanism` | type | How an adapter implements attach: `'none'`, `'direct-connect'`, or `'spawn'` |
| `AdapterInfo` | type | Public info about a registered adapter |
| `AdapterManifestEntry` | type | One entry of `IAdapterRegistry.listAvailableAdapters()`: language name, package name, install state, attach mechanism |
| `FactoryLoadResult` | type | Outcome of a non-throwing factory load (`getFactoryResult`): the factory, the load error, or dynamic loading disabled |
| `AdapterRegistryConfig` | type | Registry configuration options |
| `AdapterFactoryMap` | type | Map of language to factory |
| `ActiveAdapterMap` | type | Map of language to active adapter |
| `BaseAdapterFactory` | class | Abstract base for adapter factories |

### Doctor Presentation (issue #435)

An adapter factory may implement the optional `IAdapterFactory.describeToolchain(validation, options?)` to own its `mcp-debugger doctor` runtime/backend row.

| Export | Kind | Description |
|--------|------|-------------|
| `ToolchainComponent` | type | One doctor table cell (label + optional path/version/source) |
| `ToolchainDescription` | type | An adapter's doctor row: `{ runtime?, backend? }` |
| `DescribeToolchainOptions` | type | Advisory options for `describeToolchain` (`timeoutMs`) |
| `toolchainComponent` | function | Build one cell, omitting it unless something was actually detected (`(`-prefixed labels stand alone) |
| `normalizeToolchainDescription` | function | Defensively normalize an untrusted `describeToolchain` return value |
| `probeWithinBudget` | function | Run one best-effort probe inside the advisory budget; settles with the value or `null` |

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
| `AdapterSpawnPayload` | type | Payload describing how to spawn the debug adapter |
| `AdapterSpawnConfig` | type | Resolved adapter spawn configuration |
| `LocalVariableExtraction` | interface | Result of `AdapterPolicy.extractLocalVariables`: the variables plus the `variablesReference` of every anchor-frame scope that contributed one |
| `HandshakeProxy` | interface | Structural slice of the session's proxy manager a handshake may use (send a DAP request, check liveness, subscribe to `dap-event`) |
| `HandshakeContext` | interface | Everything `AdapterPolicy.performHandshake` is given about the session |
| `QueuedDapCommand` | interface | The part of a queued DAP command `AdapterPolicy.processQueuedCommands` may reorder on |
| `resolveExceptionFilters` | function | Resolve an abstract break-on-exception mode to the policy's DAP exception filter IDs |
| `emptyLocalVariableExtraction` | function | Build the "no locals here" extraction — no variables, no scope refs, optional explanatory note |
| `extractionFromScope` | function | Build an extraction from a single scope; reports no scope ref when the variable list is empty |
| `DefaultAdapterPolicy` | const | Lightweight default/placeholder policy (singleton object) |
| `PythonAdapterPolicy` | const | Python/debugpy policy |
| `RubyAdapterPolicy` | const | Ruby/rdbg adapter policy |
| `JsDebugAdapterPolicy` | const | JavaScript/js-debug policy |
| `JS_SCOPE_KINDS` | const | The js-debug scope names each kind (`local`, `block`, `closure`, `module`) is recognized by |
| `RustAdapterPolicy` | const | Rust/CodeLLDB policy |
| `CppAdapterPolicy` | const | C/C++ / CodeLLDB policy |
| `GoAdapterPolicy` | const | Go/Delve policy |
| `JavaAdapterPolicy` | const | Java/JDI bridge policy |
| `DotnetAdapterPolicy` | const | .NET/netcoredbg policy |
| `MockAdapterPolicy` | const | Mock adapter policy for testing |
| `getPolicyForLanguage` | function | Dispatch: returns the `AdapterPolicy` for a given `DebugLanguage` |

The language policies are singleton object constants implementing the `AdapterPolicy` interface, not classes.

### DAP Client Behavior

| Export | Kind | Description |
|--------|------|-------------|
| `DapClientBehavior` | interface | DAP client behavior configuration |
| `DapClientContext` | type | Context passed to DAP client callbacks |
| `ReverseRequestResult` | type | Result of a DAP reverse request |
| `ChildSessionConfig` | type | Configuration for DAP child sessions |
| `AdapterLaunchBarrier` | interface | Coordination barrier for adapter launch |
| `NO_DEBUG_TARGET_MARKER` | const | Marker text carried by every "no child session to run against" error, so the tool layer can recognize it |
| `buildNoDebugTargetError` | function | Build that error message for a child-required command, distinguishing "never adopted" from "adopted but gone" |

### Models & Enums

| Export | Kind | Description |
|--------|------|-------------|
| `DebugLanguage` | enum | Supported languages (Python, Ruby, JavaScript, Rust, Cpp, Go, Java, Dotnet, Mock) |
| `SessionState` | enum | Session states (CREATED → READY → RUNNING ⇄ PAUSED → STOPPED) |
| `SessionLifecycleState` | enum | Coarse lifecycle (CREATED → ACTIVE → TERMINATED) |
| `ExecutionState` | enum | Fine-grained execution state |
| `ProcessIdentifierType` | enum | Process identifier types for attach mode |
| `SessionConfig` | type | Session creation configuration |
| `Breakpoint` | type | Breakpoint descriptor |
| `FunctionBreakpoint` | type | Function breakpoint descriptor |
| `DebugSession` | type | Internal debug session representation |
| `DebugSessionInfo` | type | Public session information |
| `SessionStopInfo` | type | Details about why a session stopped |
| `SessionStopExceptionInfo` | type | Exception details attached to a stop |
| `ExceptionBreakMode` | type | Abstract break-on-exception mode |
| `SessionOutputEntry` | type | One captured debuggee output entry |
| `SessionFailureDiagnostics` | type | Pointers that make an errored session's proxy failure actionable (proxy log path, MCP resource URI) |
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

### Logging-Safety Utilities

| Export | Kind | Description |
|--------|------|-------------|
| `sanitizeEnvForLogging` | function | Sanitize a child-process environment map before logging |
| `sanitizePayloadForLogging` | function | Sanitize an arbitrary payload before logging |
| `sanitizeStderr` | function | Sanitize a stderr chunk before it reaches logs or tool errors |
| `sanitizeStderrTail` | function | Sanitize the trailing tail of stderr output before it reaches logs or tool errors |

These helpers ensure unsanitized child-process output and environment data never reach logs or tool error responses.

### Secret Redaction

| Export | Kind | Description |
|--------|------|-------------|
| `SECRET_VALUE_RULES` | const | Rule table of labeled secret-value patterns |
| `SECRET_VALUE_ALTERNATION` | const | Combined alternation pattern derived from the rule table |
| `REDACTION_NOTICE` | const | Notice text appended when values were redacted |
| `redactSecretsInString` | function | Redact secret-shaped values in a string |
| `isSensitiveName` | function | Heuristic: does a variable name look secret-bearing? |
| `isTrivialValue` | function | Heuristic: is a value too trivial to redact? |
| `redactVariableValue` | function | Redact a single variable value by name/value heuristics |
| `redactSecretsDeep` | function | Recursively redact secrets in a nested structure |
| `buildRedactionNotice` | function | Build the notice text for a set of redaction hits |
| `SecretRule` | type | One entry of the secret rule table |
| `RedactionHit` | type | A single redaction occurrence |
| `RedactionResult` | type | Result of a redaction pass |

### Stream & Breakpoint Utilities

| Export | Kind | Description |
|--------|------|-------------|
| `LineBuffer` | class | Incremental newline splitter for streamed output (whole-line filtering) |
| `toSourceBreakpoint` | function | The single mapper from stored breakpoint fields to a DAP `SourceBreakpoint` |
| `BreakpointFields` | type | Input fields accepted by `toSourceBreakpoint` |
| `toFunctionBreakpoint` | function | The single mapper to a DAP `FunctionBreakpoint` |
| `FunctionBreakpointFields` | type | Input fields accepted by `toFunctionBreakpoint` |

### Process Markers

Argv marker constants shared by the code that tags child processes at spawn time and the startup reapers that recognize those tags in system-wide process scans.

| Export | Kind | Description |
|--------|------|-------------|
| `PROXY_BOOTSTRAP_MARKER` | const | Identity substring in the proxy worker's script-path argv token |
| `JS_DEBUG_ADAPTER_MARKER` | const | Identity substring in the js-debug DAP server's script-path argv token |
| `OWNER_PID_ARG_PREFIX` | const | Argv prefix recording the PID of the mcp-debugger server that owned the session |
| `SESSION_ID_ARG_PREFIX` | const | Argv prefix recording the session id |

## Package Structure

```
src/
├── interfaces/     # Core contracts, adapter policies, DI interfaces
├── models/         # Enums, data structures, type aliases
├── factories/      # Base factory classes
└── utils/          # Standalone helpers (sanitizers, redaction, buffers, mappers)
```

## Contributing

When adding new shared types:

1. Place interfaces and policies in `src/interfaces/`
2. Place enums, data types, and type aliases in `src/models/`
3. Place base/factory classes in `src/factories/`
4. Place standalone helper functions in `src/utils/`
5. Export from `src/index.ts`
6. Add to the appropriate table in this README

## License

MIT
