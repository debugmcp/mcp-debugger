# tests/test-utils/mocks/
@generated: 2026-02-10T21:26:25Z

## Test Mocks Directory

**Overall Purpose**: Comprehensive mock implementations of external dependencies and system interfaces for the debugmcp test suite. Provides controlled, deterministic testing environment by replacing real external services, system calls, and I/O operations with configurable mock implementations.

## Key Component Categories

### System & Process Mocking
- **child-process.ts**: Mock Node.js child_process module with full process lifecycle simulation (spawn, exec, fork) and specialized configurations for Python/proxy processes
- **net.ts**: Mock TCP server implementation for network operation testing without actual port binding
- **fs-extra.ts**: Mock filesystem operations preventing actual file system interactions during tests

### Debug Adapter Protocol (DAP) Mocking
- **dap-client.ts**: Complete DAP client mock with event simulation, request/response handling, and error injection capabilities
- **mock-proxy-manager.ts**: Full ProxyManager implementation mock with DAP command simulation, event emission, and configurable failure modes
- **mock-adapter-registry.ts**: Debug adapter registry mocks with pre-configured language support and error scenario simulation

### Utility & Environment Mocking
- **environment.ts**: Environment variable mocking specifically for container path utilities testing
- **mock-command-finder.ts**: Command resolution mock for testing executable discovery without filesystem lookups
- **mock-logger.ts**: Logger implementations with both silent and spy variants for different testing needs

## Public API Surface

### Primary Mock Factories
- `createMockAdapterRegistry()` - Creates fully functional adapter registry mock
- `createMockLogger()` / `createSpyLogger()` - Logger mock variants for different test scenarios
- `createEnvironmentMock()` - Environment variable mock factory
- `MockProxyManager` - Complete proxy manager simulation
- `mockDapClient` - Singleton DAP client mock instance

### System Mock Exports
- `childProcessMock` - Central orchestrator for process spawning mocks
- `netMock` - TCP server mock for network testing
- `fsExtraMock` - Filesystem operation stubs

## Internal Organization & Data Flow

### Mock Lifecycle Pattern
1. **Creation**: Factory functions create mock instances with sensible defaults
2. **Configuration**: Test-specific behavior setup via setter methods
3. **Execution**: Mock methods track calls and return configured responses
4. **Reset**: Comprehensive cleanup methods for test isolation

### State Management Architecture
- **Call Tracking**: All mocks maintain call history for verification
- **Behavior Configuration**: Configurable responses, delays, and error conditions
- **Event Simulation**: EventEmitter-based mocks for asynchronous behavior testing
- **Reset Mechanisms**: Complete state cleanup for test isolation

## Key Design Patterns

### Test Double Strategies
- **Stub Pattern**: Simple return value mocking (fs-extra, net)
- **Spy Pattern**: Call tracking with optional real behavior (mock-logger)
- **Mock Pattern**: Full behavioral simulation (proxy-manager, dap-client)
- **Factory Pattern**: Consistent mock creation with customization options

### Asynchronous Simulation
- Uses `process.nextTick()` and setTimeout for realistic timing simulation
- Promise-based async operation mocking with configurable delays/failures
- Event-driven architecture simulation through EventEmitter inheritance

### Error Testing Support
- Configurable failure modes for testing error handling paths
- Exception injection capabilities for negative test scenarios
- Network and process failure simulation

## Integration Points

### Cross-Mock Dependencies
- Child process mocks integrate with proxy manager for IPC simulation
- DAP client and proxy manager mocks work together for end-to-end protocol testing
- Environment mocks support container path utilities across multiple test scenarios

### Test Framework Integration
- Full Vitest compatibility with `vi.fn()` mock system
- Module replacement support through default exports
- Comprehensive reset capabilities for test isolation

## Critical Testing Capabilities

- **End-to-End DAP Protocol Simulation**: Complete debugging session lifecycle testing
- **System Process Isolation**: Testing process spawning without actual system calls
- **Network Operation Mocking**: TCP server testing without port conflicts
- **Error Condition Simulation**: Comprehensive failure scenario coverage
- **Container Environment Testing**: Support for both host and container execution modes

The directory provides a complete testing infrastructure that isolates the debugmcp system from external dependencies while maintaining realistic behavior simulation for comprehensive test coverage.