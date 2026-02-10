# tests/manual/
@generated: 2026-02-09T18:16:13Z

## Manual Testing Suite for MCP Development Environment

This directory contains a collection of manual testing scripts for validating core debugging and communication components in the MCP (Model Context Protocol) development environment. The tests focus on transport protocols, debugger integrations, and connection handling across multiple language runtimes.

### Core Purpose and Responsibility
Provides isolated, executable test scripts for diagnosing and validating critical system components during development. Each script targets a specific aspect of the debugging or communication infrastructure, allowing developers to manually verify functionality and troubleshoot issues without full system integration.

### Key Components and Organization

#### Transport and Communication Testing
- **SSE Protocol Tests** (`test-sse-*.js`): Three complementary scripts testing Server-Sent Events communication patterns
  - Connection establishment and session management
  - JSON-RPC 2.0 over SSE with authentication headers
  - Bidirectional communication flow (SSE for receiving, HTTP POST for sending)
  - All target `localhost:3001/sse` endpoint with session-based authentication

- **JS-Debug Transport** (`test-jsdebug-transport.js`): Diagnostic tool for js-debug adapter TCP transport modes
  - Tests IPv4/IPv6 compatibility issues between adapter binding and client connections
  - Validates DAP (Debug Adapter Protocol) communication over TCP
  - Provides specific remediation recommendations for transport failures

#### Language-Specific Debugger Testing
- **Python Debugging** (`test_python_debug.py`, `test_debugpy_launch.ts`, `test_python_debugger_instantiation.ts`):
  - Simple arithmetic test script for debugging practice
  - Debugpy adapter process lifecycle management and spawning tests
  - PythonDebugger constructor validation and instantiation testing
  - Windows-focused with hardcoded Python paths (`C:\Python313\python.exe`)

- **JavaScript Debugging** (`test_javascript_debug.js`):
  - Node.js arithmetic operations for debugging verification
  - Demonstrates basic debugging scenarios with predictable execution flow

### Public API Surface and Entry Points
All scripts are designed for direct execution:
- **Node.js scripts**: Use shebang `#!/usr/bin/env node` or direct `node` execution
- **TypeScript scripts**: Require TypeScript runtime for execution
- **Python scripts**: Standard `python` execution with `if __name__ == "__main__"` pattern

### Internal Data Flow and Patterns

#### Common Testing Patterns
1. **Process Lifecycle Management**: Spawn → Monitor → Cleanup pattern for debugger adapters
2. **Connection Testing**: Establish → Authenticate → Communicate → Validate pattern for network protocols
3. **Error Diagnostics**: Comprehensive logging with tagged output for filtering
4. **Session-Based Authentication**: Extract session ID from initial connection, use in subsequent requests

#### Configuration Patterns
- Hardcoded endpoints and ports for reproducible testing
- Environment-specific paths (primarily Windows-focused)
- Fixed test data for deterministic results
- Extensive console logging for manual observation

### Architecture Notes
- **Manual Execution Model**: Scripts are designed for developer interaction, not automated test suites
- **Isolation Focus**: Each script tests a single component or protocol in isolation
- **Diagnostic Orientation**: Emphasis on providing actionable feedback and troubleshooting information
- **Development Environment Assumptions**: Local development setup with specific tool versions and paths

### Key Dependencies
- Node.js runtime and standard libraries (`http`, `child_process`, `net`)
- EventSource polyfill for SSE client functionality
- TypeScript runtime for .ts files
- Python debugpy module and specific Python installation paths
- MCP SDK components for protocol testing

The directory serves as a comprehensive manual testing toolkit for validating the core debugging and communication infrastructure of the MCP development environment, with particular emphasis on transport protocol diagnostics and language-specific debugger integration.