# tests/test-utils/fixtures/python/
@generated: 2026-02-10T01:19:37Z

## Test Fixtures for Python Debugging and Process Testing

This directory contains specialized test fixture scripts designed to support testing of debugging capabilities, process monitoring, and debugger attachment scenarios within the MCP (Model Context Protocol) ecosystem.

### Overall Purpose
The module provides controlled test environments for validating debugging workflows, particularly focused on:
- Debugger attachment and detachment scenarios
- Long-running process monitoring
- Debug server/client communication patterns
- MCP server debugging capabilities

### Key Components

**debug_test_simple.py** - Basic Debug Target
- Simple, predictable execution script for testing debugger attachment
- 60-second runtime window for external tool interaction
- Minimal computation logic for verification and breakpoint testing
- Primary use case: Testing process monitoring and debugger attachment workflows

**debugpy_server.py** - Debug Protocol Server
- Full-featured debugpy server implementation for DAP (Debug Adapter Protocol) testing
- Configurable host/port binding (default: 127.0.0.1:5679)
- Built-in test scenarios with Fibonacci calculations and programmatic breakpoints
- CLI interface for flexible deployment in different test configurations

### Public API Surface

**Command-Line Interfaces:**
- `python debug_test_simple.py` - Launches basic debug target
- `python debugpy_server.py [--host HOST] [--port PORT] [--no-wait] [--run-test]` - Configurable debug server

**Key Entry Points:**
- `start_debugpy_server(host, port, wait_for_client)` - Programmatic server initialization
- `run_fibonacci_test()` - Pre-built debugging scenario with breakpoints
- `fibonacci(n)` - Simple test function for debugging demonstrations

### Internal Organization and Data Flow

**Testing Workflow Pattern:**
1. **Setup Phase**: Initialize debug server or simple target process
2. **Connection Phase**: External debugging tools/MCP servers attach as clients
3. **Execution Phase**: Run test scenarios with predictable breakpoints and outputs
4. **Validation Phase**: Verify debugger interaction and protocol compliance

**Component Relationship:**
- `debug_test_simple.py` serves as a lightweight debug target for basic attachment testing
- `debugpy_server.py` provides comprehensive debugging infrastructure for complex MCP server testing
- Both components support extended execution windows to accommodate external tool interaction

### Important Patterns and Conventions

**Debugger Architecture**: Implements correct debugpy usage where fixture scripts act as debug servers and external MCP processes connect as DAP clients, avoiding common server/client role confusion.

**Configuration Standards**: Uses non-standard port 5679 to prevent conflicts with development debugging sessions, with localhost-only binding for security.

**Error Handling**: Graceful degradation with import validation and boolean status returns for programmatic integration.

**Test Isolation**: Self-contained fixtures with minimal external dependencies, suitable for automated testing pipelines and manual debugging scenarios.