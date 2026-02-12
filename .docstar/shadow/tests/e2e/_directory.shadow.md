# tests\e2e/
@generated: 2026-02-12T21:01:30Z

## MCP Debugger End-to-End Test Suite

**Overall Purpose**: Comprehensive end-to-end test suite that validates the MCP (Model Context Protocol) debugger across all supported languages, deployment environments, and transport protocols. Ensures production readiness by testing real debugging workflows from session creation through variable inspection and execution control.

## Core Components & Architecture

### Primary Test Matrices
- **Language Coverage**: JavaScript, Python, Rust, Go, and Mock adapters with complete workflow validation
- **Transport Protocols**: Both stdio and SSE (Server-Sent Events) transport mechanisms
- **Deployment Scenarios**: Native execution, Docker containers, and npm package distribution
- **Integration Patterns**: Direct MCP tool calls, debug adapter protocol (DAP) interactions, and cross-platform compatibility

### Key Test Categories

**Comprehensive Coverage (`comprehensive-mcp-tools.test.ts`)**
Central 19-tool × 5-language test matrix that validates every MCP debugger tool against all available language adapters. Generates detailed PASS/FAIL/SKIP matrices with timing metrics and supports conditional execution based on toolchain availability.

**Language-Specific Smoke Tests**
- `mcp-server-smoke-*.test.ts`: Individual language validation (JavaScript, Python, Rust, Go)
- Tests complete debugging lifecycle with language-specific behaviors and constraints
- Validates debugger integration, breakpoint management, stack inspection, and variable access

**Transport Protocol Validation**
- SSE transport testing with critical console output silencing fixes
- Stdio transport baseline functionality across all supported languages
- Protocol-specific error handling and resource cleanup patterns

## Public API Surface

### Primary Entry Points
- **Matrix Testing**: `comprehensive-mcp-tools.test.ts` provides complete coverage validation
- **Individual Language Tests**: Focused smoke tests for specific language debugging scenarios  
- **Environment Testing**: Docker and npm deployment validation suites
- **Utility Functions**: Shared infrastructure in `smoke-test-utils.ts` and specialized helpers

### Core Test Infrastructure
- `executeDebugSequence()`: Standard 8-step debug workflow (session → breakpoint → execute → inspect → cleanup)
- `callToolSafely()`: Wrapped MCP tool calls with comprehensive error handling
- `parseSdkToolResult()`: Protocol response normalization across test cases
- Event waiting utilities (`test-event-utils.ts`) for async debugging state management

## Internal Organization & Data Flow

### Test Execution Patterns
1. **Setup Phase**: MCP server startup, client connection establishment, environment validation
2. **Language Detection**: Toolchain availability checks (Go, Rust compilers, Python runtime)
3. **Debug Workflow**: Systematic validation of debugging operations with proper state transitions
4. **Cleanup Phase**: Session closure, process termination, resource deallocation

### Specialized Test Environments

**Docker Integration (`docker/` subdirectory)**
- Containerized debugging validation with path translation (host ↔ container)
- Multi-language Docker image building and container lifecycle management
- Isolated test execution preventing host environment interference

**NPX Distribution Testing (`npx/` subdirectory)**
- End-to-end npm package validation from build through global installation
- Content fingerprinting and caching system for efficient CI/CD execution
- Real-world deployment simulation ensuring adapters are properly packaged

**Rust Compilation Pipeline (`rust-example-utils.ts`)**
- Cross-platform Rust binary compilation with Docker-based Linux builds
- Intelligent caching and incremental compilation for performance
- Windows GNU toolchain handling with MSVC fallbacks

## Critical Integration Points

### MCP Protocol Validation
- Complete MCP tool coverage: session management, breakpoint control, execution flow, variable inspection
- Transport protocol testing (stdio/SSE) with error condition handling
- Client SDK integration ensuring proper message serialization/deserialization

### Debug Adapter Integration
- DAP (Debug Adapter Protocol) compliance testing for each language
- Language-specific debugging behavior validation (Python unverified breakpoints, Rust async debugging)
- Cross-platform debugger integration (Node.js inspector, Python debugpy, Rust/Go Delve)

### Production Readiness Checks
- Resource leak prevention with comprehensive cleanup strategies
- Error handling resilience across failure modes
- Performance validation with configurable timeouts and retry logic
- CI/CD pipeline integration with environment-based test skipping

## Important Patterns & Conventions

### Test Isolation & Reliability
- Sequential execution where needed to prevent resource conflicts
- Multi-level cleanup (afterEach, afterAll) ensuring no state leakage
- Defensive error handling with graceful degradation for missing dependencies
- Environment variable configuration for CI flexibility

### Cross-Platform Compatibility
- Platform-specific executable resolution (python vs python3, Go/Rust toolchain detection)
- Path normalization for Windows/Unix compatibility in Docker environments  
- Dynamic port allocation preventing conflicts in concurrent test execution

### Real-World Simulation
- Uses actual example programs rather than mock implementations
- Tests against real debug adapters and language runtimes
- Validates complete user workflows from session creation to program termination

The test suite serves as the primary quality gate ensuring the MCP debugger functions correctly across all supported languages, deployment environments, and usage patterns before production release.