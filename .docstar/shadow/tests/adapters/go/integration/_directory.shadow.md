# tests\adapters\go\integration/
@generated: 2026-02-12T21:00:52Z

## Purpose
Integration test directory for the Go debugger adapter, providing comprehensive smoke tests that validate the adapter's core functionality without launching actual debugger processes. This module ensures the Go adapter can properly configure debugging sessions, build command-line invocations, and handle various Go debugging scenarios.

## Test Architecture
The directory implements a **mock-based integration testing approach** that isolates the adapter logic from external dependencies:
- **Fake Dependencies**: Creates mock AdapterDependencies with no-op implementations to prevent actual file system access and process launching
- **Controlled Environment**: Manages DLV_PATH environment variables for testing scenarios
- **Session Simulation**: Uses standardized test identifiers (session ID: 'session-go-smoke', port: 48766) for consistent testing

## Key Test Coverage Areas

### Command Generation & Validation
- Validates `buildAdapterCommand()` method for generating proper dlv DAP commands
- Ensures command paths are absolute and executable files exist
- Verifies correct TCP port configuration and required 'dap' argument handling

### Configuration Transformation
- **Standard Go Programs**: Tests `transformLaunchConfig()` for normal debugging scenarios with proper program path, working directory, arguments, and environment handling
- **Go Test Mode**: Validates test-specific configuration including test flags (-test.v, -test.run) and mode setting

### Adapter Metadata & Dependencies
- Validates factory metadata exposure (display names, file extensions, descriptions)
- Tests dependency reporting for Go toolchain and Delve debugger
- Ensures installation instructions contain proper references

## Test Configuration & Samples
- Uses controlled test paths referencing `examples/go/main.go` and `examples/go-hello`
- Employs `process.execPath` as mock delve binary for testing
- Implements isolation through mock file system operations that return empty/false values

## Public API Surface
The tests validate the key entry points of the Go adapter:
- `GoAdapterFactory` instantiation and configuration
- `buildAdapterCommand()` method for command generation
- `transformLaunchConfig()` method for configuration processing
- Metadata and dependency reporting interfaces

## Integration Patterns
- **Mock-First Testing**: All external dependencies are mocked to focus on adapter logic
- **Environment Simulation**: Real process.env access with controlled DLV_PATH manipulation
- **Error Boundary Testing**: Mock processLauncher throws errors to prevent actual process execution
- **Comprehensive Validation**: Tests cover command building, configuration transformation, metadata exposure, and dependency management

This integration test suite serves as a critical validation layer ensuring the Go adapter maintains proper functionality across different debugging scenarios while remaining isolated from external system dependencies.