# tests\test-utils\mocks/
@generated: 2026-02-12T21:05:49Z

## Test Mocks Directory

**Primary Purpose**: Comprehensive mock implementations for external dependencies and system interactions used throughout the debug adapter test suite. Provides controllable, deterministic test doubles that eliminate external dependencies while enabling thorough testing of all system components.

## Key Components & Organization

### Process & System Mocks
- **child-process.ts**: Complete Node.js child_process module mock with `MockChildProcess` class and specialized configurations for Python/proxy process testing
- **environment.ts**: Environment variable mocking focused on container path utilities testing
- **fs-extra.ts**: Filesystem operation mocks for directory and file existence checks
- **net.ts**: TCP server mocking for network operation testing

### Debug Adapter Protocol (DAP) Mocks
- **dap-client.ts**: `MockDapClient` for simulating DAP communication patterns, event handling, and error scenarios
- **mock-proxy-manager.ts**: `MockProxyManager` implementing full proxy lifecycle with DAP request/response simulation
- **mock-adapter-registry.ts**: Mock adapter registry with configurable language support and error conditions

### Utility Mocks
- **mock-command-finder.ts**: `MockCommandFinder` for testing command resolution without filesystem access
- **mock-logger.ts**: Logger implementations for both silent testing and debug-visible testing

## Public API Surface

### Primary Entry Points
- **Singleton Instances**: Most mocks export singleton instances for consistency across tests
  - `childProcessMock` - central orchestrator for process mocking
  - `mockDapClient` - shared DAP client instance
  - `fsExtraMock` - filesystem operation stubs

### Factory Functions
- `createMockAdapterRegistry()` - configurable adapter registry with language support
- `createEnvironmentMock(overrides?)` - customizable environment variable mocking
- `createMockLogger(logLevel?)` / `createSpyLogger()` - logger variants for different test needs

### Mock Configuration APIs
- Fluent configuration methods (e.g., `setupPythonSpawnMock`, `setResponse`, `mockRequest`)
- State management utilities (`reset()`, `clearHistory()`, `simulateEvent()`)
- Error injection capabilities for negative testing scenarios

## Internal Organization & Data Flow

### Layered Architecture
1. **System Level**: Process, network, and filesystem mocks form the foundation
2. **Protocol Level**: DAP client and proxy manager handle debug protocol simulation  
3. **Application Level**: Adapter registry and command finder mock application-specific logic
4. **Utility Level**: Logging and environment mocks support cross-cutting concerns

### State Management Patterns
- **Call Tracking**: Most mocks record method invocations for test verification
- **Behavior Control**: Configurable success/failure modes and timing simulation
- **Event Simulation**: EventEmitter-based mocks for testing event-driven scenarios
- **Reset Capabilities**: Comprehensive cleanup methods for test isolation

## Important Patterns & Conventions

### Mock Design Principles
- **Realistic Defaults**: Mocks provide sensible default behaviors that succeed in normal cases
- **Configurable Failures**: Error injection capabilities for testing edge cases and error handling
- **Deterministic Timing**: Uses `process.nextTick()` and fixed timeouts for predictable async behavior
- **Interface Compliance**: Full implementation of target interfaces with proper TypeScript typing

### Test Integration Patterns
- **Vitest Integration**: Extensive use of `vi.fn()` for function mocking and call tracking
- **Singleton Management**: Shared instances across test suites with proper reset capabilities
- **Factory Pattern**: Configurable mock creation for test-specific scenarios
- **Event-Driven Testing**: Support for both synchronous method testing and asynchronous event scenarios

### Cross-Component Coordination
- Process mocks coordinate with proxy manager for end-to-end debugging simulation
- DAP client and proxy manager work together for protocol testing
- Environment and filesystem mocks support container/host path resolution testing
- Logger mocks integrate with all components for debugging test scenarios

This mock ecosystem enables comprehensive testing of the debug adapter system while maintaining complete isolation from external dependencies and providing deterministic, controllable test conditions.