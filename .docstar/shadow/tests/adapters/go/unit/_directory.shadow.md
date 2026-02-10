# tests/adapters/go/unit/
@generated: 2026-02-10T01:19:42Z

## Purpose & Responsibility

Unit test suite for the Go debug adapter components within the debugmcp system. This directory provides comprehensive test coverage for Go/Delve debugger integration, validating adapter creation, environment setup, debugger lifecycle management, and utility functions for executable discovery and version management.

## Key Components and Relationships

### Test Suite Architecture
- **go-adapter-factory.test.ts**: Tests the factory pattern for creating Go debug adapters, including metadata retrieval and environment validation
- **go-debug-adapter.test.ts**: Core adapter functionality testing including initialization, state management, DAP capabilities, and configuration transformation  
- **go-utils.test.ts**: Utility function testing for executable discovery, version parsing, and platform-specific path resolution

### Integration Flow
The test suites validate a complete Go debugging workflow:
1. **Factory Creation**: GoAdapterFactory creates and validates adapter instances
2. **Environment Validation**: Checks for Go (1.18+) and Delve with DAP support
3. **Adapter Lifecycle**: Initialization → Ready → Connected → Disposed state transitions
4. **Utility Support**: Executable discovery, version parsing, and platform-aware path resolution

## Public API Surface Tested

### GoAdapterFactory
- `createAdapter()`: Adapter instance creation with proper language assignment
- `getMetadata()`: Retrieval of adapter metadata (name, version 0.1.0, supported extensions)
- `validate()`: Environment prerequisite checking (Go/Delve availability)

### GoDebugAdapter  
- State management (IDLE → READY → CONNECTED → DISCONNECTED → ERROR → DISPOSED)
- Event emission ('initialized', 'disposed', 'connected', 'disconnected')
- DAP capabilities and feature support (breakpoints, logging, exception handling)
- Configuration transformation for launch/attach scenarios

### Go Utilities
- `findGoExecutable()` / `findDelveExecutable()`: Cross-platform tool discovery
- `getGoVersion()` / `getDelveVersion()`: Version string parsing and validation
- `checkDelveDapSupport()`: DAP capability detection
- `getGoSearchPaths()`: Platform-specific path resolution

## Test Patterns and Infrastructure

### Mocking Strategy
- **Process Isolation**: Comprehensive `child_process.spawn` mocking using EventEmitter patterns
- **File System**: Mocked `fs.promises.access` for executable discovery testing
- **Environment Control**: Platform stubbing and environment variable management
- **Dependency Injection**: Mock factory pattern (`createMockDependencies()`) for clean test isolation

### Testing Approach
- **Platform-Aware**: Tests run only on current platform to avoid cross-platform mocking complexity
- **Async Simulation**: `process.nextTick()` for realistic command execution simulation
- **Error Boundary Testing**: Systematic validation of failure modes and error conditions
- **State Transition Validation**: Comprehensive lifecycle and event emission testing

## Critical Validation Logic

### Environment Prerequisites
- Go binary availability and minimum version enforcement (1.18+)
- Delve debugger installation with DAP (Debug Adapter Protocol) support
- Platform information collection for debugging context
- Proper error message translation for common failure scenarios

### Debug Adapter Protocol Support
- Exception filters for Go-specific errors ('panic', 'fatal')
- Breakpoint capabilities (conditional, function, log points)
- Terminate request handling
- Launch vs. attach configuration transformation

## Internal Organization

The test suite follows a hierarchical validation approach:
1. **Factory Level**: Adapter creation and metadata validation
2. **Adapter Level**: Core debugging functionality and lifecycle management  
3. **Utility Level**: Low-level tool discovery and system integration

This comprehensive test coverage ensures reliable Go debugging support within the debugmcp framework, validating both the happy path scenarios and robust error handling for various failure modes.