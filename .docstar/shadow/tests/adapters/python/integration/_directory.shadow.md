# tests/adapters/python/integration/
@generated: 2026-02-10T21:26:30Z

## Python Integration Test Suite

**Purpose**: Comprehensive integration testing module for the Python debugger adapter, validating real-world debugging workflows through MCP (Model Context Protocol) communication without mocks. This test suite ensures the Python adapter can reliably discover Python installations, establish debug sessions, and execute debugging operations across different environments, particularly Windows CI systems.

### Key Components and Their Relationships

**env-utils.ts** - Python Environment Management
- Core utility for ensuring Python installations with debugpy support are available on PATH
- Implements Windows-specific Python discovery with prioritized search strategy
- Handles automatic debugpy installation and PATH manipulation
- Provides foundation for consistent test environment setup

**python-discovery.test.ts** - Python Discovery Validation
- Tests real Python executable discovery without mocks
- Validates system-wide Python detection capabilities
- Focuses on Windows compatibility issues (Microsoft Store python3 redirects)
- Depends on env-utils for environment preparation

**python_debug_workflow.test.ts** - Full Debug Workflow Testing
- Comprehensive end-to-end debugging workflow validation
- Tests complete debug session lifecycle: breakpoints, stack inspection, variable access
- Validates MCP server communication and debug protocol compliance
- Uses env-utils for Python environment setup

### Public API Surface

**Main Entry Points:**
- `ensurePythonOnPath(env)` - Ensures Python with debugpy is available (env-utils)
- Integration test suites that validate:
  - Python executable discovery capabilities
  - Complete debugging workflow operations
  - MCP client-server communication protocols

**Test Utilities:**
- `parseToolResult()` - Extracts JSON from MCP responses
- `waitForStackFrames()` - Polling utility for debug state changes
- `persistFailurePayload()` - CI debugging artifact collection

### Internal Organization and Data Flow

1. **Environment Preparation**: env-utils establishes Python environment with debugpy
2. **Discovery Testing**: python-discovery validates Python executable detection
3. **Workflow Testing**: python_debug_workflow executes complete debugging scenarios
4. **MCP Communication**: All tests use real MCP client-server stdio transport
5. **CI Integration**: Comprehensive logging and failure artifact collection

### Important Patterns and Conventions

**Testing Philosophy**:
- No mocks - tests real implementation behavior only
- Integration over unit testing approach
- CI-first design with extensive diagnostic logging

**Environment Handling**:
- Windows-specific path normalization and Python discovery
- Environment variable filtering for clean subprocess spawning
- Automatic debugpy installation with fallback strategies

**Error Handling**:
- Graceful degradation with comprehensive diagnostic output
- Failure artifact persistence for CI debugging
- Timeout-based polling for async debug operations

**MCP Integration**:
- SDK-based client communication for robust server interaction
- JSON response parsing and validation
- Proper session lifecycle management with cleanup

### System Role

This module serves as the integration testing foundation for Python debugging capabilities, ensuring the adapter works reliably across different Python installations and environments. It validates that the MCP-based architecture can successfully orchestrate debugging sessions from discovery through execution, making it critical for deployment confidence in diverse production environments.