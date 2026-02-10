# tests/adapters/go/unit/
@generated: 2026-02-09T18:16:07Z

## Purpose
This directory contains the comprehensive unit test suite for the Go debug adapter implementation in DebugMCP. It validates the complete Go debugging toolchain integration, including adapter factory creation, debug session management, and Go/Delve utility functions.

## Test Architecture Overview
The directory follows a three-layer testing approach that mirrors the Go adapter's modular architecture:

1. **Factory Layer** (`go-adapter-factory.test.ts`) - Tests adapter creation and environment validation
2. **Core Adapter Layer** (`go-debug-adapter.test.ts`) - Tests debugging session lifecycle and capabilities  
3. **Utility Layer** (`go-utils.test.ts`) - Tests Go toolchain discovery and version management

## Key Components & Integration

### GoAdapterFactory Testing
- **Environment Validation**: Comprehensive testing of Go toolchain requirements (Go ≥1.18, Delve with DAP support)
- **Adapter Creation**: Validates proper GoDebugAdapter instantiation and metadata retrieval
- **System Integration**: Tests real-world scenarios including missing tools, version incompatibilities, and platform-specific behaviors

### GoDebugAdapter Testing  
- **Lifecycle Management**: Tests initialization, connection, and disposal workflows
- **State Machine**: Validates state transitions (UNINITIALIZED → READY → CONNECTED → DISCONNECTED)
- **Debugging Capabilities**: Tests feature support including breakpoints, stepping, exception handling
- **Error Translation**: Validates Go-specific error message localization and user guidance

### Go Utilities Testing
- **Executable Discovery**: Platform-aware testing of Go and Delve binary location
- **Version Parsing**: Robust testing of version extraction from command outputs
- **DAP Support Detection**: Validates Delve Debug Adapter Protocol capability checks

## Testing Infrastructure Patterns

### Mock Strategy
All tests use comprehensive mocking via Vitest:
- **Process Mocking**: `child_process.spawn` simulation with EventEmitter-based process emulation
- **File System Mocking**: Stubbed filesystem operations for executable discovery
- **Environment Isolation**: Careful environment variable management with cleanup

### Cross-Platform Considerations
- Platform-specific path resolution testing
- Conditional testing to avoid unreliable cross-platform mocks
- Environment variable restoration in try/finally blocks

## Public API Coverage
The test suite provides complete coverage of the Go adapter's public interface:

- **Factory Methods**: `createAdapter()`, `validate()`, `getMetadata()`
- **Adapter Lifecycle**: `initialize()`, `connect()`, `disconnect()`, `dispose()`
- **Capability Queries**: Feature support and debugging capabilities
- **Utility Functions**: Executable discovery, version parsing, DAP validation

## Error Handling Validation
Comprehensive error scenario testing including:
- Missing or incompatible Go/Delve installations
- Process spawn failures and permission issues
- Version parsing edge cases and malformed outputs
- Platform-specific path resolution failures

## Dependencies
- **Vitest**: Primary testing framework with extensive mocking capabilities
- **@debugmcp/adapter-go**: Target implementation under test
- **@debugmcp/shared**: Shared types, enums, and interfaces
- **Node.js Core**: child_process, fs, path, events for system integration testing

This test suite ensures the Go debug adapter can reliably integrate with various Go development environments while providing clear error messages and proper fallback behaviors when toolchain requirements are not met.