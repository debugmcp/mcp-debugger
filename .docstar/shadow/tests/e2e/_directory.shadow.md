# tests/e2e/
@generated: 2026-02-11T23:48:09Z

## E2E Test Suite for MCP Debugger

**Primary Purpose**: Comprehensive end-to-end validation of the MCP (Model Context Protocol) debugger across multiple languages, deployment scenarios, and transport mechanisms. This test directory ensures the debugger functions correctly in real-world usage patterns from development to production deployment.

## Overall Architecture

The test suite is organized into three main validation layers:

### 1. Core Functionality Tests (Root Level)
- **Comprehensive Matrix Testing** (`comprehensive-mcp-tools.test.ts`): Tests all 19 MCP debugger tools across 5 languages (Python, JavaScript, Rust, Go, Mock) with detailed PASS/FAIL/SKIP reporting
- **Language-Specific Smoke Tests**: Individual test files for each supported language (`mcp-server-smoke-*.test.ts`) validating complete debugging workflows
- **Transport Validation**: SSE (Server-Sent Events) transport testing including critical IPC corruption fixes for JavaScript debugging
- **Direct Integration**: Tests against locally built MCP server via stdio transport

### 2. Containerized Deployment Tests (`docker/`)
- **Docker Environment Validation**: Ensures MCP debugger works correctly when containerized
- **Isolated Runtime Testing**: Tests debugging functionality in clean container environments across JavaScript, Python, and Rust
- **Cross-Platform Compatibility**: Validates container-based deployment scenarios with proper resource management

### 3. Distribution Package Tests (`npx/`)
- **NPM Package Validation**: Tests the complete npm package distribution pipeline
- **Global Installation Testing**: Validates `npx @debugmcp/mcp-debugger` functionality
- **Real-World Usage Simulation**: Ensures language adapters and dependencies are correctly bundled in distributed packages

## Key Components & Integration

### Test Infrastructure
- **MCP Client Management**: Standardized MCP client creation and lifecycle management across stdio and SSE transports
- **Session State Management**: Sophisticated debug session state polling and event detection utilities
- **Cross-Platform Utilities**: Docker container management, port allocation, and path normalization
- **Language Adapter Testing**: Rust example building, Python/JavaScript script execution, and Go toolchain integration

### Validation Patterns
- **Complete Workflow Testing**: Session creation → breakpoint setting → debugging → variable inspection → execution control → cleanup
- **Error Resilience**: Graceful handling of missing toolchains (Rust/Go) with conditional test skipping
- **Resource Management**: Comprehensive cleanup patterns preventing resource leaks in CI environments
- **Timing Coordination**: Strategic delays and polling for debug adapter protocol state transitions

## Public API Surface

### Main Entry Points
- **Test Execution**: Jest/Vitest test suites with configurable timeouts and environment detection
- **Utility Functions**: 
  - `executeDebugSequence()`: Standardized debug workflow orchestration
  - `callToolSafely()`: Safe MCP tool invocation with error handling
  - `parseSdkToolResult()`: Response parsing for MCP SDK results

### Configuration Options
- **Environment Variables**: `SKIP_DOCKER`, `DOCKER_RUST_ENABLED`, `TIMEOUT_MULTIPLIER` for CI optimization
- **Conditional Execution**: Automatic toolchain detection and test skipping for unavailable languages
- **Transport Selection**: Support for stdio and SSE transport mechanisms

## Critical Validation Scenarios

### Language Support Matrix
- **Python**: DAP integration with debugpy, expression evaluation, variable inspection
- **JavaScript**: Node.js debugging with IPC corruption fixes, console output handling
- **Rust**: Delve integration, async debugging support, cross-compilation testing
- **Go**: Toolchain availability detection, binary compilation with debug symbols
- **Mock**: Adapter testing without external dependencies

### Deployment Scenarios
- **Local Development**: Direct MCP server testing via built artifacts
- **Container Deployment**: Docker-based debugging with workspace mounting
- **Global Distribution**: NPM package installation and execution via npx

## Internal Organization

### Data Flow
1. **Environment Preparation**: Toolchain detection, port allocation, server startup
2. **MCP Client Connection**: Transport establishment (stdio/SSE) with health checking
3. **Debug Session Lifecycle**: Creation, configuration, execution, and cleanup
4. **Result Validation**: Response parsing, state verification, and error handling
5. **Resource Cleanup**: Session termination, server shutdown, container removal

### Key Dependencies
- **MCP SDK**: `@modelcontextprotocol/sdk` for protocol communication
- **Language Runtimes**: Python, Node.js, Rust toolchain, Go compiler as available
- **Test Framework**: Vitest with extended timeouts and async support
- **System Integration**: Docker, npm, child processes for real-world simulation

This test directory serves as the definitive validation suite ensuring the MCP debugger maintains compatibility, reliability, and functionality across all supported languages, deployment methods, and usage patterns from development through production distribution.