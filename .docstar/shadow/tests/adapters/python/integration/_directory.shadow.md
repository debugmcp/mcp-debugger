# tests/adapters/python/integration/
@generated: 2026-02-10T01:19:40Z

## Python Integration Test Suite

**Purpose**: Comprehensive integration testing module for Python debugging functionality in the MCP (Model Context Protocol) debugger adapter. This test suite validates real Python discovery, environment setup, and end-to-end debugging workflows without mocking the underlying Python runtime.

### Core Components

**env-utils.ts**: Python environment management utility that ensures debugpy-enabled Python installations are available on PATH. Implements Windows-specific discovery logic with fallback installation capabilities, targeting CI environments where Python may be present but not properly configured.

**python-discovery.test.ts**: Integration test specifically focused on validating Python executable discovery mechanisms. Tests the real (unmocked) Python detection process across platforms, with special handling for Windows Microsoft Store redirect issues.

**python_debug_workflow.test.ts**: End-to-end debugging workflow integration test that validates complete debugging sessions including breakpoint management, stack inspection, variable evaluation, and state transitions through the MCP protocol.

### Integration Architecture

The components form a layered testing infrastructure:

1. **Environment Layer** (`env-utils.ts`): Provides foundational Python environment discovery and setup
2. **Discovery Layer** (`python-discovery.test.ts`): Validates the environment layer's Python detection capabilities  
3. **Workflow Layer** (`python_debug_workflow.test.ts`): Tests complete debugging functionality using the established environment

### Key Testing Patterns

**Real Implementation Testing**: All tests explicitly avoid mocking to validate actual Python runtime interaction and discovery mechanisms. Uses `dryRunSpawn` flag for testing command generation without process execution.

**CI Environment Handling**: Specialized support for GitHub Actions and Windows CI environments where Python installations may not be automatically available on PATH.

**MCP Protocol Integration**: Tests communicate with the debug server through MCP protocol rather than direct Debug Adapter Protocol (DAP), validating the MCP-to-DAP translation layer.

### Public API Surface

**Test Entry Points**:
- `Python Discovery - Real Implementation Test @requires-python`: Core Python discovery validation
- `Python Debug Workflow Integration Test @requires-python`: Complete debugging session testing

**Utility Functions**:
- `ensurePythonOnPath(env)`: Main environment setup function (from env-utils)
- `startTestServer()` / `stopTestServer()`: MCP debug server lifecycle management
- `parseToolResult()`: MCP response parsing utility
- `waitForStackFrames()`: Debugging state synchronization helper

### Dependencies & Constraints

- Requires Python runtime availability (all tests tagged `@requires-python`)
- Uses Vitest testing framework with extended timeouts (30-60 seconds)
- Depends on `@modelcontextprotocol/sdk` for client-server communication
- Requires `debugpy` package for Python debugging functionality
- Windows-specific optimizations for CI environment compatibility

### Error Handling & Debugging

Comprehensive failure logging with CI-specific error persistence (`persistFailurePayload()`), saving detailed test failure data to filesystem for post-CI analysis. Includes diagnostic logging throughout Python discovery and debugging workflows.

This test suite serves as the primary validation layer for Python debugging capabilities in the MCP debugger adapter, ensuring reliable cross-platform operation and proper environment detection in various deployment scenarios.