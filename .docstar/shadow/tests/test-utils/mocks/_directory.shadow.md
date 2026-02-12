# tests\test-utils\mocks/
@generated: 2026-02-12T21:01:02Z

## Test Mocks Module

**Overall Purpose**: Comprehensive test mocking infrastructure providing controlled test doubles for external dependencies, system interactions, and complex internal components. Enables deterministic unit testing by replacing unpredictable external systems (filesystem, network, child processes, debugger protocols) with configurable mock implementations.

## Architecture & Organization

This module follows a **mock-per-dependency** pattern where each file provides complete mock coverage for a specific external system or complex internal component:

- **System Process Mocking**: `child-process.ts` - Node.js child_process module
- **Network Mocking**: `net.ts` - TCP server operations  
- **Filesystem Mocking**: `fs-extra.ts` - File system operations
- **Environment Mocking**: `environment.ts` - Environment variable access
- **Debug Protocol Mocking**: `dap-client.ts`, `mock-proxy-manager.ts` - Debug Adapter Protocol
- **Component Mocking**: `mock-adapter-registry.ts`, `mock-command-finder.ts` - Internal service interfaces
- **Logging Mocking**: `mock-logger.ts` - Application logging

## Key Design Patterns

**State Management & Reset**: All mocks implement comprehensive reset functionality for test isolation, with call history tracking and configurable behavior modes.

**Event-Driven Simulation**: Complex mocks (`MockChildProcess`, `MockDapClient`, `MockProxyManager`) extend EventEmitter to simulate asynchronous, event-driven real-world behavior while maintaining test determinism.

**Factory Pattern**: Most modules export factory functions (`createMockAdapterRegistry`, `createMockLogger`, `createEnvironmentMock`) enabling test-specific configuration while maintaining consistent interfaces.

**Behavioral Configuration**: Mocks support multiple operational modes:
- **Success paths**: Default optimistic behavior for happy-path testing
- **Error injection**: Configurable failure modes via methods like `simulateError()`, `setupWithErrors()`
- **Custom responses**: Override mechanisms for specific test scenarios

## Public API Surface

### Entry Points by Category

**Process & System Mocking**:
- `childProcessMock` - Singleton for child process operations with specialized configurations (`setupPythonSpawnMock`, `setupProxySpawnMock`)
- `netMock` - Network server simulation
- `createEnvironmentMock()` - Environment variable access

**Debug Protocol Infrastructure**:
- `mockDapClient` - Debug Adapter Protocol client simulation
- `MockProxyManager` - Debug proxy lifecycle and communication
- `createMockAdapterRegistry()` - Debug adapter management with language support

**Utility & Service Mocking**:
- `MockCommandFinder` - Command resolution without filesystem
- `createMockLogger()` / `createSpyLogger()` - Logging with silent vs observable modes
- `fsExtraMock` - Filesystem operations

### Common Interface Pattern

Most mocks follow a consistent API pattern:
- **Creation**: Factory function or singleton instance
- **Configuration**: `setResponse()`, `mockRequest()`, setup methods
- **Simulation**: `simulate*()` methods for triggering events/errors
- **Verification**: Call history tracking and assertion helpers
- **Cleanup**: `reset()` methods for test isolation

## Data Flow & Integration

The mocks are designed to work together in integration testing scenarios:

1. **Debug Session Testing**: `mock-proxy-manager.ts` + `dap-client.ts` + `child-process.ts` simulate complete debug workflows
2. **Adapter Management**: `mock-adapter-registry.ts` + `mock-command-finder.ts` + `environment.ts` test adapter discovery and configuration
3. **System Integration**: All mocks can be combined to test end-to-end scenarios without external dependencies

## Critical Constraints & Considerations

- **Timing Simulation**: Uses `process.nextTick()` and timeouts for realistic async behavior while maintaining test determinism
- **Default Behaviors**: Most mocks have optimistic defaults (success paths) that may need explicit override for error testing
- **State Isolation**: Each mock maintains independent state but requires explicit reset between tests
- **Type Safety**: All mocks implement their corresponding real interfaces ensuring compile-time compatibility

This module serves as the foundation for the entire test suite, enabling fast, reliable, and comprehensive testing of the debug adapter system without dependencies on external processes, network connectivity, or filesystem state.