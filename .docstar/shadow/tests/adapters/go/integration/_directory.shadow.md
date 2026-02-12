# tests/adapters/go/integration/
@generated: 2026-02-11T23:47:37Z

## Purpose
Integration test directory for the Go debugger adapter, containing smoke tests that validate core functionality of the Go adapter without launching actual debugger processes. This directory ensures the Go adapter can properly build commands, configure launch settings, and integrate with the broader debugger ecosystem.

## Key Components

### Test Infrastructure
- **go-session-smoke.test.ts**: Primary integration test suite providing comprehensive coverage of Go adapter functionality
- **Mock Dependencies**: Sophisticated mocking system that isolates adapter logic from external dependencies while maintaining realistic behavior patterns

### Test Coverage Areas

**Command Generation Testing**
- Validates `buildAdapterCommand()` method for proper dlv DAP command construction
- Ensures TCP port configuration and absolute path handling
- Verifies required 'dap' argument and listen parameter formatting

**Configuration Management** 
- Tests `transformLaunchConfig()` for both normal Go programs and test mode
- Validates standard debug mode configuration handling
- Ensures proper test-specific argument processing (-test.v, -test.run)

**Metadata & Dependencies**
- Validates factory metadata exposure (display name, file extensions, descriptions)
- Tests dependency reporting and installation instruction generation

## Public API Surface

### Entry Points
- Integration test suite accessible via standard test runners (vitest)
- Mock adapter factory for isolated testing scenarios
- Environment configuration utilities for test setup

### Test Configuration
- **Test Port**: 48766 for consistent network testing
- **Session ID**: 'session-go-smoke' for test identification
- **Sample Paths**: References to examples/go/ directory for realistic testing

## Internal Organization

### Data Flow
1. **Setup Phase**: Mock dependencies created with no-op implementations
2. **Environment Management**: DLV_PATH variable controlled for test isolation  
3. **Test Execution**: Various adapter methods tested in isolation
4. **Validation**: Results compared against expected command structures and configurations

### Testing Patterns
- **Isolation Strategy**: Mock processLauncher prevents actual process execution
- **File System Mocking**: All file operations return controlled values
- **Environment Control**: Real process.env access but with controlled DLV_PATH

## Important Conventions
- Uses fake DLV path (process.execPath) as mock delve binary for testing
- Maintains realistic command structures while preventing actual debugger launches
- Follows standard vitest testing patterns and assertions
- Ensures all adapter functionality is testable without external Go/Delve installations

## Dependencies
- **@debugmcp/adapter-go**: Core Go adapter implementation being tested
- **@debugmcp/shared**: Shared types and interfaces (AdapterDependencies)
- **vitest**: Testing framework for execution and assertions
- **Node.js built-ins**: fs, path modules for file system operations

This directory serves as the integration testing gateway for the Go adapter, ensuring reliable functionality across different configuration scenarios while maintaining complete isolation from external dependencies.