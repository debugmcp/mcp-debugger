# tests/test-utils/fixtures/python/
@generated: 2026-02-09T18:16:10Z

## Overall Purpose
This directory contains Python test fixtures specifically designed for debugging and development testing scenarios within the MCP (Model Context Protocol) test framework. It provides controlled Python environments and debug server infrastructure to support comprehensive debugging integration tests.

## Key Components and Relationships

### Debug Test Target (`debug_test_simple.py`)
- **Purpose**: Minimal, long-running Python process for debugging scenarios
- **Key Features**: 
  - Predictable execution flow with sample_function() providing debuggable units
  - 60-second runtime to maintain process availability for test connections
  - Simple arithmetic operations with local variables for breakpoint testing
  - Self-contained with stdlib-only dependencies

### Debug Server Infrastructure (`debugpy_server.py`) 
- **Purpose**: DAP (Debug Adapter Protocol) server implementation for MCP debugging tests
- **Key Features**:
  - Configurable debugpy server with host/port binding
  - Built-in test payload (Fibonacci calculator) with programmatic breakpoints
  - Command-line interface supporting multiple execution modes
  - Robust error handling and cleanup procedures

## Public API Surface

### Primary Entry Points
- **debugpy_server.py CLI**: Main interface for starting debug servers
  - `--host/--port`: Network configuration
  - `--no-wait`: Non-blocking server startup
  - `--run-test`: Execute test scenarios with breakpoints
- **debug_test_simple.py**: Direct execution for simple debugging targets

### Core Functions
- `start_debugpy_server(host, port, wait_for_client)`: Server initialization
- `run_fibonacci_test()`: Breakpoint-enabled test execution
- `sample_function()`: Basic debuggable unit in simple fixture

## Internal Organization and Data Flow

### Architecture Pattern
The directory implements a **client-server debugging model** where:
1. `debugpy_server.py` acts as the DAP server (listening/waiting)
2. External MCP processes connect as debug clients
3. `debug_test_simple.py` provides simple target processes for basic debugging scenarios

### Execution Flow
1. Test frameworks spawn debug servers using `debugpy_server.py`
2. Servers bind to configurable ports (default: 5679) and await client connections
3. MCP processes under test connect as debug clients
4. Test payloads (Fibonacci, sample_function) provide controllable breakpoint targets
5. Cleanup mechanisms ensure proper resource management

## Important Patterns and Conventions

### Configuration Standards
- Default localhost binding (127.0.0.1:5679) for test isolation
- Non-standard debug ports to prevent conflicts with development environments
- Consistent command-line argument patterns across fixtures

### Test Design Principles
- **Predictable Timing**: Fixed sleep periods and execution flows for test automation
- **Minimal Complexity**: Simple, debuggable code paths to avoid test interference
- **Self-Contained**: No external dependencies beyond Python stdlib and debugpy
- **Graceful Cleanup**: Proper signal handling and resource cleanup patterns

### Error Handling
- Import validation for debugpy availability
- Keyboard interrupt handling for clean server shutdown
- Boolean return codes for programmatic integration

This fixture directory enables comprehensive testing of MCP debugging capabilities by providing both simple debugging targets and full DAP server infrastructure in a controlled, predictable environment.