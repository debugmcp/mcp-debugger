# tests/e2e/smoke-test-utils.ts
@source-hash: 5a038b28ee3f8330
@generated: 2026-02-10T00:42:04Z

## Purpose
Utility module for end-to-end smoke tests of the Model Context Protocol (MCP) debug server. Provides abstractions for MCP client interactions, Docker container management, and debug session orchestration.

## Key Interfaces & Types
- `ParsedToolResult` (L14-19): Standard result format with optional sessionId, success flag, state, and extensible properties

## Core Functions

### MCP Client Utilities
- `parseSdkToolResult()` (L21-28): Extracts JSON content from SDK ServerResult, assumes text content in first array element
- `callToolSafely()` (L33-68): Wraps MCP tool calls with comprehensive error handling, normalizes various MCP error formats into consistent response structure

### Debug Session Management
- `executeDebugSequence()` (L73-148): Orchestrates complete debug workflow: creates session, sets breakpoint, starts debugging. Includes automatic cleanup on failure. Uses configurable options for language (default: python), breakpoint location, and DAP launch arguments.

### System Environment Checks
- `isDockerAvailable()` (L153-162): Validates Docker installation via version command with 5s timeout
- `execWithTimeout()` (L167-174): Promise-based command execution with configurable timeout (default: 30s)
- `waitForPort()` (L179-202): Polls health endpoint until server responds with `{status: 'ok'}`, 500ms intervals, configurable timeout

### Docker Management
- `cleanupDocker()` (L207-225): Graceful container shutdown with fallback to force removal
- `getVolumeMount()` (L230-239): Cross-platform path normalization for Docker volumes, handles Windows backslash conversion
- `generateContainerName()` (L244-248): Creates unique container names using timestamp + random suffix
- `getContainerLogs()` (L253-261): Retrieves combined stdout/stderr from containers
- `dockerImageExists()` (L281-289): Checks image presence via `docker images -q`
- `ensureDockerImage()` (L294-313): Conditional image building with 2-minute timeout, skip if exists unless forced

### Output Parsing
- `extractPortFromOutput()` (L266-276): Regex-based port extraction from server startup logs, handles multiple output formats

## Dependencies
- `@modelcontextprotocol/sdk`: MCP client and types
- `child_process`: Command execution via promisified exec
- `util`: Promise utilities

## Architectural Patterns
- Defensive error handling with fallback mechanisms
- Consistent logging with `[Smoke Test]` prefix for test output identification  
- Resource cleanup patterns (debug sessions, Docker containers)
- Cross-platform compatibility considerations (Windows path handling)
- Timeout-based operations to prevent hanging tests

## Critical Constraints
- Assumes MCP ServerResult contains text content in specific array structure
- Docker commands executed without shell, requiring careful argument handling
- Health check endpoint expects specific JSON response format
- All timeouts are hardcoded but reasonable for CI environments