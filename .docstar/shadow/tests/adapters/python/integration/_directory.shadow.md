# tests\adapters\python\integration/
@generated: 2026-02-12T21:00:57Z

## Python Adapter Integration Tests

**Purpose**: Comprehensive integration test suite for the Python debugging adapter within the MCP (Model Context Protocol) ecosystem. This module validates real-world Python environment discovery, debug adapter communication, and complete debugging workflow functionality without mocking.

### Key Components

#### Environment Management (`env-utils.ts`)
Core utility for ensuring Python environments with debugpy support are available, particularly targeting Windows CI environments:
- **Python Discovery Engine**: Implements prioritized search strategy across environment variables and system installations
- **Debugpy Installation**: Automated installation of debugging dependencies via pip
- **PATH Management**: Dynamic PATH manipulation to ensure Python accessibility
- **Windows-Specific Logic**: Handles case-insensitive paths, Microsoft Store Python redirects, and GitHub Actions environments

#### Discovery Testing (`python-discovery.test.ts`) 
Integration test validating Python executable discovery without mocking:
- **Real Implementation Testing**: Tests actual Python discovery logic on Windows systems
- **MCP Client Integration**: Uses stdio transport to communicate with debug server
- **Environment Isolation**: Filters environment variables to force genuine discovery
- **CI-Aware Error Handling**: Special logging and failure persistence for debugging CI issues

#### Workflow Testing (`python_debug_workflow.test.ts`)
End-to-end integration test for complete debugging sessions:
- **Full Debug Lifecycle**: Tests session creation, breakpoints, stack inspection, and variable examination
- **MCP Protocol Communication**: Uses MCP client to interact with debug adapter server
- **Dry Run Validation**: Tests debug configuration without spawning actual processes  
- **Asynchronous State Management**: Implements polling mechanisms for debug state changes

### Integration Architecture

The components work together to provide comprehensive validation:

1. **Environment Setup**: `env-utils.ts` ensures Python is discoverable and properly configured
2. **Discovery Validation**: `python-discovery.test.ts` verifies the adapter can find Python installations
3. **Workflow Testing**: `python_debug_workflow.test.ts` validates complete debugging functionality

### Public API Surface

**Entry Points**:
- `ensurePythonOnPath(env)`: Main utility for Python environment preparation
- Test suites tagged with `@requires-python` for conditional execution
- MCP client integration patterns for debug adapter communication

**Key Test Patterns**:
- Real implementation testing (no mocking)
- CI-aware error handling and logging
- Dry run validation for configuration testing
- Polling mechanisms for asynchronous debug operations

### Internal Data Flow

1. **Environment Preparation** → `env-utils` configures Python PATH and debugpy
2. **Discovery Testing** → Validates Python executable resolution through MCP protocol
3. **Workflow Testing** → Exercises complete debug session lifecycle via MCP client
4. **Error Handling** → Comprehensive logging and failure persistence for CI debugging

### Important Patterns

- **Windows-First Design**: Primary focus on Windows compatibility with CI environment handling
- **MCP Protocol Integration**: Uses Model Context Protocol for debug adapter communication
- **Real Environment Testing**: Deliberately avoids mocking to test actual system behavior
- **Conditional Execution**: Tests tagged for Python runtime requirements
- **Timeout Management**: Appropriate timeouts for network operations and process spawning
- **Failure Diagnostics**: Structured error logging and payload persistence for debugging

This integration test suite ensures the Python debugging adapter works correctly in real-world environments, with particular attention to Windows CI scenarios and MCP protocol communication patterns.