# tests\adapters\go/
@children-hash: 17b0fb8a4d7dcbcd
@generated: 2026-02-15T09:01:38Z

## Purpose
Comprehensive test suite for the Go debugger adapter module, providing both unit and integration test coverage to validate the complete Go/Delve debugger integration within the Debug MCP framework. This directory ensures the Go adapter correctly implements the debugger adapter protocol while maintaining proper isolation and reliability.

## Test Architecture & Organization

### Two-Tier Testing Strategy
- **Unit Tests** (`unit/`): Focused testing of individual components (factory, adapter, utilities) with comprehensive mocking and state validation
- **Integration Tests** (`integration/`): End-to-end smoke testing of adapter functionality using mock dependencies to prevent actual process execution

### Component Relationship Flow
The test suite validates the complete Go adapter ecosystem:
1. **GoAdapterFactory** → Creates and validates Go debug adapter instances with environment checks
2. **GoDebugAdapter** → Manages debug session lifecycle and DAP protocol communication
3. **Go Utilities** → Provide foundational executable discovery, version parsing, and environment validation
4. **Integration Layer** → Validates complete workflows from configuration to command generation

## Key Testing Areas

### Core Functionality Coverage
- **Adapter Lifecycle**: Creation, initialization, connection management, and disposal
- **Configuration Transformation**: Launch config processing for both standard debugging and Go test execution
- **Command Generation**: Proper dlv DAP command construction with TCP port configuration
- **Environment Validation**: Go toolchain and Delve debugger version compatibility checking
- **State Management**: Adapter state transitions and event emission validation

### Cross-Platform & Environment Support
- **Executable Discovery**: GOPATH, GOBIN, and PATH-based tool location with platform-specific handling (.exe on Windows)
- **Version Compatibility**: Go and Delve version parsing and DAP support validation
- **Environment Isolation**: Controlled test environments with PATH/environment variable manipulation

## Testing Infrastructure

### Mock Strategy
- **Process Isolation**: Comprehensive child_process.spawn mocking using EventEmitter simulation
- **File System Abstraction**: fs.promises.access stubbing for executable validation
- **Dependency Injection**: Mock AdapterDependencies factory providing complete test isolation
- **No Side Effects**: All tests run without launching actual debugger processes or modifying system state

### Quality Assurance Patterns
- **Environment Restoration**: Proper setup/teardown to prevent test pollution
- **Async Validation**: Realistic timing simulation using process.nextTick
- **Error Scenario Coverage**: Comprehensive testing of missing tools, version incompatibilities, and failure modes
- **State Transition Validation**: Complete adapter lifecycle testing with proper event emission verification

## Public API Validation
The test suite validates the complete public interface of the Go adapter:
- **Factory Interface**: Adapter creation, metadata retrieval, and environment validation
- **Adapter Interface**: Initialization, connection management, DAP capabilities, and configuration transformation
- **Utilities Interface**: Executable discovery, version parsing, and DAP support checking
- **Integration Points**: Command building, dependency reporting, and framework integration

## Framework Dependencies
- **vitest**: Primary testing framework with comprehensive mocking capabilities
- **@debugmcp/shared**: Core interfaces and adapter framework integration
- **Node.js Built-ins**: System integration testing (child_process, fs, path, events)

This test directory serves as the quality gate for the Go adapter, ensuring reliable debugger integration while maintaining proper isolation from external dependencies and system state. The comprehensive coverage spans from individual utility functions to complete debugging workflow validation.