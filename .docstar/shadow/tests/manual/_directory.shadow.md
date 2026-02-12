# tests/manual/
@generated: 2026-02-11T23:47:42Z

## Overall Purpose

The `tests/manual` directory contains standalone manual test scripts for validating critical communication protocols and debugging infrastructure. These scripts provide hands-on testing capabilities for Server-Sent Events (SSE) connections, session-based authentication, and Python debugging adapter functionality outside of automated test suites.

## Key Components

### SSE Protocol Testing Suite
Three complementary scripts test different aspects of SSE communication:

- **test-sse-connection.js**: Basic SSE connectivity test using EventSource API with session ID extraction and JSON-RPC communication
- **test-sse-protocol.js**: Low-level SSE protocol implementation with manual parsing and MCP SDK integration patterns  
- **test-sse-working.js**: Complete SSE handshake validation including session establishment and authenticated API calls

### Python Debugger Testing
Two scripts validate debugpy adapter integration:

- **test_debugpy_launch.ts**: Full debugpy process lifecycle testing with subprocess management, logging, and graceful termination
- **test_python_debugger_instantiation.ts**: Basic constructor validation for PythonDebugger class instantiation

## Communication Protocols

### SSE + JSON-RPC Pattern
All SSE tests implement a consistent bi-directional communication pattern:
1. **Connection Phase**: Establish SSE connection to `localhost:3001/sse`
2. **Session Phase**: Extract session ID from `connection/established` or `endpoint` events
3. **Authentication Phase**: Use session ID in `X-Session-ID` header for subsequent HTTP POST requests
4. **API Phase**: Send JSON-RPC 2.0 requests (typically `tools/list` method calls)

### Session Management
- Session IDs extracted via regex patterns from SSE event data
- Session correlation maintained through custom HTTP headers
- Timeout-based sequencing ensures proper connection establishment before API calls

## Internal Organization

### Testing Patterns
- **Manual Execution**: All scripts designed for direct command-line execution with console logging
- **Hardcoded Configuration**: Local development server endpoints (`localhost:3001`) and paths
- **Process Management**: Scripts keep running for observation (require manual termination)
- **Error Resilience**: Comprehensive error handling with detailed logging for debugging

### Data Flow
1. **SSE Stream Processing**: Raw chunk parsing → event extraction → JSON deserialization → session ID extraction
2. **Authentication Flow**: Session establishment → header injection → authenticated API calls
3. **Debugging Flow**: Configuration setup → process spawning → stream monitoring → lifecycle management

## Public Entry Points

### SSE Testing
- Run any SSE test script directly: `node test-sse-*.js`
- Expected server: Local SSE endpoint on port 3001
- Output: Console logs of connection events, session data, and API responses

### Debugger Testing  
- Execute TypeScript tests: `ts-node test_*.ts`
- Prerequisites: Python 3.13+ installed at hardcoded Windows path
- Output: Process lifecycle logs and instantiation validation

## Important Conventions

### Configuration Management
- Hardcoded local development paths and endpoints
- Platform-specific Python interpreter paths (Windows-centric)
- Session-based temporary directory creation for debugger logs

### Protocol Compliance
- JSON-RPC 2.0 message format adherence
- SSE protocol standard implementation (manual and EventSource-based)
- MCP SDK communication pattern following

### Development Workflow
These manual tests serve as:
- **Protocol Validation**: Verify SSE and debugging protocols work end-to-end
- **Integration Testing**: Test real network communication and process management
- **Debugging Tools**: Provide observable test scenarios for troubleshooting communication issues
- **Development Aid**: Quick validation during feature development without full test suite execution