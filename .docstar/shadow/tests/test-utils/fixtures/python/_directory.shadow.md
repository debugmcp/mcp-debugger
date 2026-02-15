# tests\test-utils\fixtures\python/
@children-hash: 148fe76b0ef60327
@generated: 2026-02-15T09:01:22Z

## Python Test Fixtures Directory

This directory contains Python test fixture utilities specifically designed for testing debugging capabilities and process monitoring scenarios. The fixtures support both basic debugging attachment scenarios and advanced MCP (Model Context Protocol) server debugging workflows.

### Overall Purpose
Provides standardized test targets and debugging infrastructure for validating:
- Debugger attachment to running Python processes
- DAP (Debug Adapter Protocol) client-server interactions
- Long-running process monitoring and control
- MCP server debugging capabilities

### Key Components

**debug_test_simple.py**
- Basic debugging target with extended runtime (60-second sleep)
- Simple, predictable execution flow for attachment testing
- Minimal dependencies and straightforward code path
- Primary use: Testing debugger attachment to active processes

**debugpy_server.py** 
- Full-featured debugpy server implementation
- Configurable host/port binding (default: 127.0.0.1:5679)
- Built-in test scenarios with programmatic breakpoints
- CLI interface for flexible test configuration

### Public API Surface

**Entry Points:**
- `debug_test_simple.py` - Direct execution as debug target
- `debugpy_server.py` - CLI-driven server with options:
  - `--host HOST` - Server binding address
  - `--port PORT` - Server port (default 5679)
  - `--no-wait` - Skip client connection wait
  - `--run-test` - Execute fibonacci debugging scenario

**Key Functions (debugpy_server.py):**
- `start_debugpy_server(host, port, wait_for_client)` - Server initialization
- `fibonacci(n)` - Test computation with debug output
- `run_fibonacci_test()` - Scenario with programmatic breakpoints

### Internal Organization

**Execution Patterns:**
1. **Simple Target**: `debug_test_simple.py` provides long-running process for external attachment
2. **Server Mode**: `debugpy_server.py` runs as persistent DAP server waiting for client connections
3. **Test Mode**: `debugpy_server.py --run-test` executes predefined debugging scenarios

**Data Flow:**
- Simple fixture: startup → computation → extended sleep → termination
- Server fixture: initialization → client wait → test execution/persistence

### Important Patterns

**Debugger Architecture:**
- Follows correct debugpy server pattern (not client mode)
- Designed for external MCP servers connecting as DAP clients
- Non-standard port (5679) prevents conflicts with development debugging

**Test Design:**
- Predictable execution flows for reliable breakpoint placement
- Extended runtime windows for manual debugging interaction
- Graceful error handling and dependency validation
- Configurable wait behaviors for different test scenarios

### Dependencies
- **debugpy**: Debug Adapter Protocol implementation
- **sys/time**: Basic Python runtime utilities
- **argparse**: CLI interface management

This fixture collection enables comprehensive testing of debugging infrastructure from basic process attachment through advanced DAP client-server interactions.