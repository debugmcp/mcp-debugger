# tests/adapters/go/
@generated: 2026-02-09T18:16:31Z

## Purpose
This directory contains the complete test suite for the Go debug adapter implementation in DebugMCP. It provides comprehensive validation of the Go debugging toolchain integration through two complementary test approaches: deep unit testing for all components and lightweight integration testing for public API validation.

## Test Architecture Overview
The directory is organized into two main testing strategies that together ensure complete coverage of the Go adapter functionality:

### Unit Testing (`unit/`)
Provides exhaustive component-level testing across three architectural layers:
- **Factory Layer**: Validates adapter creation, environment validation, and toolchain requirements
- **Core Adapter Layer**: Tests debugging session lifecycle, state management, and debugging capabilities  
- **Utility Layer**: Tests Go toolchain discovery, version parsing, and DAP support detection

### Integration Testing (`integration/`)
Provides lightweight smoke testing of the public API surface without external dependencies, using mock implementations to validate command generation, configuration handling, and adapter metadata.

## Key Components & Data Flow

### Comprehensive Mock Infrastructure
Both test suites employ sophisticated mocking strategies:
- **Process Mocking**: EventEmitter-based simulation of `child_process.spawn` for Go/Delve toolchain interaction
- **Environment Isolation**: Careful management of `DLV_PATH` and other environment variables with proper cleanup
- **Dependency Injection**: Mock `AdapterDependencies` implementations to isolate adapter logic from system dependencies

### Cross-Platform Testing
- Platform-aware testing for Windows/Unix executable discovery
- Environment variable restoration patterns
- Conditional testing to avoid unreliable cross-platform scenarios

### Error Scenario Coverage
Extensive validation of failure modes including:
- Missing or incompatible Go/Delve installations
- Version parsing edge cases and malformed command outputs
- Process spawn failures and permission issues
- Configuration validation and path resolution errors

## Public API Validation
The test suite exercises all major entry points from `@debugmcp/adapter-go`:

### Factory Interface
- `GoAdapterFactory.create()` - Primary adapter instantiation
- `validate()` - Environment and toolchain validation
- `getMetadata()` - Adapter capability and dependency reporting

### Adapter Lifecycle
- `initialize()` - Adapter setup and validation
- `connect()` / `disconnect()` - Debug session management
- `dispose()` - Resource cleanup

### Utility Functions
- `buildAdapterCommand()` - Delve DAP command generation
- Go/Delve executable discovery and version validation
- DAP support detection in Delve installations

## Testing Patterns & Organization

### State Machine Validation
Tests verify proper state transitions through the debugging lifecycle:
`UNINITIALIZED → READY → CONNECTED → DISCONNECTED`

### Configuration Testing
Validates different Go debugging scenarios:
- Standard Go program debugging with proper launch configuration
- Go test debugging with test-specific settings
- Path normalization and workspace resolution

### Toolchain Integration
Tests real-world Go development environment scenarios:
- Go version compatibility (≥1.18 requirement)
- Delve installation with DAP support
- Platform-specific binary discovery and execution

## Dependencies & Test Infrastructure
- **Vitest**: Primary testing framework with comprehensive mocking capabilities
- **@debugmcp/adapter-go**: Target implementation under test
- **@debugmcp/shared**: Shared interfaces and type definitions
- **Node.js Core Modules**: child_process, fs, path, events for system integration simulation

This test directory ensures the Go debug adapter can reliably integrate with diverse Go development environments while providing clear error messages and proper fallback behaviors when toolchain requirements are not met. The dual approach of comprehensive unit testing and lightweight integration testing provides confidence in both individual component behavior and overall system integration.