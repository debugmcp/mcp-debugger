# tests/e2e/
@generated: 2026-02-09T18:16:51Z

## Overall Purpose & Responsibility

The `tests/e2e` directory provides comprehensive end-to-end testing infrastructure for the MCP (Model Context Protocol) debugger server, validating complete debugging workflows across multiple programming languages (JavaScript, Python, Rust, Go, Java) and deployment environments (local, Docker, npm distribution). This module ensures the entire debugging ecosystem works correctly from client connection through debug session management to protocol communication.

## Key Components & Architecture

### Core Test Infrastructure
- **Smoke Test Utilities** (`smoke-test-utils.ts`): Central testing foundation providing MCP client integration, debug session orchestration, Docker container management, and server health validation
- **Event Management** (`test-event-utils.ts`): Intelligent polling mechanisms for detecting debug state changes, since MCP server doesn't expose DAP events directly
- **Transport Testing**: Comprehensive validation of both StdioClientTransport and SSE (Server-Sent Events) communication layers

### Language-Specific Test Suites
Each language adapter is validated through dedicated smoke tests:
- **JavaScript** (`mcp-server-smoke-javascript.test.ts`): Node.js debugging with variable inspection and expression evaluation
- **Python** (`mcp-server-smoke-python.test.ts`): CPython debugging with adapter-specific characteristics (unverified breakpoints, clean stack traces)
- **Rust** (`mcp-server-smoke-rust.test.ts`): Native and async debugging with cross-compilation support
- **Go** (`mcp-server-smoke-go.test.ts`): Delve debugger integration with conditional execution
- **Java** (`mcp-server-smoke-java.test.ts`): JDB-based debugging with multi-breakpoint support

### Specialized Integration Tests
- **debugpy Connection** (`debugpy-connection.test.ts`): Validates MCP server as DAP client connecting to debugpy servers
- **Java Attachment** (`mcp-server-java-attach.test.ts`): Tests attachment to running Java processes via JDWP
- **SSE Transport** (`mcp-server-smoke-*-sse.test.ts`): Server-Sent Events communication validation with IPC corruption prevention
- **Timing Tests** (`test-sse-timing.js`): Reproduces and validates SSE timing edge cases in production scenarios

## Public API Surface & Entry Points

### Primary Test Orchestration
- **`executeDebugSequence(client, config)`**: Core debugging workflow orchestrator (session → breakpoint → execute → validate)
- **`callToolSafely(client, tool, args)`**: Safe MCP tool invocation wrapper with comprehensive error handling
- **`parseSdkToolResult(result)`**: Standardized MCP response parsing and validation

### Environment Management
- **Language Utilities**: `prepareRustExample()`, `ensureCompiled()` for build management and binary preparation
- **Docker Integration**: Complete containerized testing environment with image building, container lifecycle, and cleanup
- **NPM Distribution**: End-to-end validation of npm packaging and npx execution scenarios

### State Management & Validation
- **`waitForSessionState(client, sessionId, state, timeout)`**: Intelligent state polling with exponential backoff
- **`waitForBreakpointHit()`, `waitForContinuedEvent()`**: Specialized event waiters for debug state transitions
- **`smartWaitAfterOperation()`**: Context-aware waiting based on debug operation type

## Internal Organization & Data Flow

### Test Execution Flow
1. **Setup Phase**: MCP server startup, client connection, language environment preparation
2. **Debug Lifecycle**: Session creation → breakpoint setting → execution control → state inspection → cleanup
3. **Validation Points**: Stack traces, variable inspection, expression evaluation, source context retrieval
4. **Teardown**: Session cleanup, transport closure, process termination

### Multi-Environment Testing
- **Local Development**: Direct MCP server execution with stdio transport
- **Docker Containers**: Isolated environments with workspace mounting and permission handling
- **NPM Distribution**: Global package installation and npx execution validation
- **SSE Transport**: HTTP-based communication with timing and state management

### Error Handling & Resilience
- **Graceful Degradation**: Tests skip when required tools unavailable (Go, Rust toolchain)
- **Resource Management**: Comprehensive cleanup with SIGTERM/SIGKILL fallback patterns
- **State Recovery**: Debug session cleanup between tests prevents interference
- **Timeout Management**: Extended timeouts for debugging operations (30-240 seconds)

## Important Patterns & Conventions

### Test Isolation & Resource Management
- **Sequential Execution**: Prevents race conditions in shared resource scenarios (npm global installs)
- **Cleanup Hooks**: `afterEach`/`afterAll` hooks ensure proper resource disposal
- **Session Management**: Automatic debug session cleanup prevents state leakage between tests

### Cross-Platform Compatibility
- **Path Normalization**: Handles Windows/Unix path differences consistently
- **Permission Handling**: Unix UID/GID mapping vs CI environment compatibility
- **Executable Detection**: Cross-platform discovery of language runtimes (python vs python3)

### Debugging & Observability
- **Comprehensive Logging**: MCP message interception, container logs, state transitions
- **Event Recording**: Optional event capture for post-failure analysis
- **Health Checks**: Server readiness validation with retry logic and port availability testing

This testing infrastructure serves as the final validation layer ensuring the MCP debugger maintains complete functionality across all supported languages, deployment methods, and communication transports before production release.