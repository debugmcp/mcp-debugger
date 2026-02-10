# tests/test-utils/fixtures/python/debugpy_server.py
@source-hash: 7558beaff6bfb3b2
@generated: 2026-02-10T00:41:20Z

## Debugpy Server Test Fixture

A test utility script that sets up a debugpy server for testing MCP (Model Context Protocol) server debugging capabilities. Implements the correct debugpy usage pattern where this script acts as the debug server and external MCP servers connect as DAP clients.

### Key Configuration
- **DEFAULT_HOST** (L22): "127.0.0.1" - localhost binding
- **DEFAULT_PORT** (L23): 5679 - non-standard port to avoid conflicts

### Core Functions

**start_debugpy_server(host, port, wait_for_client)** (L25-53)
- Primary server initialization function
- Uses `debugpy.listen()` to start server in listening mode (L41)
- Optional client wait via `debugpy.wait_for_client()` (L47)
- Returns boolean success status

**fibonacci(n)** (L55-70)
- Simple test function for debugging demonstrations
- Iterative Fibonacci calculation with debug output
- Provides predictable execution flow for breakpoint testing

**run_fibonacci_test()** (L72-82)
- Test scenario with programmatic breakpoint
- Sets breakpoint via `debugpy.breakpoint()` (L75)
- Executes fibonacci(10) for debugging practice

### CLI Interface (L84-111)
- **--host**: Override default host
- **--port**: Override default port (5679)
- **--no-wait**: Skip client connection wait
- **--run-test**: Execute fibonacci test scenario

### Execution Modes
1. **Server Mode** (default): Runs indefinitely waiting for connections
2. **Test Mode** (--run-test): Executes fibonacci test with breakpoint

### Dependencies
- **debugpy**: Core debugging protocol implementation
- **argparse**: CLI argument parsing
- **time**: Sleep operations for server persistence

### Architecture Notes
- Follows correct debugpy server pattern (not client)
- Designed for external MCP server DAP client connections
- Graceful error handling with import validation
- Configurable wait behavior for different test scenarios