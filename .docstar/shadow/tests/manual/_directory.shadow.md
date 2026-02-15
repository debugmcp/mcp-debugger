# tests\manual/
@children-hash: ddacd4406a6f401c
@generated: 2026-02-15T09:01:23Z

## Purpose
Manual testing suite for validating core MCP SDK components and protocols. Contains standalone test scripts for debugging and verifying Server-Sent Events (SSE) communication, Python debugger integration, and bi-directional client-server communication flows.

## Key Components

### SSE Protocol Testing
Three complementary scripts validate different aspects of SSE-based MCP communication:
- **test-sse-connection.js**: High-level EventSource API testing with session management
- **test-sse-protocol.js**: Low-level SSE protocol implementation with manual parsing
- **test-sse-working.js**: Complete SSE handshake flow validation

These scripts test the critical MCP communication pattern:
1. SSE connection establishment to `localhost:3001/sse`
2. Session ID extraction from `connection/established` messages  
3. Authenticated JSON-RPC requests via HTTP POST using `X-Session-ID` headers
4. Bi-directional communication monitoring

### Python Debugger Testing
Two scripts validate Python debugger integration:
- **test_debugpy_launch.ts**: Full debugpy adapter process lifecycle testing
- **test_python_debugger_instantiation.ts**: Basic constructor validation

## Communication Architecture

### Protocol Flow
All SSE tests implement the same core communication pattern:
```
Client → SSE Connection (GET /sse)
Server → connection/established event with session ID
Client → Authenticated JSON-RPC POST with X-Session-ID header
Server → Response handling and ongoing SSE monitoring
```

### Session Management
- Session-based authentication via extracted session IDs
- Session correlation through custom `X-Session-ID` headers
- Persistent SSE connections for server-to-client messaging
- HTTP POST for client-to-server JSON-RPC calls

## Entry Points
- **SSE Testing**: Execute any of the three SSE test scripts for different testing approaches
- **Python Debugger Testing**: Run TypeScript tests for debugger component validation
- **Manual Execution**: All scripts designed for direct execution with console output

## Testing Patterns
- **Manual Observation**: Scripts remain running for live monitoring
- **Comprehensive Logging**: Detailed console output for debugging
- **Error Resilience**: Graceful handling of connection failures and parsing errors  
- **Platform Considerations**: Windows-specific paths in Python debugger tests

## Internal Organization
- **Protocol Validation**: Multiple approaches to SSE testing provide comprehensive coverage
- **Component Isolation**: Each test focuses on specific functionality without cross-dependencies
- **Development Support**: Designed for developer debugging and protocol verification rather than automated CI/CD

## Key Dependencies
- EventSource polyfill for Node.js SSE testing
- Node.js HTTP modules for low-level protocol implementation
- fs-extra and child_process for Python debugger process management
- MCP SDK components for integration testing