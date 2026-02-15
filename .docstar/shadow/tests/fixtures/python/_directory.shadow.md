# tests\fixtures\python/
@children-hash: 7b3679dc8279a643
@generated: 2026-02-15T09:01:21Z

## Purpose

This directory serves as a Python test fixtures module for debugging workflow validation. It provides essential test components for verifying MCP Server debugging capabilities, including both debuggee targets and mock debugging infrastructure.

## Key Components and Relationships

**Test Target (`debug_test_simple.py`)**
- Simple Python script designed as a debuggee for breakpoint and inspection testing
- Contains predictable execution flow with strategic breakpoint locations
- Provides local variables, computation steps, and timed operations for comprehensive debugging scenario coverage

**Mock Debug Server (`debugpy_server.py`)**
- Minimal DAP (Debug Adapter Protocol) server implementation
- Simulates debugpy server behavior for testing MCP Server debugpy connections
- Handles standard DAP commands (initialize, launch, threads, disconnect) without actual debugging functionality

## Public API Surface

**Primary Entry Points:**
- `debug_test_simple.py`: Standalone executable script via `if __name__ == "__main__"` pattern
- `debugpy_server.py`: Command-line server with configurable port (default 5678)

**Key Integration Points:**
- Line 13 in `debug_test_simple.py` serves as documented breakpoint target
- `debugpy_server.py` listens on standard debugpy port for protocol testing
- Both components use minimal dependencies (standard library only) for test environment compatibility

## Internal Organization and Data Flow

**Test Execution Flow:**
1. `debug_test_simple.py` provides debuggee with predictable execution path
2. `debugpy_server.py` can serve as mock debugging backend
3. Together they enable end-to-end debugging workflow validation

**Data Flow Patterns:**
- Simple Python script executes linear computation and iteration loops
- Mock server handles DAP protocol messages with proper framing and JSON responses
- Both components designed for integration with test harnesses and automated validation

## Important Patterns and Conventions

**Testing Architecture:**
- Fixtures follow minimal dependency principle (standard library only)
- Clear separation between debuggee target and debugging infrastructure
- Predictable execution patterns for reliable test outcomes

**Protocol Compliance:**
- DAP message framing with Content-Length headers
- Standard debugpy port usage (5678)
- Graceful shutdown handling with signal management

**Debugging Support:**
- Strategic breakpoint placement with documentation
- Multiple variable scopes for inspection testing
- Both synchronous and asynchronous operations for step debugging scenarios

This fixture module enables comprehensive testing of MCP Server debugging capabilities by providing both the target code to be debugged and the infrastructure to simulate debugging protocol interactions.