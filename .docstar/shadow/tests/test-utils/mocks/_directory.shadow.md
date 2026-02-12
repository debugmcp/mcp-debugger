# tests/test-utils/mocks/
@generated: 2026-02-11T23:47:46Z

## Test Mocking Infrastructure

**Overall Purpose**: Comprehensive test mocking ecosystem for the Debug MCP (Machine Control Protocol) system. Provides controlled, deterministic mock implementations of all external dependencies including Node.js modules, debug adapters, filesystem operations, and process management. Enables isolated unit testing by replacing real system interactions with predictable test doubles.

## Key Components & Integration

### Core System Mocks
- **child-process.ts**: Central process spawning mock with specialized Python/proxy configurations
- **net.ts**: Network operations mock for TCP server simulation
- **fs-extra.ts**: Filesystem operations mock with optimistic defaults
- **environment.ts**: Environment variable mocking with container-aware defaults

### Debug Adapter Protocol (DAP) Ecosystem
- **dap-client.ts**: DAP client communication mock with event simulation
- **mock-proxy-manager.ts**: Full proxy lifecycle management with DAP request handling
- **mock-adapter-registry.ts**: Debug adapter discovery and instantiation mocking

### Utilities & Support
- **mock-command-finder.ts**: Command resolution mock for testing tool discovery
- **mock-logger.ts**: Dual-mode logging (silent/observable) for test scenarios

## Public API Surface

### Primary Entry Points
- **Factory Functions**: `createMockAdapterRegistry()`, `createMockLogger()`, `createEnvironmentMock()` - Main mock creation interfaces
- **Singleton Instances**: `childProcessMock`, `mockDapClient` - Shared state managers for consistent test behavior
- **Module Defaults**: Each file exports vi.mock-compatible defaults for direct module replacement

### Reset & Cleanup Utilities
- **Global Reset Functions**: `resetMockDapClient()`, `resetAdapterRegistryMock()` - Test isolation helpers
- **Instance Methods**: All mocks provide `.reset()` methods for state cleanup between tests

## Internal Organization & Data Flow

### Mock Lifecycle Pattern
1. **Setup Phase**: Factory functions create configured mock instances
2. **Configuration Phase**: Specialized setup methods configure behavior for specific test scenarios
3. **Execution Phase**: Mocks simulate real system behavior with controlled responses
4. **Verification Phase**: Call tracking and event simulation enable test assertions
5. **Cleanup Phase**: Reset methods restore clean state for subsequent tests

### Event-Driven Architecture
Core mocks extend EventEmitter to simulate asynchronous system behavior:
- Process lifecycle events (spawn, exit, error)
- DAP protocol events (stopped, breakpoint, initialization)
- Network connection events (listening, close)

### State Management Strategy
- **Call Tracking**: All mocks record method invocations for verification
- **Response Configuration**: Pre-configurable return values and error conditions
- **Behavioral Flags**: Runtime switches for simulating failure modes and edge cases

## Important Patterns & Conventions

### Mock Design Principles
- **Realistic Defaults**: Mocks provide sensible default behavior mimicking successful operations
- **Configurable Failures**: All mocks support error simulation for negative testing
- **Deterministic Timing**: Async operations use `process.nextTick()` for predictable execution order
- **Type Safety**: Full TypeScript interface compliance with original modules

### Testing Conventions
- **Singleton Pattern**: Shared instances ensure consistent state across test suites
- **Factory Pattern**: Parameterized mock creation for scenario-specific testing
- **Fluent Configuration**: Method chaining for readable test setup
- **Immutable History**: Call tracking provides copies to prevent test interference

### Integration Points
The mocks form a cohesive ecosystem where:
- Child process mocks integrate with proxy manager for multi-process debugging scenarios
- DAP client and proxy manager mocks work together for end-to-end protocol testing
- Command finder and adapter registry mocks support tool discovery workflows
- Environment and filesystem mocks enable container/host mode testing

This infrastructure enables comprehensive testing of the Debug MCP system's complex interactions with external processes, network protocols, and filesystem operations while maintaining complete test isolation and deterministic behavior.