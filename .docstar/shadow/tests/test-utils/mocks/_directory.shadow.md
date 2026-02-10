# tests/test-utils/mocks/
@generated: 2026-02-10T01:19:45Z

## Test Utilities Mocking Module

**Overall Purpose**: Comprehensive mocking infrastructure for the MCP debugger project, providing test doubles for external dependencies, system services, and internal components. Enables isolated unit testing by replacing real implementations with controllable, deterministic mock objects.

## Core Components & Architecture

### System-Level Mocks
- **child-process.ts**: Mock Node.js child_process module with `MockChildProcess` class and specialized configurations for Python/proxy process simulation
- **fs-extra.ts**: Mock filesystem operations with optimistic defaults (`pathExists` always true, `ensureDir` always succeeds)
- **net.ts**: Mock TCP server implementation for testing network operations without actual ports
- **environment.ts**: Environment variable mocking specifically tailored for container path testing

### Debug Protocol Mocks  
- **dap-client.ts**: Mock Debug Adapter Protocol client with comprehensive event simulation and request/response pattern testing
- **mock-proxy-manager.ts**: Mock proxy manager implementing full DAP protocol simulation with configurable failures and event emission
- **mock-adapter-registry.ts**: Mock debug adapter registry with pre-configured language support and error simulation variants

### Utility Mocks
- **mock-command-finder.ts**: Mock command resolution with configurable responses and call history tracking
- **mock-logger.ts**: Two-variant logger mocking (silent vs. observable) for different testing needs

## Key Design Patterns

### Factory Pattern
Most mocks use factory functions (`createMockLogger`, `createEnvironmentMock`, `createMockAdapterRegistry`) enabling test-specific configuration while maintaining consistent interfaces.

### State Management & Reset
All mocks provide `reset()` methods for test isolation, clearing call histories, event listeners, and restoring default behaviors.

### Configurable Behavior
Mocks support both optimistic defaults for basic testing and configurable failure modes for error condition testing:
- `setupPythonSpawnMock()` for process simulation scenarios
- Error simulation variants like `createMockAdapterRegistryWithErrors()`
- Delay and failure flags in proxy manager for timing-sensitive tests

### Event Simulation
Complex mocks extend EventEmitter and use `process.nextTick()` for asynchronous event emission, providing realistic timing while remaining deterministic.

## Public API Surface

### Direct Mock Exports
- `childProcessMock` - Singleton instance with spawn/exec/fork mocking
- `mockDapClient` - DAP client singleton with event simulation
- `fsExtraMock` - Default filesystem mock object
- `netMock` - Network module replacement

### Factory Functions  
- `createMockLogger(logLevel?)` - Configurable logger creation
- `createEnvironmentMock(overrides?)` - Environment variable mocking
- `createMockAdapterRegistry()` - Adapter registry with language support
- `createMockAdapterRegistryWithErrors()` - Error simulation variant

### Test Utilities
- Reset helpers: `resetMockDapClient()`, `resetAdapterRegistryMock()`
- Assertion helpers: `expectAdapterRegistryLanguageCheck()`, `expectAdapterCreation()`
- Event simulation: `simulateEvent()`, `simulateError()`, `simulateExit()`

## Internal Organization

### Mock Hierarchy
1. **System mocks**: Low-level OS/Node.js API replacements (child_process, fs, net, env)
2. **Protocol mocks**: Debug adapter protocol and communication layer mocks
3. **Application mocks**: High-level component mocks for domain-specific functionality

### Data Flow
Mocks track method calls and state changes through:
- Call history arrays for verification
- Event emission for asynchronous behavior simulation  
- Configurable responses for deterministic test outcomes

## Dependencies
- **vitest**: Core testing framework providing `vi.fn()` mock capabilities
- **events.EventEmitter**: Foundation for event-driven mock behavior
- **@debugmcp/shared**: Interface contracts and type definitions
- **@vscode/debugprotocol**: DAP type definitions for protocol mocking

## Critical Integration Points
- All mocks designed for vitest module replacement (`vi.mock()` compatibility)
- Consistent reset patterns enable proper test isolation
- Event simulation uses Node.js timing primitives for realistic async behavior
- Mock responses mirror real API contracts while providing test control