# mcp_debugger_launcher\tests/
@generated: 2026-02-12T21:05:40Z

## Purpose and Responsibility
Test suite directory for the mcp-debugger-launcher package. Contains manual integration tests that validate the core functionality of the debug launcher system, including runtime detection, command generation, and CLI integration. Designed to verify that the launcher can properly detect system dependencies and construct appropriate debugging commands.

## Key Components and Organization
**test_launcher.py**: Main test file containing all test functions for the launcher package. Implements manual testing approach with console output rather than automated test frameworks.

## Public API Surface
**main()**: Primary entry point that orchestrates the complete test suite and provides comprehensive status reporting.

Individual test functions available for targeted testing:
- **test_runtime_detection()**: Validates RuntimeDetector functionality
- **test_dry_run()**: Tests command generation without execution
- **test_cli_import()**: Verifies CLI module integration

## Internal Data Flow
1. **Runtime Detection Phase**: Tests system availability of Node.js, npx, and Docker
2. **Command Generation Phase**: Validates NPX and Docker command construction for both stdio and SSE modes
3. **CLI Integration Phase**: Confirms proper module imports and version detection
4. **Summary Reporting**: Aggregates results and provides actionable feedback

## Testing Architecture and Patterns
**Manual Integration Testing**: Uses console output and human verification rather than automated assertions. This approach allows for real-time validation of system dependencies and generated commands.

**Graceful Degradation**: Tests continue execution even when individual components fail, providing complete system status overview.

**Dry Run Validation**: Tests command construction without actual execution, preventing side effects while validating logic.

## Key Dependencies
- **RuntimeDetector**: System dependency detection
- **DebugMCPLauncher**: Core launcher functionality with NPM package and Docker image references
- **CLI module**: Command-line interface integration

## Critical Behaviors
- Path manipulation ensures proper local module imports
- Tests validate actual system state rather than mocked environments  
- Provides clear next-step guidance for manual validation of generated commands
- Supports both stdio and SSE debugging modes with configurable port settings

## Usage Context
Intended for developer validation during development and CI/CD processes. Outputs actionable commands that can be manually executed to verify end-to-end launcher functionality. Essential for ensuring the launcher works correctly across different system configurations and runtime environments.