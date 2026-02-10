# tests/adapters/python/integration/
@generated: 2026-02-09T18:16:11Z

## Integration Test Suite for Python Debug Adapter

**Overall Purpose**: Comprehensive integration testing framework for the MCP Python debug adapter, validating Python environment discovery, debug session lifecycle, and end-to-end debugging workflows in real CI/CD environments.

## Key Components & Architecture

### Python Environment Management (`env-utils.ts`)
Windows-specific utility for ensuring CI environments have functional Python installations with debugpy debugging support. Implements a priority-based discovery system:
1. `PYTHONLOCATION` environment variable (GitHub Actions)
2. Hosted toolcache Python versions (numerically sorted)
3. Fallback chain with debugpy installation attempts

Core functions modify PATH environment to provide clean Python setup for testing, with graceful degradation and comprehensive error handling.

### Discovery Validation (`python-discovery.test.ts`)
Integration test focused on Python interpreter discovery without mocking. Validates that the MCP adapter can find Python executables through automated discovery mechanisms by:
- Creating clean test environments (removes Python env vars)
- Testing discovery through debug session creation with `dryRunSpawn`
- Targeting Windows Microsoft Store Python redirect issues
- Providing CI-specific failure debugging and logging

### Full Workflow Testing (`python_debug_workflow.test.ts`)
Comprehensive integration test suite for complete debug session lifecycle using MCP client SDK:
- Session creation and management
- Breakpoint setting and hit verification  
- Stack frame inspection and variable evaluation
- Execution control (start, continue, close)
- Dry run testing for spawn validation

## Data Flow & Integration

**Test Environment Setup**:
`env-utils.ts` → `python-discovery.test.ts` → `python_debug_workflow.test.ts`

1. **Environment Preparation**: `ensurePythonOnPath()` ensures Windows CI has debugpy-enabled Python
2. **Discovery Validation**: Tests adapter's ability to find Python without explicit configuration
3. **Workflow Testing**: Full debug session operations against real Python scripts

**MCP Communication Pattern**:
All tests use MCP SDK's StdioClientTransport to communicate with debug adapter server, creating realistic integration scenarios that mirror production usage.

## Public API Surface

### Primary Entry Points
- **Environment Setup**: `ensurePythonOnPath(env)` - Modifies environment for Python availability
- **Test Fixtures**: Uses `tests/fixtures/python/debug_test_simple.py` as canonical test script
- **Failure Debugging**: `persistFailurePayload()` for CI diagnostics

### MCP Tool Operations Tested
- `create_debug_session` - Session initialization
- `start_debugging` - Debug execution with dry run support  
- `set_breakpoints` - Breakpoint management
- `get_stack_trace` - Stack inspection
- `get_scopes` / variable evaluation - Runtime state inspection
- `close_debug_session` - Session cleanup

## Testing Patterns & Conventions

**No Mocking Policy**: All tests execute against real Python interpreters and debug adapter implementations to catch environment-specific issues.

**CI-First Design**: Extensive logging, failure persistence, and Windows-specific handling for continuous integration reliability.

**Clean Environment Testing**: Systematic removal of Python environment variables to ensure discovery mechanisms are actually exercised.

**Timeout Management**: Appropriate timeouts (30s connections, 60s test suites) accounting for debug adapter initialization overhead.

**Error Resilience**: Comprehensive error handling with graceful degradation, preventing test suite crashes from environment configuration issues.

This integration test directory serves as the primary validation framework ensuring the Python debug adapter works correctly across diverse deployment environments, with particular emphasis on Windows CI scenarios.