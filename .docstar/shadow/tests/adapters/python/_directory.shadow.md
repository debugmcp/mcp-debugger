# tests\adapters\python/
@children-hash: 208d63163778485f
@generated: 2026-02-15T09:01:45Z

## Test Suite for MCP Python Debug Adapter

**Purpose**: Comprehensive testing module for the MCP (Model Context Protocol) Python debug adapter, providing both unit-level validation of Python utility functions and integration-level testing of complete debugging workflows. This test directory ensures the adapter can reliably discover Python installations, establish debug sessions, and execute debugging operations across different platforms and environments.

### Key Components and Architecture

#### Unit Test Layer (`unit/`)
- **python-utils.test.ts**: Core unit tests for Python executable discovery, version detection, and command finder functionality
- **Cross-platform validation**: Tests Python interpreter discovery across Windows, Linux, and macOS with platform-specific command prioritization
- **Mock-based testing**: Uses sophisticated mocking of child_process and command finders to simulate various Python environments without requiring actual installations
- **Environment isolation**: Ensures test independence through proper cleanup of environment variables and global state

#### Integration Test Layer (`integration/`)
- **env-utils.ts**: Python environment management utilities that discover and configure Python installations with debugpy support
- **python-discovery.test.ts**: Real-world Python discovery validation using actual MCP client-server communication
- **python_debug_workflow.test.ts**: Complete debugging workflow testing including session lifecycle, breakpoints, and variable inspection
- **Real implementation testing**: Explicitly avoids mocking to validate actual Python discovery and debugging in CI environments

### Component Relationships and Data Flow

1. **Foundation Layer**: Unit tests validate the core Python utility functions that form the basis of the adapter's Python interaction capabilities
2. **Discovery Layer**: Integration tests build on these utilities to test real Python executable discovery through MCP protocol communication
3. **Workflow Layer**: Complete debugging scenarios exercise the full stack from Python discovery through active debugging sessions

The integration components work synergistically:
- `env-utils.ts` prepares Python environments for testing
- `python-discovery.test.ts` validates the adapter can find prepared Python installations
- `python_debug_workflow.test.ts` exercises complete debugging functionality using discovered Python interpreters

### Public Testing Interface

#### Key Test Categories
- **Cross-platform Python discovery**: Validates executable finding across Windows, Linux, and macOS
- **Version detection and parsing**: Tests Python version extraction from various output formats
- **Environment variable handling**: Validates precedence of PYTHON_PATH, PYTHON_EXECUTABLE, and system PATH
- **Debug session lifecycle**: Tests session creation, breakpoint management, execution control, and variable inspection
- **Error handling and recovery**: Comprehensive failure scenarios and graceful degradation

#### Test Execution Patterns
- **Platform-specific execution**: Windows-focused integration tests due to Python discovery complexity
- **Conditional execution**: Tests tagged with `@requires-python` for runtime dependency management
- **Extended timeouts**: Configured for real process spawning and network communication (30-60s)
- **Failure diagnostics**: Automatic logging to `logs/tests/adapters/failures/` for CI debugging

### Dependencies and Integration Points

#### Core Dependencies
- **@debugmcp/adapter-python**: The primary module under test
- **MCP SDK**: Client libraries for protocol communication in integration tests
- **VS Code Debug Protocol**: Types and interfaces for debugging structures
- **MockCommandFinder**: Test utility for command discovery simulation

#### Testing Infrastructure
- **Vitest**: Primary test framework with lifecycle management
- **Child process mocking**: Sophisticated subprocess simulation for unit tests
- **MCP client-server communication**: Real protocol testing in integration scenarios
- **Python runtime dependency**: Actual Python installation required for integration tests

This test directory provides comprehensive coverage of the MCP Python debug adapter, from low-level utility functions to complete debugging workflows, ensuring reliability across diverse Python environments and system configurations.