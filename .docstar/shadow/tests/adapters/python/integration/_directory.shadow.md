# tests\adapters\python\integration/
@children-hash: ccf134b809608548
@generated: 2026-02-15T09:01:29Z

## Integration Test Suite for MCP Python Debug Adapter

**Purpose**: Comprehensive integration testing module for the MCP (Model Context Protocol) Python debug adapter, focusing on real-world Python discovery, environment setup, and full debugging workflow validation. These tests verify the adapter's ability to locate Python installations, establish debug sessions, and execute complete debugging scenarios without mocking.

### Core Components

#### Python Environment Management (`env-utils.ts`)
- **ensurePythonOnPath()**: Main utility function that discovers and configures Python installations with debugpy support for Windows CI environments
- **Python Discovery Strategy**: Implements prioritized search across GitHub Actions variables and toolcache directories
- **PATH Management**: Intelligently modifies environment PATH to ensure debugpy-enabled Python is available
- **Automatic Debugpy Installation**: Falls back to pip installation when debugpy is missing

#### Python Discovery Validation (`python-discovery.test.ts`)  
- **Real Implementation Testing**: Validates Python executable discovery without mocking on Windows systems
- **Environment Filtering**: Tests discovery by removing Python-specific environment overrides
- **MCP Protocol Integration**: Uses MCP client-server communication to test discovery through the actual adapter
- **CI Environment Handling**: Special accommodation for Windows CI where Python may not be on PATH

#### Complete Debug Workflow Testing (`python_debug_workflow.test.ts`)
- **Full Debug Session Lifecycle**: Tests session creation, breakpoint setting, execution control, and variable inspection
- **Stack Frame Inspection**: Validates debugger state and call stack examination
- **Variable Examination**: Tests local variable retrieval and value verification
- **Dry Run Validation**: Ensures dry run mode works correctly for testing scenarios

### Integration Architecture

The components work together to provide comprehensive test coverage:

1. **Environment Preparation**: `env-utils.ts` ensures Python with debugpy is available on PATH
2. **Discovery Validation**: `python-discovery.test.ts` verifies the adapter can find Python installations
3. **Workflow Testing**: `python_debug_workflow.test.ts` exercises the complete debugging functionality

### Key Test Patterns

- **MCP Client-Server Communication**: All tests use MCP protocol via StdioClientTransport to communicate with the debug adapter server
- **Real-World Testing**: Explicitly avoids mocking to test actual Python discovery and debugging
- **CI-Aware Testing**: Includes Windows CI-specific handling and comprehensive failure logging
- **Polling-Based State Verification**: Uses retry mechanisms for asynchronous debug state changes
- **Error Recovery**: Comprehensive error handling with payload persistence for CI debugging

### Public Test Interface

- **Platform-Specific Execution**: Tests are Windows-focused due to Python discovery complexity on that platform
- **Python Runtime Dependency**: Tests tagged with `@requires-python` for conditional execution
- **Extended Timeouts**: Configured for real process spawning and network communication (30-60s)
- **Failure Diagnostics**: Automatic failure payload logging to `logs/tests/adapters/failures/`

### Dependencies and Environment

- **MCP SDK**: Client libraries for protocol communication
- **Vitest**: Test framework with lifecycle management
- **VS Code Debug Protocol**: Types and interfaces for debugging structures
- **Python Runtime**: Requires actual Python installation with debugpy support
- **Node.js Process Management**: Child process spawning and environment manipulation

This integration test suite ensures the MCP Python debug adapter works end-to-end in real environments, particularly focusing on the challenging aspects of Python discovery and debugging workflow reliability across different system configurations.