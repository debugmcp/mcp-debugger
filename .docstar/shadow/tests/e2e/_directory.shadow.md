# tests\e2e/
@children-hash: eff07c6588c361e8
@generated: 2026-02-15T09:01:50Z

## E2E Testing Suite for MCP Debugger

This directory implements comprehensive end-to-end testing for the MCP (Model Context Protocol) debugger across multiple deployment scenarios, programming languages, and transport mechanisms. The test suite validates complete debugging workflows from session creation through execution control, ensuring production-ready functionality.

### Overall Architecture

**Multi-Language Coverage**: Tests debugging functionality for JavaScript, Python, Rust, and Go with language-specific adapters and toolchain integration.

**Multi-Transport Testing**: Validates both stdio and SSE (Server-Sent Events) transport protocols to ensure MCP compatibility across deployment patterns.

**Multi-Environment Validation**: Tests local development, Docker containers, and npm distribution scenarios to cover all deployment contexts.

### Key Components and Integration

#### Core Test Infrastructure
- **`smoke-test-utils.ts`**: Central utilities providing MCP client abstractions, Docker management, and debug session orchestration
- **`test-event-utils.ts`**: Intelligent polling mechanisms for debug state transitions with timeout handling and CI scaling
- **`rust-example-utils.ts`**: Cross-platform Rust binary compilation with Docker-based Linux builds and smart caching

#### Language-Specific Test Suites
- **`mcp-server-smoke-*.test.ts`**: Individual language smoke tests validating core debugging workflows (session management, breakpoints, variable inspection, execution control)
- **`comprehensive-mcp-tools.test.ts`**: Matrix testing suite validating all 19 MCP debugger tools across 5 languages with detailed PASS/FAIL/SKIP reporting

#### Transport and Deployment Testing
- **SSE Transport**: `mcp-server-smoke-sse.test.ts` and `mcp-server-smoke-javascript-sse.test.ts` validate Server-Sent Events transport with critical IPC corruption fixes
- **Docker Integration**: `docker/` subdirectory provides containerized testing ensuring path resolution and protocol compatibility
- **NPX Distribution**: `npx/` subdirectory validates npm package distribution with global installation testing

### Public API Surface

#### Main Entry Points
- **Language Testing**: `mcp-server-smoke-{language}.test.ts` files for individual language validation
- **Comprehensive Matrix**: `comprehensive-mcp-tools.test.ts` for complete tool coverage validation
- **Transport Testing**: SSE-specific test files for transport protocol validation
- **Environment Testing**: Docker and NPX subdirectories for deployment scenario validation

#### Core Utilities
- `executeDebugSequence()`: Standard debug workflow orchestration (create session → set breakpoint → start debugging → inspect → cleanup)
- `callToolSafely()`: Wrapped MCP tool calls with comprehensive error handling
- `waitForSessionState()`: Intelligent state polling with exponential backoff
- `parseSdkToolResult()`: Standardized MCP response parsing

### Internal Organization and Data Flow

#### Test Execution Patterns
1. **Setup Phase**: MCP client creation, server startup, environment validation
2. **Debug Workflow**: Session lifecycle management with language-specific configurations
3. **Validation Phase**: Stack traces, variable inspection, execution control verification
4. **Cleanup Phase**: Session closure, resource cleanup, error collection

#### Error Handling Strategy
- Comprehensive cleanup in afterEach/afterAll hooks prevents resource leaks
- Graceful degradation for missing toolchains (Rust/Go) with conditional skipping
- Detailed error context collection including server logs and session states
- Retry logic for async operations with configurable timeouts

#### Cross-Platform Compatibility
- Platform-specific executable resolution (python/python3, Windows/Unix paths)
- Docker-based Linux compilation for consistent Rust testing
- Path normalization for container volume mounts
- CI-aware timeout scaling via environment variables

### Critical Integration Points

#### MCP Protocol Validation
- All 19 debugger tools tested across language matrix
- Transport protocol compatibility (stdio, SSE) with production configurations
- DAP (Debug Adapter Protocol) integration through MCP tool abstractions

#### Production Environment Simulation
- Real language runtimes and debuggers (not mocked)
- Actual script execution with genuine breakpoints and variable inspection
- Docker containerization matching production deployment patterns
- NPX global installation testing for distribution validation

#### Quality Assurance Patterns
- Matrix reporting with detailed PASS/FAIL/SKIP statistics
- Comprehensive logging with request/response instrumentation
- Resource leak prevention through systematic cleanup patterns
- CI/CD integration with configurable timeout scaling

This testing suite serves as the primary validation layer ensuring the MCP debugger maintains full functionality across all supported languages, transport mechanisms, and deployment environments, providing confidence for production deployment scenarios.