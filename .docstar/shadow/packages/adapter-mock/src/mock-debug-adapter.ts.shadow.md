# packages/adapter-mock/src/mock-debug-adapter.ts
@source-hash: f95ff85dc8a61525
@generated: 2026-02-09T18:14:39Z

## Mock Debug Adapter Implementation for Testing

**Primary Purpose**: Provides a fully functional mock debug adapter for testing the DebugMCP framework without external dependencies. Simulates debugging behavior with configurable delays, error scenarios, and feature support.

### Key Classes and Interfaces

- **MockDebugAdapter** (L123-502): Core implementation extending EventEmitter and implementing IDebugAdapter
  - Language: DebugLanguage.MOCK
  - State management with permissive transitions matching real adapters
  - Configurable timing, features, and error simulation
  - Full DAP (Debug Adapter Protocol) event/response handling

- **MockAdapterConfig** (L34-52): Configuration interface controlling adapter behavior
  - Timing delays (defaultDelay, connectionDelay, stepDelay)
  - Feature support specification via DebugFeature array
  - Error simulation controls (errorProbability, errorScenarios)
  - Performance simulation flags

- **MockErrorScenario** (L57-65): Enum defining testable error conditions
  - EXECUTABLE_NOT_FOUND, ADAPTER_CRASH, CONNECTION_TIMEOUT, etc.

### State Management

- **VALID_TRANSITIONS** (L72-118): Permissive state transition matrix allowing flexible state changes to match real adapter behavior
- **transitionTo()** (L207-220): Validates state transitions and emits stateChanged events
- Thread tracking via currentThreadId for debugging context

### Core Functionality

**Lifecycle Management** (L162-189):
- initialize(): Validates environment and transitions to READY
- dispose(): Cleanup and reset to UNINITIALIZED

**Connection Management** (L383-415):
- connect(): Simulates connection with configurable delay
- disconnect(): Resets connection state and thread context
- Handles CONNECTION_TIMEOUT error scenario

**DAP Protocol Integration** (L345-379):
- sendDapRequest(): Delegates to ProxyManager for actual communication
- handleDapEvent(): Updates state based on DAP events (stopped, continued, terminated)
- handleDapResponse(): No-op for mock implementation

**Feature Support** (L435-493):
- Configurable feature support via supportedFeatures array
- getCapabilities(): Returns comprehensive DAP capability matrix
- Default features: conditional/function breakpoints, variable operations

### Executable and Configuration Management

- **buildAdapterCommand()** (L270-313): Constructs command to launch mock-adapter-process.js
  - Uses import.meta.url for path resolution with Windows compatibility
  - Falls back to project root-relative path
- **transformLaunchConfig()** (L325-332): Converts generic to mock-specific launch config

### Dependencies and Integration

- Imports from @debugmcp/shared for all core interfaces and types
- Uses EventEmitter for event-driven architecture
- Integrates with AdapterDependencies (logger, etc.)
- Works with ProxyManager for actual DAP communication

### Testing and Simulation Features

- **Error Simulation**: Configurable error scenarios with probability-based random errors
- **Performance Simulation**: CPU/memory intensive operation flags
- **Timing Control**: Configurable delays for realistic testing
- **Feature Testing**: Selective feature enablement for capability testing

### Notable Patterns

- **Permissive State Machine**: Unlike strict state machines, allows flexible transitions to match real adapter behavior
- **Delegation Pattern**: Core DAP operations delegated to ProxyManager while maintaining state tracking
- **Configuration-Driven Behavior**: Extensive configuration options for test scenario control
- **Path Resolution Strategy**: Robust executable path resolution with multiple fallback strategies