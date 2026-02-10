# tests/adapters/python/
@generated: 2026-02-10T01:19:59Z

## Python Adapter Test Suite

**Purpose**: Comprehensive test coverage for the Python debugging adapter in the MCP (Model Context Protocol) debugger system. This test directory validates all aspects of Python environment discovery, runtime interaction, and end-to-end debugging workflows across platforms.

### Test Architecture

The test suite is organized into two complementary layers that provide complete validation coverage:

**Unit Tests (`unit/`)**: Fast, isolated tests with comprehensive mocking that validate core utility functions including Python executable discovery, version detection, and cross-platform compatibility. Uses sophisticated mock frameworks to simulate file systems, child processes, and command discovery without external dependencies.

**Integration Tests (`integration/`)**: Real-world validation using actual Python runtimes to test complete debugging workflows. Validates Python environment setup, MCP protocol communication, breakpoint management, and debugging state transitions without mocking the underlying Python runtime.

### Component Relationships

The test layers form a validation pyramid:

1. **Foundation Layer** (unit tests): Validates individual utility functions (`findPythonExecutable`, `getPythonVersion`, command finding)
2. **Environment Layer** (integration env-utils): Ensures Python environments are properly configured for testing
3. **Discovery Layer** (integration discovery): Validates real Python detection mechanisms
4. **Workflow Layer** (integration debugging): Tests complete MCP debugging sessions

### Key Test Entry Points

**Unit Test APIs**:
- `python-utils.test.ts`: Core utility function validation
- Cross-platform compatibility testing (Windows, Linux, macOS)
- Mock-driven error scenario testing

**Integration Test APIs**:
- `Python Discovery - Real Implementation Test @requires-python`: Validates actual Python detection
- `Python Debug Workflow Integration Test @requires-python`: End-to-end debugging validation
- `ensurePythonOnPath()`: Environment setup utility
- MCP debug server lifecycle management functions

### Testing Patterns & Infrastructure

**Mock Strategy** (Unit): EventEmitter-based process simulation, platform isolation, dependency injection patterns for reliable fast testing without external dependencies.

**Real Implementation Testing** (Integration): Explicit avoidance of mocking to validate actual Python runtime interaction, with CI-specific optimizations for GitHub Actions and Windows environments.

**Cross-Platform Support**: Both test layers ensure consistent behavior across operating systems with platform-specific handling for Windows Store aliases, py launcher, and environment detection.

### Public API Surface Tested

The test suite validates the complete public API of the Python adapter:

- **Discovery APIs**: `findPythonExecutable()`, environment variable handling (PYTHON_PATH, PYTHON_EXECUTABLE)
- **Runtime APIs**: `getPythonVersion()`, Python version compatibility validation  
- **Configuration APIs**: `setDefaultCommandFinder()` for dependency injection
- **MCP Protocol APIs**: Debug server communication, breakpoint management, variable evaluation
- **Environment APIs**: Python path discovery, debugpy integration, CI environment handling

### Dependencies & Constraints

- **Runtime Requirements**: Python with debugpy package for integration tests (tagged `@requires-python`)
- **Testing Framework**: Vitest with extended timeouts for integration scenarios
- **Protocol Dependencies**: `@modelcontextprotocol/sdk` for MCP client-server communication
- **CI Optimization**: Windows-specific environment discovery with GitHub Actions support

### Error Handling & Debugging

Comprehensive failure analysis with detailed logging, CI-specific error persistence for post-analysis, and systematic testing of failure modes including missing Python installations, version detection failures, and debugging protocol errors.

This test directory ensures the Python adapter can reliably discover, configure, and debug Python environments across different platforms and deployment scenarios, providing the validation foundation for debugmcp's Python debugging capabilities.