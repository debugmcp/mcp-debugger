# tests\test-utils\fixtures\python/
@generated: 2026-02-12T21:00:53Z

## Python Test Fixtures Directory

**Purpose**: Contains Python test fixture scripts designed to support debugging and test harness scenarios, particularly for testing debugger attachment, process monitoring, and Debug Adapter Protocol (DAP) integration capabilities within the MCP (Model Context Protocol) testing framework.

**Key Components**:

### Debug Target Fixtures
- **debug_test_simple.py**: Basic debug target with extended runtime (60-second sleep) for testing external debugger attachment and process monitoring
- **debugpy_server.py**: Full-featured debugpy server implementation for testing MCP server debugging capabilities via DAP protocol

### Component Relationships
These fixtures work together to provide a comprehensive debugging test environment:
- `debug_test_simple.py` serves as a simple, long-running target process for basic attachment testing
- `debugpy_server.py` provides sophisticated DAP server functionality for advanced debugging scenarios

### Public API Surface

**debug_test_simple.py**:
- Direct script execution with predictable 60-second runtime
- `sample_function()`: Simple arithmetic function for breakpoint testing

**debugpy_server.py**:
- CLI interface with configurable host/port (default: 127.0.0.1:5679)
- `start_debugpy_server(host, port, wait_for_client)`: Primary server initialization
- `fibonacci(n)`: Test function with debug-friendly execution flow
- Command-line options: `--host`, `--port`, `--no-wait`, `--run-test`

### Internal Organization

**Execution Patterns**:
1. **Simple Debug Target**: Immediate execution with extended sleep for external attachment
2. **DAP Server Mode**: Persistent server waiting for external MCP client connections
3. **Interactive Test Mode**: Programmatic breakpoint scenarios with fibonacci calculations

**Data Flow**:
- Simple fixture: Linear execution with status output
- Debugpy server: Event-driven server accepting DAP client connections
- Both provide predictable execution contexts for debugging verification

### Important Patterns

**Debugging Architecture**: Implements correct debugpy server pattern where test fixtures act as debug servers and external MCP servers connect as DAP clients, avoiding common client/server confusion.

**Test Isolation**: Each fixture provides distinct debugging scenarios:
- Basic process attachment (simple)
- Advanced DAP protocol testing (server)
- Configurable runtime behavior for different test requirements

**Error Handling**: Graceful degradation with import validation and connection error handling to ensure test reliability.

This directory provides essential infrastructure for testing debugging capabilities within the MCP ecosystem, supporting both basic attachment scenarios and sophisticated DAP protocol interactions.