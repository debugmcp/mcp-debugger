# tests\adapters\go\unit/
@children-hash: e82a93262eec6201
@generated: 2026-02-15T09:01:22Z

## Purpose
Unit test directory for the Go debug adapter module, providing comprehensive test coverage for Go/Delve debugger integration within the Debug MCP framework. These tests validate the complete Go adapter lifecycle from factory creation and environment validation to debug session management and utility functions.

## Key Components & Organization

### Core Test Modules
- **go-adapter-factory.test.ts**: Tests the GoAdapterFactory responsible for creating and validating Go debug adapter instances
- **go-debug-adapter.test.ts**: Tests the GoDebugAdapter class that manages debug sessions and DAP communication
- **go-utils.test.ts**: Tests utility functions for Go/Delve executable discovery, version parsing, and environment validation

### Component Integration Flow
1. **Factory Layer**: GoAdapterFactory creates GoDebugAdapter instances and validates environment prerequisites
2. **Adapter Layer**: GoDebugAdapter manages debug session lifecycle and DAP protocol communication  
3. **Utilities Layer**: Go utilities provide foundational support for executable discovery and version management

## Test Infrastructure & Patterns

### Mock Strategy
- **Process Mocking**: Comprehensive child_process.spawn mocking using EventEmitter simulation
- **File System Mocking**: fs.promises.access stubbing for executable validation
- **Dependency Injection**: createMockDependencies() factory providing complete AdapterDependencies mock
- **Environment Isolation**: Temporary PATH/GOPATH manipulation with proper cleanup

### State Management Testing
- **Lifecycle Validation**: Tests state transitions (UNINITIALIZED → READY → CONNECTED → DISPOSED)
- **Event Emission**: Validates adapter events (initialized, connected, disposed)
- **Error Handling**: Comprehensive error scenario coverage with user-friendly message translation

### Platform Awareness
- **Cross-Platform Support**: Platform-specific executable discovery (.exe extensions on Windows)
- **Path Resolution**: Tests GOPATH, GOBIN, and PATH-based executable location strategies
- **Current Platform Focus**: Tests run against current platform to avoid unreliable cross-platform mocking

## Public API Testing Surface

### Factory Interface
- Adapter creation and language validation
- Metadata retrieval (version, description, file extensions, documentation URLs)
- Environment validation with Go/Delve version checking

### Adapter Interface  
- Initialization and disposal lifecycle management
- Connection state management with host/port configuration
- DAP capabilities and exception filter support
- Launch configuration transformation
- Feature support validation (conditional breakpoints, log points)

### Utilities Interface
- Executable discovery (findGoExecutable, findDelveExecutable)
- Version parsing (getGoVersion, getDelveVersion)
- DAP support validation (checkDelveDapSupport)
- Search path resolution (getGoSearchPaths)

## Key Dependencies & Framework
- **@debugmcp/adapter-go**: Primary module under test
- **@debugmcp/shared**: Core interfaces and enums (AdapterDependencies, AdapterState, DebugLanguage)
- **vitest**: Testing framework with comprehensive mocking capabilities
- **Node.js built-ins**: child_process, fs, path, events for system integration testing

## Testing Quality Assurance
- Environment restoration patterns prevent test pollution
- Async validation with proper setup/teardown hooks
- Mock process timing using process.nextTick for realistic async behavior
- Comprehensive error scenario coverage including missing tools and version compatibility issues