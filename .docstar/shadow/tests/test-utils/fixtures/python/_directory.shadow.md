# tests/test-utils/fixtures/python/
@generated: 2026-02-11T23:47:37Z

## Test Fixtures for Python Debugging and Process Testing

This directory contains Python test fixture scripts designed to support debugging capabilities and process monitoring tests within the MCP (Model Context Protocol) testing framework.

### Overall Purpose
The fixtures provide controlled test environments for:
- **Debugger attachment testing** - Long-running processes that external debuggers can attach to
- **Debug server functionality** - DAP (Debug Adapter Protocol) server setup for MCP server debugging
- **Process lifecycle testing** - Predictable execution patterns for monitoring and interaction testing

### Key Components

**debug_test_simple.py** - Basic Debug Target
- Simple, long-running process (60-second lifetime) for debugger attachment testing
- Provides predictable execution flow with basic computation and status output
- Designed as a debugging target that remains active long enough for external tools to connect

**debugpy_server.py** - Debug Server Fixture  
- Full-featured debugpy server implementation for MCP server debugging tests
- Configurable host/port binding (defaults to localhost:5679)
- Multiple execution modes: persistent server mode and test scenario mode with breakpoints
- CLI interface for flexible test configuration

### Public API Surface

**Entry Points:**
- `debug_test_simple.py` - Direct execution as debug target process
- `debugpy_server.py` - CLI-driven debug server with multiple modes:
  - Server mode: `python debugpy_server.py [--host HOST] [--port PORT] [--no-wait]`
  - Test mode: `python debugpy_server.py --run-test`

**Configuration Options:**
- Host/port binding configuration for network setup
- Client connection wait behavior control
- Test scenario execution with programmatic breakpoints

### Internal Organization

The fixtures follow complementary patterns:
1. **Simple Target Pattern** (`debug_test_simple.py`) - Minimal debug target for basic attachment testing
2. **Server Pattern** (`debugpy_server.py`) - Full DAP server implementation for comprehensive debugging workflows

### Data Flow
- Both fixtures provide controlled execution environments with predictable timing
- `debug_test_simple.py` offers linear execution with extended runtime for external attachment
- `debugpy_server.py` implements proper server-client architecture where it acts as the DAP server and external MCP servers connect as clients

### Important Patterns
- **Extended Runtime Pattern** - Both fixtures use sleep mechanisms to provide sufficient time for external tool interaction
- **Status Reporting** - Output messages for test verification and debugging progress tracking
- **Graceful Configuration** - CLI-driven configuration with sensible defaults and error handling
- **Proper DAP Architecture** - Correct implementation of debugpy server pattern (not client) for MCP debugging scenarios

These fixtures collectively support comprehensive testing of debugging capabilities, process monitoring, and DAP protocol interactions within the MCP ecosystem.