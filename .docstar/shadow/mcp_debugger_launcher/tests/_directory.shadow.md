# mcp_debugger_launcher/tests/
@generated: 2026-02-10T01:19:36Z

## Purpose and Responsibility
The tests directory contains the test suite for the debug-mcp-server launcher package. This module provides comprehensive validation of the launcher's core functionality through manual integration testing, focusing on runtime detection, command generation, and CLI module integrity.

## Key Components and Organization

### Primary Test Module: `test_launcher.py`
Contains a manual test framework that validates three critical aspects of the launcher:
- **Runtime Detection Testing**: Validates availability of Node.js, npx, and Docker environments
- **Command Generation Testing**: Tests dry-run command construction for both NPX and Docker execution modes
- **CLI Module Integration Testing**: Ensures the CLI entry point module can be imported and accessed correctly

## Public API and Entry Points

### Main Test Orchestration
- **`main()` function**: Primary entry point that runs the complete test suite sequentially
- Provides summary output of system capabilities and launcher readiness
- Suggests manual testing commands for end-to-end validation

### Individual Test Functions
- **`test_runtime_detection()`**: Tests RuntimeDetector class functionality and returns detected runtime capabilities
- **`test_dry_run()`**: Validates DebugMCPLauncher command generation without execution
- **`test_cli_import()`**: Verifies CLI module accessibility and basic metadata extraction

## Internal Organization and Data Flow

### Test Architecture Pattern
The module follows a **manual integration testing** approach rather than automated unit testing:
1. Tests actual system dependencies (not mocked)
2. Uses console output for validation (no assertions)
3. Provides human-readable feedback for each test phase
4. Continues execution even when individual components fail

### Data Flow
1. Runtime detection tests probe system for available execution environments
2. Command generation tests validate launcher can construct proper NPX and Docker commands
3. CLI import tests ensure the package entry point is accessible
4. Main orchestrator synthesizes results and provides actionable feedback

## Important Patterns and Conventions

### Manual Verification Approach
- Uses print statements instead of automated assertions
- Relies on human inspection of output for validation
- Provides clear pass/fail indicators through console messaging

### Graceful Degradation
- Tests continue running even if dependencies are missing
- Provides informative messages about what functionality is available
- Suggests alternative execution methods based on detected capabilities

### Configuration Testing
- Tests both stdio and SSE modes with standard port (8080)
- Validates command construction for different execution environments
- Uses actual package constants (NPM_PACKAGE, DOCKER_IMAGE) for realistic testing

## Critical Dependencies
- **RuntimeDetector**: Core system dependency detection
- **DebugMCPLauncher**: Main launcher functionality for command generation
- **CLI module**: Package entry point validation

This test suite serves as both validation and documentation of the launcher's capabilities, providing a comprehensive overview of system requirements and expected behavior patterns.