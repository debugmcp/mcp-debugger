# tests/e2e/smoke-test-utils.ts
@source-hash: 5a038b28ee3f8330
@generated: 2026-02-09T18:15:11Z

## Purpose & Scope
Utility module for end-to-end smoke testing of an MCP (Model Context Protocol) debug server. Provides core infrastructure for testing debug sessions, Docker container management, and server health validation.

## Key Interfaces & Types

### ParsedToolResult Interface (L14-19)
Standardized structure for MCP tool responses with optional fields:
- `sessionId?: string` - Debug session identifier
- `success?: boolean` - Operation success flag
- `state?: string` - Current debug state
- Flexible key-value pairs for additional data

## Core Utilities

### MCP Tool Integration
- **parseSdkToolResult** (L21-28): Extracts text content from ServerResult and parses as JSON, with error handling for malformed responses
- **callToolSafely** (L33-68): Safe wrapper for MCP client tool calls with comprehensive error handling for various MCP error formats

### Debug Session Management
- **executeDebugSequence** (L73-148): Orchestrates complete debug workflow:
  1. Creates debug session with language/name
  2. Sets breakpoint at specified file/line
  3. Starts debugging with DAP launch args
  - Includes automatic cleanup on failure
  - Returns session ID and success status

## Docker Infrastructure

### Docker Availability & Management
- **isDockerAvailable** (L153-162): Checks Docker installation via version command
- **cleanupDocker** (L207-225): Safe container cleanup with fallback force removal
- **dockerImageExists** (L281-289): Verifies image presence locally
- **ensureDockerImage** (L294-313): Conditional image building with force option

### Container Utilities
- **generateContainerName** (L244-248): Creates unique container names with timestamp and random suffix
- **getVolumeMount** (L230-239): Cross-platform volume mount string generation (Windows path normalization)
- **getContainerLogs** (L253-261): Retrieves container logs for debugging

## System Integration

### Process & Network Management
- **execWithTimeout** (L167-174): Promise-racing exec wrapper with configurable timeout
- **waitForPort** (L179-202): Health endpoint polling with retry logic for SSE server readiness
- **extractPortFromOutput** (L266-276): Regex-based port extraction from server output logs

## Dependencies
- `@modelcontextprotocol/sdk/client` - MCP client interface
- `@modelcontextprotocol/sdk/types` - ServerResult type definitions
- Node.js `child_process` and `util` - Process execution utilities

## Architecture Notes
- Error-first design with extensive try-catch blocks
- Defensive programming with type guards and null checks
- Consistent logging with `[Smoke Test]` prefixes for traceability
- Graceful degradation for Docker operations
- Cross-platform compatibility (Windows path handling)