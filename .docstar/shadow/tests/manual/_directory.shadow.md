# tests/manual/
@generated: 2026-02-10T01:19:39Z

## Purpose
Manual testing suite for validating core communication protocols and component instantiation in the MCP (Model Context Protocol) system. Contains standalone test scripts for SSE (Server-Sent Events) connections, Python debugger integration, and protocol compliance verification.

## Key Components

### SSE Protocol Testing Suite
Three complementary SSE test scripts validate different aspects of server-sent event communication:

- **test-sse-connection.js**: High-level SSE testing using EventSource polyfill, focuses on session establishment and JSON-RPC communication flow
- **test-sse-protocol.js**: Low-level SSE testing with manual HTTP implementation, validates raw SSE protocol parsing and event handling
- **test-sse-working.js**: Production-like SSE testing with session-based authentication, tests complete handshake and API interaction flows

All scripts target `http://localhost:3001/sse` and implement the same communication pattern:
1. Establish SSE connection
2. Extract session ID from `connection/established` events
3. Send authenticated JSON-RPC `tools/list` requests via HTTP POST
4. Monitor bidirectional communication

### Python Debugger Testing Suite
Two scripts for validating Python debugger component integration:

- **test_debugpy_launch.ts**: Process lifecycle testing for debugpy adapter subprocess management, validates spawning, logging, and graceful termination
- **test_python_debugger_instantiation.ts**: Constructor validation for PythonDebugger class instantiation with minimal configuration

## Public API Surface
All scripts are standalone executables designed for manual testing:

- **SSE Test Scripts**: Direct Node.js execution (`node test-sse-*.js`)
- **Python Debugger Tests**: TypeScript execution requiring compilation or ts-node
- **Entry Points**: Each script contains immediate execution logic or direct function calls

## Internal Organization

### Communication Protocol Patterns
- **Session-Based Authentication**: All SSE tests implement session ID extraction and header-based authentication (`X-Session-ID`)
- **JSON-RPC 2.0 Compliance**: Standardized request/response format across all protocol tests
- **Bidirectional Communication**: SSE for server-to-client, HTTP POST for client-to-server messaging

### Configuration Standards
- **Hardcoded Test Endpoints**: `localhost:3001` for SSE connections, `localhost:5678` for debugpy
- **Platform-Specific Paths**: Windows Python executable paths (`C:\Python313\python.exe`)
- **Logging Integration**: Temporary directory usage with session-based naming conventions

## Important Patterns

### Error Handling
- Comprehensive error logging with context information
- Graceful fallback for JSON parsing failures
- Process lifecycle monitoring with cleanup procedures

### Test Architecture
- **Manual Execution Model**: Scripts run indefinitely for observation, require manual termination (Ctrl+C)
- **Defensive Programming**: Null checks, error boundaries, and fallback mechanisms
- **Development-Focused**: Extensive console logging for debugging and validation

### Protocol Implementation
- **Raw HTTP Implementation**: Manual SSE parsing instead of high-level APIs for protocol validation
- **Connection Lifecycle Management**: Proper setup, monitoring, and teardown procedures
- **Session Correlation**: Consistent session ID handling across request/response cycles

This testing suite serves as both validation infrastructure and reference implementation for MCP protocol compliance, particularly for SSE-based communication and Python debugging integration.