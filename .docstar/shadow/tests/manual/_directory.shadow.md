# tests\manual/
@generated: 2026-02-12T21:05:45Z

## Overall Purpose
This directory contains manual test scripts for validating critical system components including Server-Sent Events (SSE) protocol implementation, Python debugger integration, and real-time bidirectional communication flows. These tests are designed for manual execution during development and debugging rather than automated CI/CD pipelines.

## Key Components and Relationships

### SSE Protocol Testing Suite
Three complementary SSE test scripts validate different aspects of the SSE communication protocol:
- **test-sse-connection.js**: Basic SSE connectivity and session establishment using EventSource API
- **test-sse-protocol.js**: Raw HTTP-level SSE implementation with manual parsing
- **test-sse-working.js**: Complete SSE workflow validation including authentication

These tests work together to validate the entire SSE stack from low-level HTTP parsing to high-level EventSource integration, all targeting the same endpoint (`localhost:3001/sse`).

### Python Debugger Validation
Two TypeScript files test the Python debugging subsystem:
- **test_debugpy_launch.ts**: Process lifecycle testing for debugpy adapter spawning
- **test_python_debugger_instantiation.ts**: Constructor validation for PythonDebugger class

## Public API Surface
All scripts are entry-point executables designed for direct invocation:
- **SSE Tests**: Node.js scripts (`node test-sse-*.js`) for protocol validation
- **Debugger Tests**: TypeScript files requiring compilation before execution
- **Common Pattern**: Each script runs indefinitely or for fixed durations requiring manual termination

## Internal Organization and Data Flow

### SSE Communication Flow
1. **Connection Establishment**: Scripts connect to localhost:3001/sse endpoint
2. **Session Management**: Extract session IDs from SSE events (pattern: `sessionId=([a-f0-9-]+)`)
3. **Authentication**: Use session ID in `X-Session-ID` header for subsequent requests
4. **Protocol Testing**: Send JSON-RPC 2.0 messages (`tools/list` method calls)
5. **Response Monitoring**: Log both SSE events and HTTP responses

### Debugger Testing Flow
1. **Configuration Setup**: Hardcoded Windows Python paths (`C:\Python313\python.exe`)
2. **Process Management**: Spawn debugpy.adapter subprocesses with logging
3. **Lifecycle Monitoring**: Track stdout/stderr streams and process events
4. **Cleanup**: Graceful termination with fallback error handling

## Important Patterns and Conventions

### Error Handling Strategy
- **Defensive Programming**: Null checks and comprehensive error boundaries
- **Logging-First Approach**: Extensive console logging for debugging
- **Graceful Degradation**: Silent failures for non-critical parsing errors

### Session Management
- **UUID-based Sessions**: Session IDs follow UUID format patterns
- **Header-based Authentication**: Custom `X-Session-ID` header for request correlation
- **Timeout-based Sequencing**: Controlled delays between connection steps (1-2 second intervals)

### Configuration Patterns
- **Platform-Specific Paths**: Hardcoded Windows Python executable paths
- **Localhost Testing**: All tests target local development servers (port 3001, 5678)
- **Temporary Resources**: Log directories created in system temp with session prefixes

## Development Usage
These manual tests serve as integration validation tools during development of the SSE communication layer and Python debugging features. They require running local servers and are intended for interactive debugging rather than automated testing.