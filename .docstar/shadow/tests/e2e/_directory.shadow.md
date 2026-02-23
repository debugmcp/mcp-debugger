# tests\e2e/
@children-hash: a5afd42c2f96733e
@generated: 2026-02-23T15:26:56Z

## E2E Testing Module for MCP Debugger

This directory provides comprehensive end-to-end testing infrastructure for the MCP (Model Context Protocol) debugger, validating debugging functionality across multiple programming languages, deployment methods, and execution environments.

### Overall Purpose and Responsibility

The `tests/e2e` module serves as the final validation layer for the MCP debugger, ensuring that:
- All 19 MCP debugging tools work correctly across 5 supported languages (Python, JavaScript, Rust, Go, Mock)
- Multiple transport mechanisms (stdio, SSE) function properly
- Docker containerized deployments work correctly
- NPM package distribution maintains full functionality
- Complete debugging workflows (breakpoints, stepping, variable inspection, execution control) operate reliably

### Key Components and Architecture

**Core Test Infrastructure:**
- `comprehensive-mcp-tools.test.ts`: Matrix testing framework that validates every MCP tool against every supported language
- `smoke-test-utils.ts`: Central utilities providing MCP client abstractions, Docker management, and debug session orchestration
- `test-event-utils.ts`: Intelligent polling mechanisms for debug session state changes

**Language-Specific Test Suites:**
- Individual smoke tests for JavaScript, Python, Rust, and Go debugging workflows
- Transport-specific tests (stdio vs SSE) with critical IPC corruption validation
- Language adapter registration and availability validation

**Deployment Environment Testing:**
- `docker/`: Complete Docker-based testing with containerized MCP server execution
- `npx/`: Real-world npm package distribution testing via global installation

**Specialized Test Areas:**
- `debugpy-connection.test.ts`: Direct DAP client integration testing
- Multiple transport mechanism validation (stdio, SSE)
- Cross-platform compatibility testing (Windows/Unix path handling)

### Public API Surface

**Main Entry Points:**
- Language-specific smoke test suites (`mcp-server-smoke-{language}.test.ts`)
- Comprehensive matrix testing (`comprehensive-mcp-tools.test.ts`)
- Docker integration tests (`docker/*.test.ts`)
- NPM distribution validation (`npx/*.test.ts`)

**Core Utilities:**
- `executeDebugSequence()`: Standard debug workflow orchestration
- `callToolSafely()`: MCP tool execution with comprehensive error handling  
- `buildAndPackNpmPackage()`: NPM packaging and caching infrastructure
- `createDockerMcpClient()`: Containerized MCP client factory

### Internal Organization and Data Flow

**Test Execution Pattern:**
1. **Setup Phase**: Build artifacts, start servers, establish connections
2. **Debug Session Lifecycle**: Create → Set breakpoints → Start → Inspect → Step → Continue → Close
3. **Validation Phase**: Verify expected behaviors, state transitions, and data integrity
4. **Cleanup Phase**: Close sessions, terminate processes, release resources

**Resource Management:**
- Comprehensive cleanup hooks prevent resource leaks across all test suites
- Timeout configurations scaled for different environments (CI vs local)
- Singleton patterns for expensive operations (Docker builds, npm packaging)

**Error Handling Strategy:**
- Defensive programming with graceful cleanup on failures
- Comprehensive logging with detailed error context
- Retry mechanisms for flaky network operations

### Important Patterns and Conventions

**Multi-Environment Testing:**
- Docker containers for isolated execution environments
- Global npm installation for realistic distribution testing  
- Multiple transport protocols for production scenario validation

**Cross-Platform Compatibility:**
- Windows-specific handling (path separators, socket cleanup delays)
- Platform-aware toolchain detection (Go, Rust availability)
- Unix-specific Docker user ID mapping for file permissions

**Test Data Management:**
- Consistent use of example scripts in `examples/` directory
- Standard breakpoint locations and expected variables per language
- Deterministic test data for reliable assertions

**Performance Optimizations:**
- Intelligent caching based on content fingerprinting
- File-based locking for concurrent operation prevention  
- Strategic timeout configurations balancing reliability with speed

This module ensures the MCP debugger maintains high quality and reliability across all supported deployment scenarios, programming languages, and execution environments through comprehensive automated validation.