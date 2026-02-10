# tests/e2e/
@generated: 2026-02-10T21:26:55Z

## E2E Test Suite for MCP Debugger

**Overall Purpose**: Comprehensive end-to-end testing infrastructure that validates the MCP (Model Context Protocol) debugger across all supported programming languages, distribution mechanisms, and deployment environments. This test suite ensures production readiness by testing real debugging workflows, protocol interactions, and critical integration points.

## Key Components & Architecture

### Core Test Categories
- **Smoke Tests**: Language-specific debugging workflow validation (`mcp-server-smoke-*.test.ts`)
- **Comprehensive Testing**: Full tool coverage matrix across all languages (`comprehensive-mcp-tools.test.ts`)  
- **Transport Testing**: SSE and stdio transport validation (`mcp-server-smoke-sse.test.ts`, `*-sse.test.ts`)
- **Docker Integration**: Containerized debugging environment testing (`docker/` subdirectory)
- **NPX Distribution**: End-to-end package distribution and consumption testing (`npx/` subdirectory)
- **Specialized Integration**: Java attach debugging, debugpy connection testing

### Public API Surface

**Primary Entry Points**:
- **Language Test Suites**: `mcp-server-smoke-{python|javascript|java|rust|go}.test.ts` - Complete debugging workflow validation per language
- **Comprehensive Matrix**: `comprehensive-mcp-tools.test.ts` - All 19 MCP tools tested across 6 languages with detailed reporting
- **Transport Tests**: SSE and stdio transport validation with real server connections
- **Distribution Tests**: `npx/` directory for npm package distribution validation
- **Docker Tests**: `docker/` directory for containerized environment validation

**Test Utilities**:
- **MCP Client Management**: `smoke-test-utils.ts` provides `callToolSafely()`, `executeDebugSequence()`, connection utilities
- **Event Handling**: `test-event-utils.ts` offers session state polling and event waiting patterns
- **Language Setup**: `rust-example-utils.ts` for cross-platform Rust binary preparation
- **Docker Integration**: `docker-test-utils.ts` for container lifecycle management

## Internal Organization & Data Flow

### Test Execution Flow
1. **Environment Setup**: Validates language toolchains, builds test artifacts, starts MCP servers
2. **Client Connection**: Establishes MCP SDK connections via stdio or SSE transport
3. **Debug Workflow**: Creates sessions, sets breakpoints, executes programs, inspects state
4. **Validation**: Confirms expected debugging behavior, variable states, execution control
5. **Cleanup**: Closes sessions, terminates processes, cleans up resources

### Language Support Matrix
- **Python**: Full debugging with debugpy integration, expression evaluation, variable inspection
- **JavaScript**: Node.js debugging with comprehensive stepping and breakpoint support
- **Java**: JDB integration with attach capabilities and multi-breakpoint management
- **Rust**: Delve-based debugging with async code support and cross-platform binary handling
- **Go**: Complete debugging workflow with compiler integration
- **Mock**: Simulation adapter for testing infrastructure without language dependencies

### Critical Integration Points
- **MCP Protocol**: Validates all 19 debugger tools through standardized MCP interface
- **DAP Adapters**: Tests Debug Adapter Protocol integration for each language runtime
- **Transport Layers**: stdio and SSE transport validation with real server processes
- **Process Management**: Child process spawning, cleanup, and resource management
- **Path Resolution**: Cross-platform path handling for debugging targets

## Important Patterns & Conventions

### Test Infrastructure Patterns
- **Graceful Degradation**: Tests skip when language toolchains unavailable rather than failing
- **Resource Management**: Comprehensive cleanup in afterEach/afterAll with defensive error handling
- **Timeout Management**: Language-appropriate timeouts (Python: 10s, others: 5s default)
- **Session Isolation**: Each test creates fresh debug sessions to prevent state contamination

### Validation Strategies
- **Real Workflow Testing**: Complete debugging cycles rather than isolated tool calls
- **Cross-Platform Compatibility**: Windows, macOS, Linux path and process handling
- **Container Isolation**: Docker-based testing for deployment environment validation
- **Distribution Testing**: End-to-end npm package installation and consumption

### Error Handling Philosophy
- **Expected Failures**: Graceful handling of unimplemented features and environmental limitations
- **Comprehensive Logging**: Detailed console output for debugging test failures
- **State Recovery**: Robust cleanup even when individual operations fail
- **Timeout Resilience**: Configurable timeouts with environment multipliers for CI/CD

## Dependencies & Requirements

**Core Dependencies**:
- **MCP SDK**: `@modelcontextprotocol/sdk` for client/transport communication
- **Test Framework**: Vitest for test execution and assertions
- **Language Runtimes**: Python, Node.js, Java, Rust, Go toolchains (conditionally required)
- **System Tools**: Docker for containerized testing, npm for distribution testing

**Test Artifacts**:
- **Example Programs**: Target debugging files in `examples/` directory for each language
- **Build Artifacts**: `dist/index.js` MCP server bundle for stdio transport testing
- **Configuration**: Environment variables for timeout scaling, Docker control, feature flags

This comprehensive test suite ensures the MCP debugger works reliably across all supported environments, from local development through containerized deployment to end-user npm consumption, providing confidence in production readiness and cross-platform compatibility.