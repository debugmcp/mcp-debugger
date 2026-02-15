# tests\adapters\go\integration/
@children-hash: 76206beee15165f7
@generated: 2026-02-15T09:01:21Z

## Purpose
Integration test suite for the Go debugger adapter, providing comprehensive validation of the adapter's core functionality through isolated smoke tests that verify behavior without launching actual debugger processes.

## Test Architecture
This directory contains integration tests that use a **mock-based testing approach** to validate the Go adapter's behavior in isolation:

- **Mock Dependencies**: Creates fake AdapterDependencies with no-op implementations to prevent actual process execution and file system operations
- **Environment Control**: Manages test-specific environment variables (DLV_PATH) to ensure consistent test conditions
- **Smoke Testing**: Validates core adapter functionality without the complexity of real debugger sessions

## Key Test Coverage Areas

### Command Generation & Validation
- Tests `buildAdapterCommand()` method for proper dlv DAP command construction
- Validates TCP port configuration and executable path resolution
- Ensures required arguments ('dap', listen parameters) are correctly formatted

### Configuration Transformation
- **Standard Debug Mode**: Tests `transformLaunchConfig()` for normal Go program debugging
- **Test Mode Support**: Validates Go test-specific configuration handling with proper test arguments
- **Parameter Validation**: Ensures proper handling of program paths, working directories, arguments, and environment variables

### Metadata & Dependencies
- Validates factory metadata exposure (display name, file extensions, descriptions)
- Tests dependency reporting and installation instruction generation
- Verifies Go toolchain and Delve debugger requirements

## Test Infrastructure
- **Test Framework**: vitest-based test suite with comprehensive mocking
- **Isolation Strategy**: Mock processLauncher prevents actual process execution while maintaining API contracts
- **Sample Assets**: References standard Go example programs for realistic test scenarios
- **Port Management**: Uses dedicated test port (48766) for TCP communication testing

## Public API Validation
The tests validate the complete public surface of the Go adapter:
- `GoAdapterFactory` instantiation and configuration
- Command building and launch configuration transformation
- Dependency reporting and metadata exposure
- Integration with the broader debugger adapter framework

## Data Flow
Tests follow a pattern of:
1. **Setup**: Create mock dependencies and controlled environment
2. **Execution**: Invoke adapter methods with test configurations  
3. **Validation**: Verify outputs match expected formats and contain required elements
4. **Isolation**: Ensure no side effects or actual process launches occur

This integration test suite serves as a critical validation layer ensuring the Go adapter correctly implements the debugger adapter protocol while maintaining proper isolation from external dependencies.