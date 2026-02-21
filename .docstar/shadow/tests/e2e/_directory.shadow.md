# tests\e2e/
@children-hash: b623360a5f2a9e46
@generated: 2026-02-21T20:48:34Z

## MCP Debugger E2E Test Suite

This directory contains comprehensive end-to-end test infrastructure validating the MCP (Model Context Protocol) debugger across multiple deployment scenarios, transport mechanisms, and programming languages.

### Overall Purpose
The `tests/e2e` module serves as the primary validation layer ensuring the MCP debugger maintains full functionality across all supported configurations:
- **Multi-language support**: JavaScript, Python, Rust, Go, and Mock adapters
- **Transport mechanisms**: Stdio, SSE (Server-Sent Events), and Docker deployments
- **Distribution channels**: Local development, containerized environments, and npm/npx installations
- **Debug workflows**: Complete debugging lifecycle from session creation through execution control

### Core Components and Architecture

#### Primary Test Suites
- **`comprehensive-mcp-tools.test.ts`**: Master test matrix validating all 19 MCP tools across 5 languages with detailed PASS/FAIL/SKIP reporting
- **Language-specific suites**: Dedicated smoke tests for JavaScript, Python, Rust, and Go debugging workflows
- **Transport validation**: SSE-specific tests including critical IPC corruption fix validation
- **Integration scenarios**: debugpy connection testing and complete debugging workflows

#### Infrastructure Components
- **Smoke test utilities (`smoke-test-utils.ts`)**: Core MCP client abstractions, Docker management, and debug session orchestration
- **Event utilities (`test-event-utils.ts`)**: Intelligent state polling and DAP-like event detection for debug session management  
- **Platform-specific utilities**: Rust example building with cross-platform Docker support

#### Specialized Test Environments

**Docker Integration (`docker/`)**
- Containerized MCP debugger validation across JavaScript, Python, and Rust
- Host-to-container path resolution and resource management
- Production-like deployment scenario testing

**NPX Distribution Testing (`npx/`)**
- End-to-end npm package distribution validation
- Global installation and execution testing
- Content-based caching and build pipeline verification

### Key Entry Points and Public API

#### Test Execution Points
- `comprehensive-mcp-tools.test.ts`: Primary matrix test covering all tool×language combinations
- Language-specific files (`*-smoke-*.test.ts`): Focused testing for individual language adapters
- Transport-specific tests (`*-sse.test.ts`): SSE transport validation including production issue fixes
- `debugpy-connection.test.ts`: Direct debugpy integration validation

#### Utility APIs
- **MCP Client Management**: `parseSdkToolResult()`, `callToolSafely()`, `executeDebugSequence()`
- **Environment Setup**: `findAvailablePort()`, `waitForPort()`, Docker container lifecycle
- **Cross-Platform Support**: Path normalization, toolchain detection, platform-specific builds
- **State Management**: Debug session polling, event waiting, cleanup orchestration

### Internal Organization and Data Flow

#### Test Execution Pattern
1. **Environment Setup**: Toolchain detection, port allocation, server spawning
2. **Client Connection**: MCP client creation with appropriate transport (stdio/SSE)
3. **Debug Workflow**: Session creation → breakpoints → execution → inspection → cleanup
4. **Result Aggregation**: Comprehensive reporting with timing metrics and failure analysis

#### Resource Management
- **Process Lifecycle**: Careful management of MCP servers, debug adapters, and target processes
- **Port Allocation**: Dynamic port discovery with conflict resolution
- **Session Cleanup**: Graceful debug session termination with fallback handling
- **Container Management**: Docker lifecycle with proper resource cleanup

#### Cross-Platform Considerations
- **Path Handling**: Unix/Windows path normalization throughout
- **Toolchain Detection**: Runtime availability checks for Go, Rust, Python toolchains
- **Build Systems**: Platform-aware compilation with Docker fallbacks
- **Process Management**: Signal handling differences across operating systems

### Critical Patterns and Conventions

#### Error Handling Strategy
- Comprehensive cleanup in `afterEach`/`afterAll` hooks preventing resource leaks
- Defensive programming with multiple fallback layers
- Detailed error context including debug session state and process logs

#### Timing and Synchronization
- Intelligent polling with exponential backoff for debug state detection
- Platform-specific timeouts (Python: 10s, others: 5s default)
- CI environment scaling via `TIMEOUT_MULTIPLIER`

#### Configuration Management
- Environment-based test skipping (`SKIP_DOCKER`, language-specific flags)
- Dynamic configuration based on available toolchains
- Caching strategies for expensive operations (builds, package creation)

### Integration Points

The E2E test suite validates the complete MCP debugger system including:
- **Adapter Integration**: All supported language debug adapters
- **Protocol Compliance**: MCP tool contracts and response formats  
- **Transport Reliability**: Stdio and SSE communication mechanisms
- **Deployment Scenarios**: Local development, Docker containers, npm distribution
- **Production Issues**: Critical bug fixes like SSE IPC corruption prevention

This comprehensive testing infrastructure ensures the MCP debugger maintains reliability and compatibility across all supported deployment and usage scenarios.