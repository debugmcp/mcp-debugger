# tests\manual/
@children-hash: 75be3a1d9be975cf
@generated: 2026-02-21T08:28:46Z

## Purpose
Manual testing directory containing standalone scripts for validating server communication protocols and debugger component instantiation. Provides hands-on testing utilities for SSE (Server-Sent Events) connections, JSON-RPC communication flows, and Python debugger module validation outside of automated test suites.

## Key Components and Organization

### SSE Connection Testing Suite
Three complementary scripts test different aspects of SSE protocol implementation:

- **test-sse-connection.js**: Basic SSE connectivity test using EventSource API with session-based authentication
- **test-sse-protocol.js**: Low-level SSE protocol implementation with manual chunk parsing and bi-directional communication
- **test-sse-working.js**: Complete SSE handshake validation including session establishment and authenticated API calls

All SSE tests target `localhost:3001/sse` and validate the session-based communication pattern used by the MCP SDK.

### Debugger Component Testing
Two focused tests for Python debugger module validation:

- **test_debugpy_launch.ts**: Full debugpy adapter process lifecycle testing with subprocess management
- **test_python_debugger_instantiation.ts**: Basic constructor validation for PythonDebugger class

## Communication Protocols Tested

### SSE Protocol Flow
1. **Connection Establishment**: HTTP GET to SSE endpoint with proper headers
2. **Session Negotiation**: Extract session ID from `connection/established` or `endpoint` events
3. **Authenticated Communication**: Use session ID in `X-Session-ID` header for JSON-RPC POST requests
4. **Bi-directional Testing**: SSE for server-to-client, HTTP POST for client-to-server

### JSON-RPC Integration
- Implements JSON-RPC 2.0 format with `tools/list` method calls
- Session correlation via custom headers
- Response validation and error handling

## Key Testing Patterns

### Manual Execution Model
- All scripts designed for manual execution with console logging
- Use `process.stdin.resume()` or similar to keep scripts running for observation
- Require manual termination (Ctrl+C) for interactive testing

### Configuration Approach
- Hardcoded test endpoints and paths for consistency
- Windows-specific Python paths (`C:\Python313\python.exe`)
- Localhost testing environment assumptions

### Error Handling Strategy
- Comprehensive logging with prefixed output for easy identification
- Graceful error handling with fallback behaviors
- Process lifecycle monitoring with proper cleanup

## Entry Points
- Each script is self-contained with direct function execution
- No shared utilities or common entry point
- Scripts can be run independently: `node test-sse-*.js` or `ts-node test_*.ts`

## Internal Organization
The directory focuses on two primary testing domains:
1. **Network Communication**: SSE/HTTP protocol validation for server connectivity
2. **Component Instantiation**: Debugger module constructor and lifecycle validation

## Dependencies
- **Network Testing**: Node.js `http`, `eventsource` package, built-in `fetch`
- **Debugger Testing**: Node.js `child_process`, `fs-extra`, internal debugger modules
- **Common**: Standard Node.js modules (`path`, `os`) and TypeScript execution environment

## Testing Philosophy
Emphasizes manual, observable testing over automated assertions. Provides detailed logging and keeps processes alive for human inspection of real-time behavior, making it ideal for debugging integration issues and protocol validation during development.