# packages\adapter-mock\src\mock-debug-adapter.ts
@source-hash: 2ac6c9b538db1264
@generated: 2026-02-15T09:01:05Z

Mock debug adapter implementation for testing debug protocols without external dependencies. Provides a fully functional DAP (Debug Adapter Protocol) adapter that simulates real debugging behavior.

## Primary Purpose
Simulates debugging operations for testing and development, implementing the IDebugAdapter interface with configurable behavior, error injection, and state management that mirrors real adapters.

## Key Components

### MockDebugAdapter Class (L124-516)
Main adapter implementation extending EventEmitter and implementing IDebugAdapter. Manages adapter lifecycle, state transitions, and DAP protocol operations.

**Core Properties:**
- `state` (L128): Current adapter state using AdapterState enum
- `config` (L129): Configuration object with timing, behavior, and error simulation settings
- `currentThreadId` (L133): Active debug thread identifier
- `connected` (L134): Connection status flag

### Configuration Interfaces

**MockAdapterConfig (L35-53)**
- Timing configuration: delays for operations, connections, stepping
- Behavior configuration: supported features, variable depth limits
- Error simulation: probability settings and scenario selection
- Performance simulation: CPU/memory intensive operation flags

**MockErrorScenario (L58-66)**
Enum defining testable error conditions: executable not found, adapter crash, connection timeout, invalid breakpoints, script errors, memory issues.

### State Management

**VALID_TRANSITIONS (L73-119)**
Permissive state transition matrix allowing flexible state changes to match real adapter behavior. Supports transitions between UNINITIALIZED, INITIALIZING, READY, CONNECTED, DEBUGGING, DISCONNECTED, and ERROR states.

**transitionTo() (L208-221)**
Validates and executes state transitions, emitting stateChanged events.

## Key Methods

### Lifecycle Management
- `initialize()` (L163-183): Validates environment and transitions to READY state
- `dispose()` (L185-190): Cleanup and state reset
- `getState()` (L194-196): Current state accessor
- `isReady()` (L198-202): Multi-state readiness check

### Environment & Dependencies
- `validateEnvironment()` (L225-244): Mock validation with error scenario support
- `getRequiredDependencies()` (L246-248): Returns empty array (no external deps)
- `resolveExecutablePath()` (L253-259): Uses Node.js process path as mock executable

### Adapter Configuration
- `buildAdapterCommand()` (L271-326): Complex path resolution for mock adapter process, handles bundled vs development scenarios
- `transformLaunchConfig()` (L338-345): Converts generic to mock-specific launch config
- `getDefaultLaunchConfig()` (L347-354): Provides sensible defaults

### DAP Protocol Operations
- `sendDapRequest()` (L358-369): Stub for ProxyManager delegation
- `handleDapEvent()` (L371-387): Updates thread ID and state based on DAP events
- `connect()` (L396-417): Simulates connection with configurable delays and error injection
- `disconnect()` (L419-424): Connection cleanup and state transition

### Feature Support
- `supportsFeature()` (L449-451): Checks configured feature support
- `getCapabilities()` (L467-506): Returns comprehensive DAP capabilities object
- `setErrorScenario()` (L513-515): Test utility for error injection

## Dependencies
- Uses @vscode/debugprotocol for DAP types
- Imports comprehensive types from @debugmcp/shared
- Leverages Node.js fs, path, and events modules

## Architectural Patterns
- Event-driven architecture with EventEmitter inheritance
- State machine with validation for debugging lifecycle
- Dependency injection pattern for logger and other services
- Configuration-driven behavior modification for testing scenarios
- Proxy pattern delegation for actual DAP communication

## Critical Invariants
- State transitions must follow VALID_TRANSITIONS matrix
- Thread ID management synchronized with DAP events
- Connection state consistency between `connected` flag and adapter state
- Error scenarios override normal operation flow when active