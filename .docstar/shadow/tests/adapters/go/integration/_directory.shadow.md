# tests/adapters/go/integration/
@generated: 2026-02-10T21:26:17Z

## Purpose
Integration test directory for the Go debugger adapter, providing smoke tests that validate core adapter functionality without launching actual debugger processes. This directory ensures the Go adapter's command building, configuration transformation, and metadata exposure work correctly in an isolated testing environment.

## Key Components

### Test Infrastructure
- **Mock Dependencies**: Comprehensive fake implementations of AdapterDependencies with no-op process launchers and file system operations
- **Environment Management**: Controlled DLV_PATH environment variable handling for consistent test execution
- **Isolation Layer**: Prevents actual delve process execution while maintaining realistic adapter behavior

### Core Test Coverage
The integration tests validate four critical adapter capabilities:

1. **Command Building**: Verifies dlv DAP command generation with proper TCP port configuration and executable validation
2. **Launch Configuration**: Tests transformation of debug configurations for normal Go programs with proper path, working directory, arguments, and environment handling
3. **Test Mode Support**: Validates Go test-specific configuration transformation including test arguments (-test.v, -test.run) and mode switching
4. **Metadata & Dependencies**: Ensures proper factory metadata exposure and dependency reporting for Go toolchain and Delve debugger

## Public API Surface
- **Primary Entry Point**: `GoAdapterFactory` integration validation
- **Test Configuration**: Standardized test port (48766) and session ID ('session-go-smoke')
- **Mock Environment**: Controlled testing environment using process.execPath as mock delve binary

## Internal Organization
```
Mock Setup → Environment Config → Adapter Testing → Validation
     ↓              ↓                 ↓              ↓
 Fake deps    DLV_PATH mgmt    Command/config     Assertions
```

## Data Flow
1. **Setup Phase**: Creates mock dependencies and configures test environment
2. **Execution Phase**: Exercises adapter methods with controlled inputs
3. **Validation Phase**: Verifies outputs match expected command structures and configurations

## Testing Patterns
- **Smoke Testing**: Validates core functionality without external dependencies
- **Mocking Strategy**: Comprehensive fake implementations prevent side effects
- **Configuration Testing**: Validates both normal and test mode Go program configurations
- **Metadata Validation**: Ensures proper adapter registration and dependency reporting

## Integration Context
This directory validates that the Go adapter correctly integrates with the broader debug MCP system by testing its factory implementation, configuration transformation capabilities, and dependency management without requiring actual Go toolchain installation.