# tests\manual/
@generated: 2026-02-12T21:00:57Z

## Purpose
Manual testing directory for validating critical system components in isolation. Contains standalone test scripts for SSE (Server-Sent Events) protocol validation, Python debugger instantiation, and debugpy adapter process management. These tests enable manual verification of core functionality during development and debugging.

## Key Components

### SSE Protocol Test Suite
Three complementary scripts test different aspects of Server-Sent Events communication:

- **test-sse-connection.js**: Basic SSE connectivity validation using EventSource API with session-based authentication
- **test-sse-protocol.js**: Raw HTTP implementation of SSE protocol with manual parsing and JSON-RPC integration  
- **test-sse-working.js**: Complete SSE handshake flow testing including session establishment and authenticated API calls

All SSE tests target `localhost:3001/sse` and validate the bidirectional communication pattern: SSE for server-to-client events, HTTP POST for client-to-server JSON-RPC requests.

### Python Debugger Test Suite
Two scripts validate Python debugging infrastructure:

- **test_python_debugger_instantiation.ts**: Constructor validation for PythonDebugger class with minimal configuration
- **test_debugpy_launch.ts**: Full debugpy adapter process lifecycle testing including spawn, logging, and termination

Both use hardcoded Windows Python paths (`C:\Python313\python.exe`) and focus on process management validation.

## Architecture Patterns

### Protocol Testing Strategy
- **Session-based Authentication**: All SSE tests extract and use session IDs from `connection/established` messages
- **JSON-RPC 2.0 Compliance**: Tests validate proper JSON-RPC message formatting and response handling
- **Manual Protocol Implementation**: Raw HTTP parsing enables low-level protocol validation

### Process Lifecycle Management
- **Comprehensive Monitoring**: Tests observe stdout/stderr streams and process events (error, exit, close)
- **Graceful Termination**: Proper cleanup with SIGTERM signals and error handling
- **Logging Integration**: Tests validate log directory creation and file output

## Public API Surface

### Entry Points
Each test script is designed for direct execution:
- SSE tests: Node.js scripts with immediate execution
- Python debugger tests: TypeScript files with direct function invocation

### Test Execution Pattern
1. **Setup Phase**: Configuration creation with hardcoded values
2. **Execution Phase**: Component instantiation or connection establishment  
3. **Observation Phase**: Monitoring with timed delays for manual inspection
4. **Cleanup Phase**: Resource termination and process exit

## Internal Organization

### Data Flow
- **SSE Tests**: EventSource/HTTP → JSON parsing → Session extraction → Authenticated requests
- **Debugger Tests**: Configuration → Process spawn → Stream monitoring → Termination

### Configuration Management
- **Hardcoded Values**: Tests use fixed paths and endpoints for reproducibility
- **Session Management**: Dynamic session ID extraction and correlation
- **Error Boundaries**: Comprehensive error handling with detailed logging

## Important Patterns

### Manual Testing Philosophy
- **Standalone Execution**: Each test runs independently without external test frameworks
- **Observable Behavior**: Console logging and timed delays enable manual verification
- **Platform-Specific**: Windows-centric paths and configurations
- **Development-Focused**: Designed for developer inspection rather than automated CI/CD

### Communication Protocols
- **SSE Protocol**: Server-Sent Events with session-based authentication
- **JSON-RPC 2.0**: Structured API communication over HTTP POST
- **Process Communication**: stdio stream monitoring for subprocess interaction

This directory serves as a critical validation layer for core system functionality, enabling developers to manually verify complex protocol interactions and process management in isolated environments.