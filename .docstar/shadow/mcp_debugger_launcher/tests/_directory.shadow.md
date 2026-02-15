# mcp_debugger_launcher\tests/
@children-hash: 11b23c3a84af42f9
@generated: 2026-02-15T09:01:22Z

## Overall Purpose and Responsibility

The `tests` directory contains manual integration test suite for the mcp_debugger_launcher package. Unlike traditional unit tests, this module focuses on system-level validation of runtime environments, command generation, and CLI integration through interactive console output testing.

## Key Components and Architecture

### Test Structure
- **Single test file**: `test_launcher.py` - Comprehensive test suite covering all major launcher functionality
- **Manual testing approach**: Uses print-based validation rather than automated assertions
- **Integration focus**: Tests actual system dependencies and real-world scenarios

### Core Test Areas

**Runtime Detection Testing**
- Validates `RuntimeDetector` class functionality 
- Tests availability of Node.js, npx, and Docker environments
- Verifies recommendation logic for optimal runtime selection
- Returns detected capabilities for downstream validation

**Command Generation Testing** 
- Tests `DebugMCPLauncher` dry-run capabilities
- Validates NPX and Docker command construction
- Covers both stdio and SSE communication modes
- Demonstrates proper parameter handling and verbose output

**CLI Integration Testing**
- Validates CLI module import and version detection
- Tests entry point accessibility and main function availability
- Ensures proper package structure and CLI compatibility

## Public API Surface

### Main Entry Point
- **`main()` function**: Orchestrates complete test suite execution
- Provides comprehensive system validation summary
- Reports runtime availability and CLI status
- Suggests manual testing commands for further validation

### Individual Test Functions
- **`test_runtime_detection()`**: System capability assessment
- **`test_dry_run()`**: Command generation validation  
- **`test_cli_import()`**: CLI module integration check

## Internal Organization and Data Flow

1. **Path Setup**: Ensures local package imports work correctly
2. **Sequential Testing**: Runs detection → command generation → CLI validation
3. **State Sharing**: Runtime detection results inform subsequent tests
4. **Summary Generation**: Aggregates results for actionable insights

## Important Patterns and Conventions

### Manual Testing Philosophy
- Relies on human verification of console output
- Provides detailed verbose logging for troubleshooting
- Focuses on real system integration over mocked scenarios

### Error Handling Strategy
- Graceful failure - continues testing even when components fail
- Clear error reporting with actionable next steps
- Non-blocking validation approach

### Configuration Standards
- Tests standard configurations (stdio/SSE modes, port 8080)
- Uses actual package constants (`NPM_PACKAGE`, `DOCKER_IMAGE`)
- Enables verbose mode for comprehensive output validation

## Testing Methodology

This directory implements a **manual integration testing** approach specifically designed for:
- Validating system-level dependencies
- Testing command construction without execution
- Ensuring CLI packaging and distribution correctness
- Providing human-readable validation output for complex launcher scenarios

The tests serve as both validation tools and documentation of expected launcher behavior in various runtime environments.