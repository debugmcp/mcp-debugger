# tests\test-utils\fixtures\python/
@generated: 2026-02-12T21:05:42Z

## Python Test Fixtures for Debugging and Process Testing

This directory provides test fixture utilities for debugging scenarios, process monitoring, and debugger attachment testing within the MCP (Model Context Protocol) test suite.

### Overall Purpose

The module serves as a collection of Python test fixtures specifically designed to support debugging workflows and long-running process testing. It provides both simple debug targets and sophisticated debugging server implementations to validate debugger attachment, process monitoring, and DAP (Debug Adapter Protocol) client-server interactions.

### Key Components

**debug_test_simple.py**
- Basic debug target fixture with predictable execution flow
- Extended runtime (60-second sleep) for external tool attachment
- Simple computation functions for verification and breakpoint testing
- Ideal for testing debugger attachment to running processes

**debugpy_server.py**
- Full-featured debugpy server implementation for DAP testing
- Configurable host/port binding with CLI interface
- Fibonacci test scenarios with programmatic breakpoints
- Designed for MCP server debugging validation

### Public API Surface

**Entry Points:**
- `debug_test_simple.py`: Direct execution for simple debug scenarios
- `debugpy_server.py`: CLI-driven debugpy server with multiple execution modes

**Key Functions:**
- `start_debugpy_server(host, port, wait_for_client)`: Primary server initialization
- `run_fibonacci_test()`: Programmatic breakpoint testing scenario
- `sample_function()`: Basic computation for simple debugging

**Configuration:**
- Default debugpy server: 127.0.0.1:5679
- Configurable wait behaviors and execution modes

### Internal Organization

The fixtures follow a progression from simple to complex:

1. **Simple Target** (`debug_test_simple.py`): Minimal debug target with extended lifetime
2. **Advanced Server** (`debugpy_server.py`): Full DAP server with test scenarios

### Data Flow

**Simple Debug Flow:**
1. Display system information → Execute sample computation → Extended sleep for attachment

**Debugpy Server Flow:**
1. Parse CLI arguments → Initialize debugpy server → Optional client wait → Execute test scenarios or run indefinitely

### Important Patterns

- **Extended Lifetime Pattern**: Both fixtures use sleep mechanisms to remain active for external tool attachment
- **Graceful Error Handling**: Import validation and connection error management
- **Configurable Behavior**: CLI-driven configuration for different test scenarios
- **Standard Debug Ports**: Uses non-conflicting ports (5679) to avoid interference with development environments

### Test Context

These fixtures support testing of:
- Debugger attachment to running Python processes
- DAP client-server communication patterns
- MCP server debugging capabilities
- Process monitoring and lifecycle management
- Breakpoint functionality and step-through debugging

The directory enables comprehensive testing of debugging workflows from simple process attachment to sophisticated DAP protocol interactions.