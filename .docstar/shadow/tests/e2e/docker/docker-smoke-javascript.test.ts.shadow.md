# tests/e2e/docker/docker-smoke-javascript.test.ts
@source-hash: bd0a7da7c8f23345
@generated: 2026-02-09T18:14:45Z

## Primary Purpose

End-to-end smoke tests for JavaScript debugging functionality within Docker containers. Tests the full debugging lifecycle using MCP (Model Context Protocol) client-server communication to verify JavaScript debugging capabilities in a containerized environment.

## Test Architecture

**Test Suite Setup (L21-83):**
- Conditional execution via `SKIP_DOCKER` environment variable (L19)
- Docker image building and container lifecycle management
- MCP client connection establishment with 4-minute timeout (L43)
- Cleanup handling for debug sessions and Docker containers
- Container log retrieval for debugging failed tests (L62-66)

**Core Test Variables:**
- `mcpClient`: MCP SDK client for tool communication (L22)
- `sessionId`: Debug session identifier for cleanup (L24)
- `containerName`: Docker container name for log retrieval (L25)

## Key Test Cases

**Full JavaScript Debugging Cycle (L85-287):**
- Creates debug session with language-specific configuration
- Sets breakpoints using container-mapped paths via `hostToContainerPath()` (L88)
- Executes complete debugging workflow: start → breakpoint → stack trace → variables → step → evaluate → continue → close
- Extensive error handling with Docker log inspection (L145-176)
- Validates state transitions and response structures

**Step Into Nested Frames (L289-384):**
- Tests stepping into function calls at specific breakpoints (L308, L346)
- Validates stack frame navigation and function name matching
- Verifies line number progression during step operations

**Step Over Const Declarations (L386-466):**
- Tests stepping over top-level constant declarations
- Validates line progression from line 3 to line 4 (L405, L450)

**Multiple Breakpoints (L468-506):**
- Tests setting multiple breakpoints on same file
- Validates breakpoint management in containerized environment

**Source Context Retrieval (L508-550):**
- Tests source code context extraction with line-based queries
- Validates response structure for source content access

## Dependencies

**External Modules:**
- Vitest testing framework for test execution and assertions
- MCP SDK client for debugger communication (L13)
- Docker test utilities from `./docker-test-utils.js` (L11)
- Smoke test utilities from `../smoke-test-utils.js` (L12)

**Container Integration:**
- Uses `mcp-debugger:test` Docker image
- Maps host paths to container paths for file access
- Expects JavaScript target files in `examples/javascript/` directory

## Critical Patterns

**Path Mapping Strategy:**
- Host-to-container path conversion using `hostToContainerPath()` utility
- Container paths used for all debugging operations while host paths for file resolution

**Error Recovery:**
- Extensive Docker log collection on test failures
- Session cleanup in both `afterEach` and `afterAll` hooks
- Graceful handling of cleanup errors with try-catch blocks

**Timing Management:**
- Strategic delays (1000ms, 2000ms) for session stabilization (L197, L242, L272)
- Extended timeouts (120000ms) for Docker operations
- Async/await pattern throughout for proper sequencing

## Test Environment Requirements

- Docker environment with image building capabilities
- MCP debugger server running in container
- JavaScript target files in expected directory structure
- Container log access permissions for debugging
- Network connectivity between test runner and Docker container