# tests\test-utils\mocks/
@children-hash: 4a4b725adc9d113b
@generated: 2026-02-15T09:01:28Z

## Test Mock Utilities Directory

**Primary Purpose**: Centralized collection of comprehensive mock implementations for external dependencies and system interfaces used throughout the MCP Debug test suites. Enables isolated, deterministic testing by replacing real system calls, network operations, file system access, and external processes with controllable test doubles.

## Core Architecture

This directory provides a complete mocking ecosystem with three primary categories of utilities:

### System & Process Mocking
- **child-process.ts**: Complete Node.js child_process module replacement with `MockChildProcess` class and specialized configurations for Python/proxy process simulation
- **net.ts**: TCP server mocking for network operation testing without actual port binding
- **fs-extra.ts**: File system operation stubs that avoid real file I/O during tests

### Debug Adapter Protocol (DAP) Infrastructure
- **dap-client.ts**: Mock DAP client with event simulation, request/response pattern testing, and error injection capabilities
- **mock-proxy-manager.ts**: Comprehensive proxy manager mock with lifecycle management, event emission, and DAP command simulation
- **mock-adapter-registry.ts**: Debug adapter registry mocking with configurable language support and error scenarios

### Utility & Environment Mocking
- **environment.ts**: Environment variable mocking specifically for container path utilities testing
- **mock-command-finder.ts**: Command resolution mocking with configurable responses and call history tracking
- **mock-logger.ts**: Logger implementations supporting both silent testing and observable debugging modes

## Key Integration Patterns

**Singleton Pattern**: Several mocks export singleton instances (`childProcessMock`, `mockDapClient`) for consistent state across test suites.

**Factory Pattern**: Mock creation functions with customizable behavior (`createMockAdapterRegistry()`, `createEnvironmentMock()`) enable test-specific configurations.

**Event-Driven Architecture**: Mocks extensively use EventEmitter patterns to simulate asynchronous system behavior with deterministic timing using `process.nextTick()`.

**Test Lifecycle Management**: All mocks provide `reset()` methods for test isolation and state cleanup between test cases.

## Public API Surface

### Main Entry Points
- **Process Management**: `childProcessMock` singleton with specialized setup methods for Python and proxy scenarios
- **DAP Testing**: `mockDapClient` for client-side testing, `MockProxyManager` for server-side proxy simulation
- **Adapter Testing**: `createMockAdapterRegistry()` family for adapter lifecycle and error condition testing
- **System Utilities**: `createMockLogger()`, `createEnvironmentMock()`, `MockCommandFinder` for infrastructure mocking

### Helper Functions
- Reset utilities: `resetMockDapClient()`, `resetAdapterRegistryMock()`
- Assertion helpers: `expectAdapterRegistryLanguageCheck()`, `expectAdapterCreation()`
- Test configuration: Specialized setup methods for Python version checking, proxy spawning, and adapter error simulation

## Internal Organization

**Layered Abstraction**: Mocks range from low-level system interfaces (net, fs-extra) to high-level application services (adapter registry, proxy manager).

**Behavioral Configuration**: Most mocks support both default "happy path" behavior and error injection for comprehensive test coverage.

**Call Tracking**: Systematic use of Vitest mocks (`vi.fn()`) enables verification of method calls, parameters, and interaction patterns.

## Dependencies

- **vitest**: Core testing framework providing mock function utilities
- **events.EventEmitter**: Base class for event-driven mock implementations
- **@debugmcp/shared**: Interface definitions for adapter and protocol types
- **@vscode/debugprotocol**: DAP type definitions for realistic protocol simulation

This mock ecosystem enables comprehensive testing of the MCP Debug system without external dependencies, ensuring tests are fast, reliable, and isolated from system state.