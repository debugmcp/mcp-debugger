# mcp_debugger_launcher/tests/
@generated: 2026-02-11T23:47:36Z

## Overall Purpose and Responsibility

This test directory contains the manual test suite for the `mcp_debugger_launcher` package. It provides comprehensive validation of the launcher's core functionality through integration testing that checks actual system dependencies rather than using mocked components. The tests are designed for manual verification with console output, focusing on validating runtime detection, command generation, and CLI integration.

## Key Components and Architecture

### Test Structure
- **Single test file**: `test_launcher.py` contains all test functions in a cohesive manual testing framework
- **Manual verification approach**: Uses print statements and console output rather than automated assertions
- **Integration-focused**: Tests against real system state (Node.js, Docker availability) rather than mocked dependencies

### Test Coverage Areas
1. **Runtime Detection Testing**: Validates the `RuntimeDetector` class functionality for Node.js, npx, and Docker availability
2. **Command Generation Testing**: Tests `DebugMCPLauncher` command construction for both stdio and SSE modes without execution
3. **CLI Integration Testing**: Verifies the importability and basic structure of the CLI module

## Public API and Entry Points

### Main Test Functions
- `test_runtime_detection()`: Primary test for runtime availability checking and recommendation logic
- `test_dry_run()`: Core test for command generation patterns (NPX and Docker commands)
- `test_cli_import()`: Validation test for CLI module integration
- `main()`: Test orchestrator that runs all tests and provides summary output

### Key Dependencies Tested
- **RuntimeDetector**: Tests core runtime detection functionality
- **DebugMCPLauncher**: Tests command generation for NPM and Docker execution modes
- **CLI module**: Tests import and basic structure validation

## Internal Organization and Data Flow

1. **Setup Phase**: Path manipulation ensures local imports work correctly
2. **Sequential Testing**: Tests run in order with results feeding into summary
3. **Results Aggregation**: Runtime detection results are collected and reported
4. **Manual Verification**: Output provides actionable commands for further manual testing

## Important Patterns and Conventions

### Testing Patterns
- **Manual test framework**: Prioritizes human-readable output over automated assertions
- **Graceful failure handling**: Tests continue execution even when components fail
- **Real system integration**: Tests actual dependencies rather than mocked interfaces
- **Dry run validation**: Command construction tested without execution for safety

### Configuration Constants
- Tests both stdio and SSE modes with consistent port configuration (8080)
- Uses package constants (`NPM_PACKAGE`, `DOCKER_IMAGE`) for command generation
- Verbose mode enabled for detailed diagnostic output

## Critical Behavior Notes

The test suite is designed as a development and validation tool that provides immediate feedback on system readiness and launcher functionality. It serves as both a testing framework and a diagnostic tool for developers working with the MCP debugger launcher, emphasizing real-world integration testing over unit test isolation.