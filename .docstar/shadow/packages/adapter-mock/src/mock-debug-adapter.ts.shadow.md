# packages/adapter-mock/src/mock-debug-adapter.ts
@source-hash: f95ff85dc8a61525
@generated: 2026-02-10T00:41:26Z

## Primary Purpose
Mock debug adapter implementation for testing without external dependencies. Provides a fully functional debug adapter that simulates DAP (Debug Adapter Protocol) operations with configurable behavior, error scenarios, and timing delays.

## Core Classes and Interfaces

### MockAdapterConfig (L34-52)
Configuration interface for mock adapter behavior:
- Timing configuration (delays for operations)
- Feature support configuration 
- Error simulation parameters
- Performance simulation flags

### MockErrorScenario (L57-65)
Enum defining testable error scenarios including executable not found, adapter crash, connection timeout, invalid breakpoints, and memory errors.

### MockDebugAdapter (L123-502)
Main implementation extending EventEmitter and implementing IDebugAdapter:
- **Constructor** (L138-158): Initializes with dependencies and applies default config values
- **State Management** (L193-220): Handles adapter state transitions with permissive validation
- **Lifecycle** (L162-189): Initialize/dispose methods with validation
- **Connection Management** (L383-415): Simulates connection/disconnection with configurable delays
- **DAP Protocol** (L345-379): Handles DAP requests/responses/events with proxy delegation
- **Configuration** (L270-341): Builds adapter commands and transforms launch configs

## Key Dependencies
- `@vscode/debugprotocol`: DAP types and interfaces
- `@debugmcp/shared`: Core adapter interfaces and types including IDebugAdapter, AdapterState, ValidationResult
- `events.EventEmitter`: Base class for event emission

## State Management Architecture
Uses VALID_TRANSITIONS map (L72-118) with permissive state validation allowing flexible transitions matching real adapter behavior. State transitions emit 'stateChanged' events.

## Notable Patterns
- **Proxy Pattern**: DAP operations delegate to ProxyManager rather than implementing protocol directly
- **Configuration Strategy**: Extensive configuration options allow testing various adapter behaviors
- **Error Simulation**: Configurable error scenarios for comprehensive testing
- **Event-driven**: Emits adapter lifecycle events (initialized, connected, disconnected, disposed)

## Critical Invariants
- State transitions must follow VALID_TRANSITIONS rules
- Connected flag synchronized with adapter state
- Current thread ID tracked from DAP stopped events
- Mock adapter reports language as DebugLanguage.MOCK

## Testing Features
- Configurable operation delays for timing tests
- Error probability and specific error scenarios
- Feature support can be enabled/disabled
- Performance simulation options (CPU/memory intensive)
- Built-in validation that can be configured to fail