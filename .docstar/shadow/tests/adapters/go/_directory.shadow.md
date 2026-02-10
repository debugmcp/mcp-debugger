# tests/adapters/go/
@generated: 2026-02-10T01:19:54Z

## Purpose & Responsibility

Comprehensive test suite for the Go debugger adapter within the debugmcp system. This directory validates the complete integration between debugmcp and the Delve (dlv) debugger for Go applications, ensuring reliable Debug Adapter Protocol (DAP) support and proper environment management.

## Module Organization & Architecture

The test suite is organized into two complementary layers:

### Unit Testing Layer (`unit/`)
- **go-adapter-factory.test.ts**: Factory pattern testing for adapter creation and metadata
- **go-debug-adapter.test.ts**: Core adapter lifecycle, DAP capabilities, and state management  
- **go-utils.test.ts**: Utility functions for executable discovery and version validation

### Integration Testing Layer (`integration/`)
- **Smoke tests**: End-to-end validation of adapter functionality without launching actual debugger processes
- **Mock environment**: Complete isolation using fake dependencies and file system operations
- **Real configuration testing**: Validates actual adapter logic with simulated infrastructure

## Component Relationships & Data Flow

The tests validate a complete Go debugging workflow:

1. **Factory Creation**: `GoAdapterFactory` creates adapter instances with proper language assignment
2. **Environment Validation**: Checks for Go (1.18+) and Delve with DAP support using utility functions
3. **Adapter Lifecycle**: Tests state transitions (IDLE → READY → CONNECTED → DISPOSED) and event emission
4. **Configuration Processing**: Validates launch config transformation for programs and test modes
5. **Command Generation**: Ensures correct `dlv dap` command construction with proper TCP configuration

## Key Entry Points & Public API

### Factory Interface
- `createAdapter()`: Adapter instance creation and language assignment
- `getMetadata()`: Metadata retrieval (name, version 0.1.0, supported file extensions)
- `validate()`: Environment prerequisite checking

### Adapter Interface  
- State management with event emission ('initialized', 'disposed', 'connected', 'disconnected')
- DAP capabilities (breakpoints, exception filters, logging support)
- Configuration transformation for launch/attach scenarios
- Command building for Delve DAP interface

### Utility Interface
- Cross-platform executable discovery (`findGoExecutable()`, `findDelveExecutable()`)
- Version parsing and validation (`getGoVersion()`, `getDelveVersion()`) 
- DAP support detection (`checkDelveDapSupport()`)
- Platform-aware path resolution (`getGoSearchPaths()`)

## Testing Patterns & Infrastructure

### Mock Strategy
- **Process Isolation**: Comprehensive `child_process.spawn` mocking with EventEmitter simulation
- **File System Mocking**: Safe defaults for all fs operations in integration tests
- **Environment Control**: Platform stubbing and DLV_PATH manipulation
- **Dependency Injection**: Mock factory pattern for clean test isolation

### Coverage Approach
- **Platform-Aware Testing**: Tests run on current platform to avoid cross-platform complexity
- **Error Boundary Validation**: Systematic testing of failure modes and error conditions
- **Async Simulation**: Realistic command execution timing using `process.nextTick()`
- **Safety First**: Integration tests prevent accidental debugger process launches

## Critical Validation Areas

### Environment Prerequisites
- Go toolchain availability and minimum version enforcement (1.18+)
- Delve debugger installation with DAP support
- Platform information collection for debugging context
- Proper error message handling for common failure scenarios

### Debug Protocol Support
- Exception filters for Go-specific errors ('panic', 'fatal')
- Breakpoint capabilities (conditional, function, log points)  
- Launch vs. attach configuration handling
- TCP port management and connection establishment

This test directory ensures the Go adapter reliably integrates Delve debugging capabilities into the debugmcp framework, providing both comprehensive unit validation and realistic integration testing while maintaining complete isolation from actual debugging processes.