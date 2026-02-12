# tests\adapters\go/
@generated: 2026-02-12T21:01:15Z

## Purpose
This directory provides comprehensive test coverage for the Go debug adapter implementation, validating the entire Go/Delve debugger integration within the debug MCP system. The test suite ensures robust Go development environment detection, Debug Adapter Protocol (DAP) compliance, and reliable adapter lifecycle management across different platforms and debugging scenarios.

## Test Architecture & Organization

### Two-Tier Testing Strategy
The directory implements a **dual-layer testing approach** combining unit and integration validation:

- **Unit Tests** (`unit/`): Focused component-level validation of individual classes and utilities with comprehensive mocking
- **Integration Tests** (`integration/`): End-to-end smoke tests that validate adapter behavior with mock dependencies but real configuration flows

### Component Test Hierarchy
Tests are organized in a hierarchical validation structure that mirrors the adapter architecture:

1. **Utils Layer** (`unit/go-utils.test.ts`) - Low-level Go toolchain detection, version parsing, and executable discovery
2. **Adapter Core** (`unit/go-debug-adapter.test.ts`) - Main GoDebugAdapter lifecycle, state management, and DAP orchestration  
3. **Factory Interface** (`unit/go-adapter-factory.test.ts`) - High-level adapter creation and environment validation
4. **Integration Validation** (`integration/`) - Complete workflow testing with configuration transformation and command generation

## Key Testing Infrastructure

### Mock-Based Isolation
- **Unified mock factory**: `createMockDependencies()` provides consistent AdapterDependencies mocking across all test suites
- **Process simulation**: EventEmitter-based mocking of `child_process.spawn` for Go/Delve command testing
- **File system abstraction**: Mocked `fs.promises.access` for executable detection without actual file system dependencies
- **Environment control**: Safe PATH/GOPATH manipulation with proper cleanup and restoration

### Cross-Platform Validation
- **Platform-aware testing**: Handles Windows executable extensions (.exe) vs Unix conventions
- **Environment variable testing**: DLV_PATH, GOPATH, and PATH manipulation scenarios
- **Path resolution**: Tests proper absolute path generation and executable discovery across platforms

## Public API Coverage

### Adapter Factory Interface
- `createAdapter()` - Go debug adapter instantiation with dependency injection
- `getMetadata()` - Adapter metadata, capabilities, and supported file extensions
- `validateEnvironment()` - Go toolchain and Delve debugger environment validation
- Dependency reporting with installation instructions

### Debug Adapter Lifecycle
- **State Management**: Validates transitions (UNINITIALIZED → READY → CONNECTED) with proper event emission
- **DAP Protocol**: Tests initialization, capabilities negotiation, and exception filter configuration
- **Configuration Processing**: Launch configuration transformation for standard Go programs and test mode
- **Command Generation**: Validates `buildAdapterCommand()` for proper `dlv dap` invocation

### Utility Functions
- **Executable Discovery**: `findGoExecutable`, `findDelveExecutable` with cross-platform path searching
- **Version Management**: `getGoVersion`, `getDelveVersion` with semantic version parsing
- **Compatibility Validation**: `checkDelveDapSupport` ensuring Go 1.18+ and Delve DAP capability
- **Error Translation**: User-friendly error message generation for common failure scenarios

## Critical Validation Areas

### Environment Robustness
- **Missing toolchain handling**: Tests adapter behavior when Go or Delve is unavailable
- **Version compatibility**: Ensures Go 1.18+ requirement for Delve DAP support
- **Configuration validation**: Proper handling of malformed or incomplete launch configurations
- **Error boundary testing**: Comprehensive negative scenario coverage

### Integration Workflows
- **Command Generation**: End-to-end validation of `dlv dap --listen=host:port` command construction
- **Configuration Transformation**: Tests both standard Go debugging and test-specific scenarios
- **Session Management**: Validates proper session ID and port assignment for debugging sessions

## Testing Dependencies
The test suite integrates with:
- **@debugmcp/shared**: Core debug adapter interfaces, enums, and state management
- **@debugmcp/adapter-go**: Go-specific adapter implementation under test
- **Vitest**: Modern testing framework with comprehensive mocking and assertion capabilities
- **Node.js APIs**: File system, child process, and path utilities with proper mocking

This comprehensive test directory ensures the Go adapter maintains reliable functionality across diverse development environments while providing clear error feedback and strict DAP protocol compliance.