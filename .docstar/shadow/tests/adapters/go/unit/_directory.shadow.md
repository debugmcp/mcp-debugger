# tests\adapters\go\unit/
@generated: 2026-02-12T21:00:57Z

## Purpose
This directory contains comprehensive unit tests for the Go debug adapter implementation, validating all aspects of Go/Delve debugger integration within the debug MCP system. The tests ensure robust Go development environment detection, adapter lifecycle management, and Debug Adapter Protocol (DAP) compliance.

## Key Components & Organization

### Core Test Suites
- **go-adapter-factory.test.ts**: Tests the GoAdapterFactory responsible for creating Go debug adapter instances and validating environment prerequisites
- **go-debug-adapter.test.ts**: Tests the main GoDebugAdapter class, covering adapter lifecycle, state management, and DAP command orchestration
- **go-utils.test.ts**: Tests utility functions for Go/Delve executable discovery, version parsing, and platform-specific path resolution

### Component Relationships
The test suites form a hierarchical validation structure:
1. **Utils layer** (go-utils.test.ts) - validates low-level Go toolchain detection and version parsing
2. **Adapter layer** (go-debug-adapter.test.ts) - tests the main adapter using validated utils
3. **Factory layer** (go-adapter-factory.test.ts) - tests high-level adapter creation and environment validation using both utils and adapter components

## Testing Infrastructure

### Mock Architecture
- **Unified mock dependencies factory**: `createMockDependencies()` provides consistent AdapterDependencies mocking across all test suites
- **Process execution mocking**: `child_process.spawn` is mocked using EventEmitter simulation for Go/Delve command testing
- **File system mocking**: `fs.promises.access` validation for executable detection
- **Environment isolation**: PATH/GOPATH manipulation with proper cleanup

### Test Patterns
- **State transition validation**: Tests adapter lifecycle states (UNINITIALIZED → READY → CONNECTED)
- **Cross-platform compatibility**: Platform-aware testing for Windows/macOS/Linux executable discovery
- **Error scenario coverage**: Comprehensive negative testing for missing tools, version incompatibilities, and DAP support failures
- **Event-driven testing**: Validates adapter event emissions (initialized, connected, disposed)

## Public API Coverage

### Adapter Factory Interface
- `createAdapter()` - Go debug adapter instantiation
- `getMetadata()` - adapter metadata and capabilities
- `validateEnvironment()` - Go/Delve environment validation

### Debug Adapter Interface
- Lifecycle management (initialize, dispose, connect/disconnect)
- State management and querying
- DAP capabilities and exception filter configuration
- Launch configuration transformation
- Error message translation for user-friendly feedback

### Utility Functions
- Executable discovery (`findGoExecutable`, `findDelveExecutable`)
- Version parsing (`getGoVersion`, `getDelveVersion`)
- DAP support validation (`checkDelveDapSupport`)
- Cross-platform path resolution (`getGoSearchPaths`)

## Critical Validation Logic
- **Go version compatibility**: Ensures Go 1.18+ requirement for Delve DAP support
- **Delve availability**: Validates debugger installation and DAP capability
- **Command construction**: Tests proper `dlv dap --listen=host:port` command building
- **Platform detection**: Handles Windows executable extensions and Unix path conventions
- **Environment robustness**: Tests adapter behavior with missing or misconfigured Go toolchain

## Dependencies & Integration
Tests validate integration with:
- **@debugmcp/shared**: Core debug adapter interfaces and enums
- **@debugmcp/adapter-go**: Go-specific adapter implementation
- **Node.js built-ins**: File system, child process, and path utilities
- **Vitest framework**: Modern testing with comprehensive mocking capabilities

The test suite ensures the Go adapter can reliably detect, validate, and integrate with Go development environments across platforms while providing clear error messages and proper DAP protocol compliance.