# tests/e2e/docker/docker-smoke-rust.test.ts
@source-hash: 2cd38450379899ec
@generated: 2026-02-09T18:14:36Z

## Purpose
E2E test suite for validating Rust debugging functionality when the MCP Debugger runs inside Docker containers. Tests the complete Docker-based debugging workflow for Rust applications.

## Key Components

### Configuration & Environment
- **Environment check (L23-29)**: Conditionally enables tests via `DOCKER_ENABLE_RUST=true`
- **Conditional describe (L45)**: Uses `describe.skip` when Docker Rust is disabled
- **Path constants (L20-22)**: Establishes project root and file paths

### Utility Functions
- **ensureSuccess (L31-36)**: Validates MCP tool responses and provides detailed error logging
- **toContainerAbsolute (L38-43)**: Converts relative paths to absolute container paths with `/workspace/` prefix
- **waitForStackFrame (L54-75)**: Polls for specific stack frames with 20 attempts and 250ms intervals

### Test Infrastructure
- **Setup (L77-96)**: Builds Docker image, prepares Linux Rust binaries, starts containerized MCP server
- **Cleanup (L98-132)**: Closes debug sessions, container cleanup, conditional log output on test failure
- **Session management**: Tracks `sessionId`, `mcpClient`, and `cleanup` function

### Test Cases

#### Hello World Test (L134-198)
- Creates debug session for `hello_world` Rust example
- Sets breakpoint at line 26 of source file
- Executes full debugging cycle: start → continue to breakpoint → continue → close
- Uses 120s timeout for Docker operations

#### Async Variables Test (L200-282)
- Debugs `async_example` Rust application
- Sets breakpoint at line 46
- Waits for async stack frame using path matching
- Inspects local variables, specifically validates `id` variable presence
- Tests async debugging capabilities in containerized environment

## Dependencies
- **MCP SDK**: Client interface for debugger communication
- **Docker utilities**: Image building, container management, path mapping
- **Rust example preparation**: Cross-compilation for Linux target
- **Vitest**: Test framework with sequential execution

## Architecture Notes
- Uses containerized debugging to isolate test environment
- Implements robust retry logic for async operations
- Handles path translation between host and container filesystems
- Provides comprehensive error logging for debugging test failures
- Sequential test execution prevents container conflicts