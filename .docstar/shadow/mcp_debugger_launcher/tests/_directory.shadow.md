# mcp_debugger_launcher\tests/
@generated: 2026-02-12T21:00:54Z

## Overall Purpose and Responsibility
The `tests` directory provides comprehensive validation for the debug-mcp-server launcher package through manual integration testing. Rather than using traditional unit test frameworks, it implements a custom test suite that validates real system interactions including runtime detection, command generation, and CLI functionality.

## Key Components and Architecture

### Test Suite Structure
The directory contains a single comprehensive test module (`test_launcher.py`) that orchestrates multiple test scenarios:

- **Runtime Detection Testing**: Validates the RuntimeDetector's ability to discover Node.js, npx, and Docker installations
- **Command Generation Testing**: Verifies DebugMCPLauncher can construct proper NPX and Docker commands for both stdio and SSE modes
- **CLI Integration Testing**: Ensures the CLI module can be imported and provides expected functionality

### Testing Philosophy
The test suite employs a **manual verification approach** using console output rather than automated assertions. This design choice allows for:
- Real-time validation of actual system dependencies
- Visual inspection of generated commands
- Graceful handling of missing runtime dependencies
- Immediate feedback on launcher functionality

## Public API and Entry Points

### Primary Test Interface
- **`main()` function**: Central orchestrator that runs all test scenarios and provides summary output
- **Individual test functions**: Can be called independently for targeted testing
- **Runtime detection validation**: Tests actual system state for Node.js, Docker availability
- **Command generation verification**: Produces real NPX and Docker commands for manual validation

### Integration Points
- **RuntimeDetector integration**: Tests core dependency detection logic
- **DebugMCPLauncher integration**: Validates command construction for multiple transport modes
- **CLI module integration**: Verifies proper module structure and entry points

## Internal Organization and Data Flow

### Test Execution Flow
1. **Runtime Detection Phase**: Discovers available runtimes and tests recommendation logic
2. **Command Generation Phase**: Creates launcher instances and generates commands in dry-run mode
3. **CLI Validation Phase**: Imports and validates CLI module structure
4. **Summary Phase**: Aggregates results and provides actionable feedback

### Data Dependencies
- Uses actual launcher constants (`NPM_PACKAGE`, `DOCKER_IMAGE`) for realistic testing
- Maintains runtime detection state across test phases
- Provides structured output for manual verification

## Important Patterns and Conventions

### Testing Patterns
- **Integration over isolation**: Tests actual system interactions rather than mocked dependencies
- **Verbose output**: Provides detailed console feedback for manual verification
- **Graceful degradation**: Continues testing even when components fail
- **Real-world validation**: Uses actual runtime environments and command structures

### Error Handling
- Catches import errors gracefully during CLI testing
- Continues test execution even if runtime detection fails
- Provides clear success/failure indicators for each test phase

## Critical Usage Notes
- Designed for manual execution and verification rather than automated CI/CD
- Requires actual system dependencies (Node.js, Docker) for complete validation
- Provides actionable next steps for manual launcher testing
- Path manipulation ensures proper local module imports during development