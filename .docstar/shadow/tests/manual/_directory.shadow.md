# tests\manual/
@children-hash: 73d1b6db9757aa2a
@generated: 2026-02-24T01:54:52Z

## Purpose
The `tests/manual` directory contains manual test scripts for validating SSE (Server-Sent Events) connectivity, Python debugger functionality, and real-time communication protocols. These are developer-oriented testing tools designed to verify system components in isolation without automated test frameworks.

## Key Components

### SSE Communication Testing
Three test scripts validate different aspects of SSE protocol implementation:

- **test-sse-connection.js**: Basic SSE connection with EventSource API, tests session establishment and bidirectional communication via SSE + HTTP POST
- **test-sse-protocol.js**: Raw HTTP-based SSE implementation with manual parsing, validates MCP SDK protocol integration
- **test-sse-working.js**: Complete SSE handshake flow testing with session-based authentication and JSON-RPC API calls

All SSE tests target `localhost:3001/sse` and follow a consistent pattern:
1. Establish SSE connection
2. Extract session ID from connection/established messages
3. Send authenticated JSON-RPC requests using extracted session ID
4. Monitor responses and maintain persistent connections

### Python Debugger Testing
- **test_debugpy_launch.ts**: Process lifecycle testing for debugpy adapter subprocess, validates configuration, logging, and process management
- **test_python_debugger_instantiation.ts**: Constructor validation test for PythonDebugger class with minimal configuration

### Configuration
- **tsconfig.test.json**: TypeScript configuration extending main project settings with NodeNext module system and test-specific build output

## Test Architecture

### Communication Protocols
- **SSE Protocol**: Implements session-based authentication with `X-Session-ID` headers
- **JSON-RPC 2.0**: Standard protocol for API communication over HTTP POST
- **Bidirectional Flow**: SSE for server-to-client, HTTP POST for client-to-server

### Process Management
- Scripts use `process.stdin.resume()` or manual termination to keep processes alive for observation
- Comprehensive error handling and lifecycle monitoring
- Defensive programming with null checks and error boundaries

### Dependencies
- Node.js built-in modules: `http`, `child_process`, `fs`, `path`, `os`
- External packages: `eventsource` (for Node.js EventSource polyfill), `fs-extra`
- Internal imports: PythonDebugger classes from main source code

## Usage Patterns
These are standalone manual test scripts intended for:
- Development debugging and validation
- Protocol verification during development
- Component isolation testing
- Manual verification of SSE connectivity and session management
- Process lifecycle validation for debugger components

Each script includes comprehensive console logging with prefixed messages for easy identification and debugging during manual execution.