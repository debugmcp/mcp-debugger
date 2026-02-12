# tests\adapters\python\integration/
@generated: 2026-02-12T21:05:46Z

## Integration Test Suite for Python Debug Adapter

**Purpose**: Comprehensive integration test module that validates the Python debug adapter's real-world functionality through the MCP (Model Context Protocol). Tests the complete debugging workflow from Python environment discovery to full debug session lifecycle without mocking dependencies.

### Core Components

**env-utils.ts** - Python environment management utility specifically designed for Windows CI environments:
- Discovers and validates Python installations with debugpy support
- Implements prioritized search strategy (GitHub Actions locations, toolcache)
- Automatically installs debugpy when missing
- Manages PATH modifications for proper Python accessibility

**python-discovery.test.ts** - Integration test for Python executable discovery:
- Tests real Python discovery logic without mocking on Windows systems
- Validates PATH-based Python resolution through MCP server communication
- Handles CI-specific environment challenges (Python off PATH, Microsoft Store redirects)
- Uses dry-run mode to test executable resolution without launching processes

**python_debug_workflow.test.ts** - Full debug session lifecycle integration test:
- Complete debugging workflow: session creation → breakpoints → execution → inspection → cleanup
- Tests stack frame analysis, variable examination, and scope inspection
- Validates both normal and dry-run debugging modes
- Comprehensive error handling with CI-specific debugging support

### Public API & Entry Points

**Primary Test Suites**:
- `Python Discovery - Real Implementation Test` - Validates Python executable discovery
- `Python Debugging Workflow - Integration Test` - Tests complete debug session functionality

**Key Utilities**:
- `ensurePythonOnPath(env)` - Main environment setup function for Windows CI
- `parseToolResult(result)` - MCP response parsing utility
- `waitForStackFrames()` - Polling mechanism for asynchronous debug operations
- `persistFailurePayload()` - CI debugging support with failure logging

### Internal Organization & Data Flow

1. **Environment Setup**: `env-utils.ts` ensures Python with debugpy is available and properly configured on PATH
2. **Discovery Testing**: `python-discovery.test.ts` validates that the adapter can find Python installations in CI environments
3. **Workflow Testing**: `python_debug_workflow.test.ts` exercises the full debug protocol through MCP communication

**Communication Pattern**:
- Tests communicate with debug server via MCP protocol using StdioClientTransport
- Server spawned as child process at `../../../../dist/index.js`
- All interactions use MCP tool calling pattern with JSON response parsing

### Important Patterns & Conventions

**Windows-Centric Design**: Primary focus on Windows environments where Python discovery is most complex (toolcache locations, PATH issues, Microsoft Store redirects)

**No Mocking Strategy**: Deliberately tests real implementations to validate actual CI/production behavior

**Comprehensive Error Logging**: Extensive debugging support with failure payload persistence for CI environments (`logs/tests/adapters/failures/`)

**Timeout Management**: Carefully configured timeouts (5s for checks, 120s for installations, 30s for connections)

**MCP Protocol Integration**: Uses Model Context Protocol for debug adapter communication rather than direct Debug Adapter Protocol

### Dependencies & Requirements

- **Runtime**: Requires actual Python installation (tagged with `@requires-python`)
- **Test Framework**: Vitest with extended timeouts for integration scenarios  
- **MCP SDK**: Client and transport layers for server communication
- **Target Script**: `tests/fixtures/python/debug_test_simple.py` for debugging validation
- **VS Code Debug Protocol**: Types and interfaces for debug session management

This module serves as the critical validation layer ensuring the Python debug adapter works reliably across different Python installations and CI environments, particularly focusing on the challenging Windows deployment scenarios.