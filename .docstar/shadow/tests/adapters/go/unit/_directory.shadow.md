# tests\adapters\go\unit/
@generated: 2026-02-12T21:05:48Z

## Overall Purpose
Comprehensive unit test suite for the Go debug adapter module, providing thorough validation of Go/Delve debugger integration with the Debug Adapter Protocol (DAP). This directory contains tests that ensure the Go adapter can properly discover development tools, manage debugger lifecycle, and maintain reliable communication with Go's native debugging infrastructure.

## Test Components & Integration

### Core Test Modules
- **go-adapter-factory.test.ts**: Tests the factory pattern for creating Go debug adapters, including metadata validation and environment compatibility checking
- **go-debug-adapter.test.ts**: Validates the main GoDebugAdapter class lifecycle, state management, DAP command building, and debugger communication
- **go-utils.test.ts**: Tests utility functions for Go/Delve executable discovery, version parsing, and cross-platform path resolution

### Testing Architecture
The test suite employs a layered testing approach where utilities are tested independently, then integrated through the adapter class, and finally validated through the factory interface. Each layer builds upon the previous, ensuring comprehensive coverage from low-level tool discovery to high-level adapter orchestration.

## Key Test Patterns & Infrastructure

### Mock Strategy
- **Process Mocking**: Comprehensive child_process.spawn mocking using EventEmitter simulation for Go/Delve process interaction
- **File System Abstraction**: Mocked fs.promises.access for executable detection and validation
- **Environment Simulation**: PATH and GOPATH manipulation for testing various development environment configurations
- **Dependency Injection**: Centralized mock factory (createMockDependencies) providing consistent test doubles across all test suites

### State & Lifecycle Testing
- **Adapter States**: Validates proper state transitions (UNINITIALIZED → READY → CONNECTED → DISCONNECTED)
- **Event-Driven Testing**: Verifies event emission for adapter lifecycle events (initialized, connected, disposed)
- **Error Handling**: Tests graceful degradation and user-friendly error messages for common Go development issues

## Public API Testing Surface

### Factory Interface
- Adapter creation and language validation (DebugLanguage.GO)
- Metadata retrieval (displayName, version, supported file extensions)
- Environment validation with detailed compatibility reporting

### Adapter Interface  
- Initialization and disposal lifecycle management
- Connection management with host/port configuration
- DAP capabilities and exception filter support (panic, fatal breakpoints)
- Feature support validation (conditional breakpoints, log points, data breakpoints)
- Launch configuration transformation from generic to Go-specific format

### Utilities Interface
- Cross-platform executable discovery (findGoExecutable, findDelveExecutable)
- Version parsing and compatibility checking (Go 1.18+ requirement)
- DAP protocol support validation for Delve
- Platform-aware search path resolution

## Internal Organization & Data Flow

### Test Execution Flow
1. **Environment Setup**: Mock dependencies and process simulation infrastructure
2. **Tool Discovery**: Validate Go/Delve executable detection across platforms
3. **Version Validation**: Parse and verify tool versions meet minimum requirements
4. **Adapter Lifecycle**: Test state transitions and event handling
5. **Protocol Integration**: Validate DAP command construction and communication
6. **Error Scenarios**: Test failure modes and recovery mechanisms

### Cross-Platform Support
Tests are designed to run on the current platform only, avoiding unreliable cross-platform mocking while still validating platform-specific behaviors like executable extensions (.exe on Windows) and search path conventions.

## Dependencies & Integration Points
- **@debugmcp/adapter-go**: Core classes under test (GoAdapterFactory, GoDebugAdapter, utilities)
- **@debugmcp/shared**: Shared interfaces and enums (AdapterDependencies, AdapterState, DebugLanguage, DebugFeature)
- **vitest**: Primary testing framework with comprehensive mocking capabilities
- **Node.js built-ins**: child_process, fs, path, events for system integration testing

The test suite ensures the Go adapter can reliably integrate with Go's development toolchain while maintaining compatibility with the broader debug adapter ecosystem.