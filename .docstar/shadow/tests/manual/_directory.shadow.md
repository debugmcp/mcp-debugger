# tests/manual/
@generated: 2026-02-10T21:26:17Z

## Overall Purpose
The `tests/manual` directory contains standalone test scripts for validating core system components through interactive testing and debugging. These scripts are designed for manual execution during development to test SSE (Server-Sent Events) connections, debugpy adapter integration, and PythonDebugger instantiation.

## Key Components and Organization

### SSE Protocol Testing Suite
Three complementary scripts validate different aspects of SSE communication:

- **test-sse-connection.js**: Basic SSE connectivity test using EventSource API with session-based authentication
- **test-sse-protocol.js**: Low-level SSE protocol implementation with manual HTTP parsing and JSON-RPC integration
- **test-sse-working.js**: Complete SSE handshake validation including session extraction and authenticated API calls

All scripts target `localhost:3001/sse` and test the bidirectional communication pattern (SSE for server-to-client, HTTP POST for client-to-server) with session ID correlation.

### Python Debugger Testing
Two scripts for debugpy adapter validation:

- **test_debugpy_launch.ts**: Full lifecycle test of debugpy.adapter subprocess with process monitoring and cleanup
- **test_python_debugger_instantiation.ts**: Basic constructor validation for PythonDebugger class

Both use hardcoded Windows Python paths (`C:\Python313\python.exe`) and focus on different aspects of the debugging infrastructure.

## Communication Patterns

### SSE Protocol Flow
1. Establish SSE connection to server endpoint
2. Parse incoming events for `connection/established` or `endpoint` messages
3. Extract session ID from server response
4. Send authenticated JSON-RPC requests using `X-Session-ID` header
5. Monitor bidirectional communication for validation

### Process Management
- Subprocess spawning with comprehensive stdio monitoring
- Graceful termination with SIGTERM signals
- Session-based logging in temporary directories
- Event-driven process lifecycle management

## Key Testing Scenarios

### Network Communication
- SSE connection establishment and persistence
- Session-based authentication flows
- JSON-RPC 2.0 protocol compliance (`tools/list` method calls)
- Error handling and connection resilience

### Debugger Integration
- Python debugger adapter subprocess management
- Configuration validation and process initialization
- Log directory setup and file system operations
- Constructor validation and error boundary testing

## Architecture Notes
- Manual execution scripts (not automated test suite)
- Platform-specific hardcoded paths for Python interpreter
- Defensive programming with comprehensive error handling
- Long-running processes requiring manual termination (Ctrl+C)
- Temporary file management with session-based naming conventions

## Usage Context
These scripts serve as development tools for:
- Validating SSE server implementations during development
- Testing debugger adapter integration before production deployment
- Debugging communication protocols and session management
- Verifying subprocess lifecycle management and cleanup procedures

All scripts are designed to run independently and provide verbose console output for manual observation and debugging.