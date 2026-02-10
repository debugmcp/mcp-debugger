# mcp_debugger_launcher/tests/test_launcher.py
@source-hash: 1b81f3b89c6d6785
@generated: 2026-02-10T00:41:45Z

## Purpose and Responsibility
Test suite for the debug-mcp-server launcher package. Validates runtime detection, command generation, and CLI module functionality through manual testing with console output.

## Key Functions and Their Roles

### `test_runtime_detection()` (L11-43)
Tests the RuntimeDetector class functionality by:
- Checking individual runtime availability (Node.js, npx, Docker)
- Running full runtime detection
- Testing recommendation logic
- Returns detected runtimes dict for further use

### `test_dry_run()` (L45-66)
Tests command generation without execution by:
- Creating DebugMCPLauncher instance with verbose mode
- Displaying NPX commands for stdio and SSE modes
- Displaying Docker commands for stdio and SSE modes
- Demonstrates proper command construction patterns

### `test_cli_import()` (L68-81)
Validates CLI module integration by:
- Testing import of cli module
- Extracting version and main function information
- Returns boolean success status for summary

### `main()` (L83-110)
Orchestrates the complete test suite:
- Runs all test functions sequentially
- Provides summary of runtime availability
- Reports CLI module status
- Suggests manual testing commands for actual launcher

## Dependencies and Imports
- **RuntimeDetector** (L8): Core runtime detection functionality
- **DebugMCPLauncher** (L9): Main launcher class for command generation
- **cli module** (L74): CLI entry point module (tested via import)

## Architecture and Patterns
- **Manual test framework**: Uses print statements rather than unittest/pytest
- **Integration testing**: Tests actual system dependencies (Node.js, Docker)
- **Dry run validation**: Tests command construction without execution
- **Graceful failure**: Continues testing even if components fail

## Key Constants and Configuration
- Uses `launcher.NPM_PACKAGE` and `launcher.DOCKER_IMAGE` from DebugMCPLauncher
- Tests both stdio and SSE modes with port 8080
- Verbose mode enabled for detailed output

## Critical Behavior Notes
- Path manipulation (L5-6) ensures local imports work correctly
- Tests validate actual system state rather than mocked dependencies
- No automated assertions - relies on manual verification of output
- Provides actionable next steps for manual testing