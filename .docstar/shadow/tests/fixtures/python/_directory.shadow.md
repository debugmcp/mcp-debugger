# tests/fixtures/python/
@generated: 2026-02-09T18:16:05Z

## Purpose
Test fixtures directory for Python debugging workflow validation. Contains essential components for testing debugger integration and Debug Adapter Protocol (DAP) functionality through controlled execution environments.

## Key Components

### Debug Target Fixture (`debug_test_simple.py`)
Simple, predictable Python program designed as a debugging test target:
- Provides clear breakpoint locations with documented line numbers
- Contains local variables for inspection testing
- Implements straightforward execution flow for step-through validation
- Serves as controlled environment for debugger workflow testing

### Mock DAP Server (`debugpy_server.py`) 
Lightweight mock implementation of debugpy server for testing DAP connections:
- Accepts socket connections on localhost:5678
- Implements core DAP command protocol (initialize, launch, configurationDone, threads, disconnect)
- Handles proper DAP message framing with Content-Length headers and JSON payloads
- Provides capability responses for debugger client testing

## Testing Architecture
The components work together to create a complete debugging test environment:

1. **Target Process**: `debug_test_simple.py` runs as the program being debugged
2. **Debug Server**: `debugpy_server.py` simulates the debugging backend
3. **Test Isolation**: Both components use localhost-only connections for security
4. **Protocol Compliance**: Implements DAP specification for compatibility testing

## Public API Surface
- `debug_test_simple.py`: Executable test target with `main()` entry point
- `debugpy_server.py`: Mock server with command-line interface (port configuration, no-wait flag)
- Both files designed as standalone executables with `if __name__ == "__main__"` guards

## Internal Organization
- **Single-threaded design**: Mock server handles one connection at a time
- **Predictable state**: Debug target maintains simple variable states for consistent testing
- **Standard protocols**: Uses TCP sockets and DAP message formatting
- **Graceful handling**: Signal handlers and error handling for robust test execution

## Testing Patterns
- Controlled execution environments with minimal external dependencies
- Clear separation between debug target and debug infrastructure
- Documented breakpoint locations for automated test scenarios
- Mock implementations that simulate real debugging workflows without complexity

This directory provides the essential building blocks for validating Python debugging integrations, offering both the target code to debug and the server infrastructure to handle debug connections.