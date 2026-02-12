# tests/fixtures/python/
@generated: 2026-02-11T23:47:36Z

## Python Debugging Test Fixtures

This directory provides Python-based test fixtures specifically designed for validating debugging workflows and debugger protocol implementations within the MCP Server ecosystem.

## Overall Purpose

The directory contains complementary test fixtures that enable comprehensive testing of Python debugging capabilities:

1. **Target Application Testing**: Provides a simple, debuggable Python script for testing debugger attachment and breakpoint functionality
2. **Protocol Server Testing**: Implements a minimal DAP (Debug Adapter Protocol) server for testing debugger protocol communications

## Key Components

### Debug Target (`debug_test_simple.py`)
- **Primary Function**: `sample_function()` - Designed with explicit breakpoint targets and local variables for inspection
- **Entry Point**: `main()` - Orchestrates execution flow with timing controls for step debugging
- **Key Features**: Predictable execution path, strategic breakpoint locations (line 13), multiple variable scopes

### DAP Server Simulator (`debugpy_server.py`)
- **Core Handler**: `handle_connection()` - Implements DAP message parsing and command processing
- **Protocol Support**: Handles standard DAP commands (initialize, launch, configurationDone, threads, disconnect)
- **Communication**: `send_dap_response()` - Manages DAP-compliant message framing with Content-Length headers

## Component Interaction

These fixtures work together to enable end-to-end debugging workflow testing:

1. `debugpy_server.py` can be started as a mock debug server listening on port 5678
2. `debug_test_simple.py` serves as the target application that debuggers can attach to
3. Test harnesses can coordinate between both to validate complete debugging scenarios

## Public API Surface

### Entry Points
- `debug_test_simple.py`: Direct execution via `python debug_test_simple.py`
- `debugpy_server.py`: Server launch via `python debugpy_server.py [--port PORT] [--no-wait]`

### Test Integration Points
- Line 13 in `debug_test_simple.py`: Primary breakpoint target location
- Port 5678: Standard debugpy server endpoint for DAP communication
- Signal handlers: Graceful shutdown capabilities for test cleanup

## Internal Organization

Both fixtures follow standard Python patterns:
- Minimal external dependencies (standard library only)
- Clear separation of concerns between target and server functionality
- Synchronous execution models for predictable test behavior
- Proper error handling and cleanup mechanisms

## Testing Patterns

The directory enables validation of:
- **Debugger Attachment**: Using the simple target script with known execution flow
- **Protocol Compliance**: Via the DAP server implementation with standard command support
- **Variable Inspection**: Through strategically placed local variables and computation steps
- **Session Management**: Including connection establishment, command processing, and clean disconnection