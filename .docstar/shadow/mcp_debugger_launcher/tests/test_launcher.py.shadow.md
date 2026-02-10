# mcp_debugger_launcher/tests/test_launcher.py
@source-hash: 1b81f3b89c6d6785
@generated: 2026-02-09T18:14:59Z

## Purpose
Test script for validating the debug-mcp-server launcher functionality. Provides comprehensive testing of runtime detection, command generation, and module imports without actually executing server commands.

## Key Components

### Test Functions
- **test_runtime_detection()** (L11-43): Tests runtime environment detection capabilities
  - Validates Node.js/npx availability and versions (L17-25)
  - Checks Docker availability and version (L27-31)
  - Tests full runtime detection and recommendation logic (L34-41)
  - Returns detected runtime information for use by other tests

- **test_dry_run()** (L45-66): Demonstrates command construction without execution
  - Shows NPX commands for stdio and SSE modes (L52-58)
  - Shows Docker commands for stdio and SSE modes with port mapping (L60-66)
  - Uses DebugMCPLauncher instance to access package/image constants

- **test_cli_import()** (L68-81): Validates CLI module importability and basic attributes
  - Attempts to import cli module and access version/main function
  - Returns boolean success status for summary reporting

- **main()** (L83-109): Orchestrates all tests and provides summary
  - Runs all test functions sequentially (L89-91)
  - Evaluates overall system readiness based on runtime availability (L97-100)
  - Provides usage guidance for actual launcher testing (L107-109)

## Dependencies
- **detectors.RuntimeDetector**: Runtime environment detection utilities
- **launcher.DebugMCPLauncher**: Main launcher class for command construction
- **cli**: CLI module for version and main function access

## Architecture Notes
- Uses path manipulation (L5-6) to ensure local module imports work correctly
- Designed as a validation tool rather than unit tests - focuses on integration testing
- Provides human-readable output with clear success/failure indicators
- No actual subprocess execution - purely validation and demonstration

## Key Constants Referenced
- `launcher.NPM_PACKAGE`: NPM package identifier for npx commands
- `launcher.DOCKER_IMAGE`: Docker image identifier for container commands