# tests\e2e/
@children-hash: cb8d7dc2f0947996
@generated: 2026-02-21T08:28:52Z

## E2E Testing Suite for MCP Debugger

The `tests/e2e` directory provides comprehensive end-to-end validation of the MCP (Model Context Protocol) debugger across multiple languages, deployment scenarios, and transport mechanisms. This module ensures the debugger maintains full functionality in production environments through extensive integration testing.

### Overall Purpose and Responsibility

This testing suite validates:
- **Complete debugging workflows** across 5 programming languages (Python, JavaScript, Rust, Go, Mock)
- **Transport layer compatibility** including stdio, SSE (Server-Sent Events), and debugpy direct connections
- **Cross-platform deployment** via Docker containerization
- **Distribution integrity** through npm/npx package installation testing
- **Real-world production scenarios** with actual language runtimes and debug adapters

### Key Components and Architecture

**Core Test Matrix (`comprehensive-mcp-tools.test.ts`)**
- Central 19×5 tool/language test matrix validating all MCP debugger tools
- Generates PASS/FAIL/SKIP results with timing metrics and JSON reports
- Coordinates complete debug workflows from session creation to closure

**Language-Specific Smoke Tests**
- Individual test suites for each supported language (`mcp-server-smoke-*.test.ts`)
- Transport-specific tests including SSE mode with IPC corruption validation
- Platform-specific testing (Windows GNU toolchain, Docker isolation)

**Infrastructure Utilities**
- `smoke-test-utils.ts`: Core MCP client abstractions and debug session orchestration
- `test-event-utils.ts`: Intelligent state polling for debug session events
- `rust-example-utils.ts`: Cross-platform Rust compilation with Docker Linux builds

### Public API Surface - Main Entry Points

**Primary Test Execution**
- `comprehensive-mcp-tools.test.ts`: Master test suite validating all tools across all languages
- Language smoke tests: `mcp-server-smoke-{javascript,python,rust,go}.test.ts`
- Transport tests: `mcp-server-smoke-{sse,javascript-sse}.test.ts`
- Direct connection: `debugpy-connection.test.ts`

**Specialized Test Modules**
- `docker/`: Containerized debugging validation with path translation
- `npx/`: npm distribution integrity testing with global installation

**Test Utilities (Internal API)**
- `executeDebugSequence()`: Standard 8-step debugging workflow orchestration
- `parseSdkToolResult()` / `callToolSafely()`: MCP client interaction abstractions  
- `waitForSessionState()` / `smartWaitAfterOperation()`: Debug session state management
- `prepareRustExample()` / `buildExampleBinary()`: Language-specific build orchestration

### Internal Organization and Data Flow

**Test Execution Flow**
```
Test Suite → MCP Client → Transport (stdio/SSE) → MCP Server → Debug Adapter → Language Runtime
```

**Session Lifecycle Management**
1. **Setup**: MCP server startup, client connection establishment
2. **Debug Workflow**: Session creation, breakpoint setting, execution control, variable inspection
3. **Cleanup**: Session closure, process termination, resource deallocation

**Cross-Platform Coordination**
- Docker containerization for Linux builds and isolated testing
- Platform-specific toolchain detection (Rust/Go availability)
- Path normalization for Windows/Unix filesystem differences

### Key Integration Patterns

**Transport Layer Testing**
- **Stdio Transport**: Direct process communication for most language tests
- **SSE Transport**: HTTP-based communication with console silencing validation
- **Direct Connection**: debugpy server integration without MCP wrapper

**Build and Distribution Validation**
- Automated npm package building with content fingerprinting
- Global installation testing via actual npm commands
- Docker image building with intelligent caching and incremental compilation

**Error Handling and Resilience**
- Comprehensive cleanup strategies preventing resource leaks
- Graceful degradation when optional dependencies unavailable
- Extensive logging and error context collection for debugging

**Critical System Invariants**
- All debug sessions must be explicitly closed before process termination
- MCP tool responses follow consistent JSON structure via `parseSdkToolResult()`
- State polling uses `list_debug_sessions` as single source of truth
- Platform-specific timeouts accommodate CI environment variations

This testing suite serves as the definitive validation layer ensuring the MCP debugger maintains production-level reliability across all supported languages, deployment methods, and execution environments.