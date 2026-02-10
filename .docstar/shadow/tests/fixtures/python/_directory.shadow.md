# tests/fixtures/python/
@generated: 2026-02-10T21:26:32Z

## Python Test Fixtures Directory

This directory contains Python test fixtures specifically designed for validating debugging workflows and debugger protocol implementations in the MCP Server ecosystem.

### Overall Purpose

The `tests/fixtures/python` directory provides controlled test environments for debugging functionality, containing both debuggee targets and mock debugging infrastructure. These fixtures enable comprehensive testing of debugging capabilities without requiring complex real-world applications.

### Key Components

**Test Target (`debug_test_simple.py`)**
- Simple Python script with predictable execution flow designed as a debuggee target
- Contains strategically placed breakpoint locations and variable scopes for testing debugger inspection capabilities
- Provides both synchronous computation and timed operations to test different debugging scenarios
- Minimal dependencies and linear execution flow to reduce test complexity

**Mock Debug Server (`debugpy_server.py`)**
- Lightweight DAP (Debug Adapter Protocol) server implementation for testing MCP Server debugpy connections
- Handles standard debugging protocol messages without actual debugging capabilities
- Socket-based server with proper DAP message framing and basic capability negotiation
- Supports essential DAP commands: initialize, launch, configurationDone, threads, disconnect

### Public API & Entry Points

**For Debuggee Testing:**
- `debug_test_simple.py` - Execute directly as standalone script or target for external debuggers
- Primary breakpoint target at line 13 (`c = a + b` calculation)
- Predictable output and execution flow for verification

**For Protocol Testing:**
- `debugpy_server.py` - Run as mock DAP server on localhost:5678 (standard debugpy port)
- Command-line interface with `--port` and `--no-wait` options
- Graceful shutdown handling via signal handlers

### Internal Organization

The fixtures follow a complementary design pattern:
- **Target-side testing**: `debug_test_simple.py` provides a controlled debuggee with known execution patterns
- **Server-side testing**: `debugpy_server.py` provides a mock debugging infrastructure for protocol validation

### Data Flow & Integration

1. **Debugging Workflow Tests**: Use `debug_test_simple.py` as target application while testing debugger attachment, breakpoint setting, and variable inspection
2. **Protocol Compliance Tests**: Use `debugpy_server.py` to validate DAP message handling, connection management, and command processing
3. **End-to-End Scenarios**: Combine both fixtures to test complete debugging pipelines from client connection through target execution

### Design Patterns

- **Minimal Dependencies**: Both fixtures use only standard library components to reduce test environment requirements
- **Predictable Behavior**: Deterministic execution flows and responses for reliable test outcomes
- **Protocol Compliance**: Proper DAP message framing and standard debugging port usage
- **Isolation**: Self-contained fixtures that don't interfere with production debugging infrastructure

This directory enables comprehensive validation of debugging features by providing both the target applications to debug and the infrastructure to test debugging protocol implementations.