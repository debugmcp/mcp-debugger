# tests/adapters/go/unit/
@generated: 2026-02-11T23:47:40Z

## Overall Purpose and Responsibility

This directory contains comprehensive unit tests for the Go debug adapter implementation, validating the complete lifecycle and functionality of Go/Delve debugger integration. The test suite ensures proper environment validation, adapter state management, tool discovery, and Debug Adapter Protocol (DAP) compatibility for Go debugging workflows.

## Key Components and Relationships

### GoAdapterFactory Tests (`go-adapter-factory.test.ts`)
- **Factory Pattern Validation**: Tests creation and instantiation of GoDebugAdapter instances
- **Environment Prerequisites**: Validates Go (≥1.18) and Delve debugger installation requirements
- **Metadata Verification**: Tests adapter identity, versioning (0.1.0), and file associations (.go)
- **Validation Pipeline**: Comprehensive testing of environment setup including platform info and DAP support

### GoDebugAdapter Tests (`go-debug-adapter.test.ts`) 
- **Lifecycle Management**: Tests complete adapter state transitions (INITIALIZING → READY → CONNECTED → DISPOSED)
- **Event-Driven Architecture**: Validates event emission for initialization, connection, and disposal
- **Feature Capabilities**: Tests DAP feature support including breakpoints, log points, and Go-specific exception handling
- **Configuration Transform**: Tests conversion of generic debug configs to Go-specific launch parameters
- **Error Translation**: Human-readable error message generation for common failure scenarios

### Utilities Tests (`go-utils.test.ts`)
- **Tool Discovery**: Platform-aware testing of Go and Delve executable location
- **Version Management**: Parsing and validation of Go/Delve version strings
- **Platform Integration**: Cross-platform path resolution with GOPATH/GOBIN support
- **DAP Support Detection**: Verification of Delve Debug Adapter Protocol capabilities

## Testing Architecture and Patterns

### Mock Infrastructure
- **Process Isolation**: Comprehensive `child_process.spawn` mocking using EventEmitter patterns
- **File System Mocking**: `fs.promises.access` simulation for tool availability checks
- **Environment Control**: Platform stubbing and environment variable manipulation with cleanup
- **Dependency Injection**: `createMockDependencies()` factory for consistent test setup

### Test Organization
- **State-Based Testing**: Validation of adapter state machines and transitions
- **Error Boundary Coverage**: Systematic testing of failure modes and recovery
- **Platform Awareness**: Current platform testing to avoid cross-platform mocking complexity
- **Event-Driven Verification**: Async event emission and handling validation

## Public API Surface Validation

The test suite validates these key entry points:
- **GoAdapterFactory.createAdapter()**: Factory method for adapter instantiation
- **GoAdapterFactory.validate()**: Environment prerequisite checking
- **GoDebugAdapter lifecycle methods**: initialize(), dispose(), connect(), disconnect()
- **Utility functions**: Tool discovery, version parsing, and platform path resolution

## Internal Organization and Data Flow

1. **Factory Layer**: Environment validation → Adapter creation → Metadata provision
2. **Adapter Layer**: Initialization → Feature negotiation → State management → Configuration
3. **Utilities Layer**: Tool discovery → Version verification → Platform integration → DAP support

## Critical Testing Constraints

- **Platform Specificity**: Tests execute only on current platform to ensure reliability
- **Environment Isolation**: Careful cleanup of environment modifications to prevent test pollution
- **Async Simulation**: `process.nextTick()` based event simulation for realistic process behavior
- **Mock Lifecycle**: Comprehensive setup/teardown to maintain test independence

This test directory ensures the Go debug adapter's reliability across diverse development environments while maintaining strict validation of Go toolchain requirements and DAP protocol compliance.