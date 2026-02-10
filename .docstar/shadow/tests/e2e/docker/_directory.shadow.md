# tests/e2e/docker/
@generated: 2026-02-10T01:19:40Z

## Purpose
End-to-end test suite for validating MCP (Model Context Protocol) debugger functionality when running inside Docker containers. This directory contains comprehensive smoke tests that verify debugging workflows across multiple programming languages (JavaScript, Python, Rust) in containerized environments.

## Key Components

### Core Test Files
- **docker-smoke-javascript.test.ts**: E2E tests for JavaScript debugging in containers, covering full debugging cycles, breakpoint management, stack inspection, and expression evaluation
- **docker-smoke-python.test.ts**: Comprehensive Python debugging tests validating DAP (Debug Adapter Protocol) integration and variable inspection
- **docker-smoke-rust.test.ts**: Rust debugging validation including async debugging scenarios and variable inspection

### Infrastructure Utilities
- **docker-test-utils.ts**: Shared utility module providing Docker image building, container lifecycle management, MCP client setup, and path translation between host and container filesystems

## Public API Surface

### Main Entry Points
- Each test file exports Jest test suites that can be run independently or as part of the full test suite
- Tests are conditionally executed based on environment flags (`SKIP_DOCKER`, `DOCKER_RUST_ENABLED`)
- All tests follow the same pattern: setup → debug session → operations → cleanup

### Key Utilities (docker-test-utils.ts)
- `buildDockerImage(config?)`: Ensures Docker image is built with singleton pattern
- `createDockerMcpClient(config?)`: Creates MCP client connected to containerized debugger
- `hostToContainerPath(path)`: Converts host paths to container-relative paths
- `cleanupContainer(containerName)`: Manages container lifecycle cleanup

## Internal Organization and Data Flow

### Test Lifecycle Pattern
1. **Setup Phase**: Build Docker image, create containerized MCP client with proper volume mounts
2. **Test Execution**: Create debug sessions, set breakpoints, execute debugging operations
3. **Cleanup Phase**: Close debug sessions, stop containers, extract logs on failure

### Path Translation System
- Host paths are translated to container paths via `/workspace` mount point
- Examples directory (`/examples`) maps to container `/workspace/`
- Cross-platform path normalization handles Windows/Unix differences

### Resource Management
- Singleton Docker build promise prevents duplicate image builds
- Comprehensive cleanup handlers in afterAll/afterEach hooks
- Extended timeouts (60-240s) accommodate Docker operation overhead
- Graceful error handling with Docker log extraction for debugging

## Key Patterns and Conventions

### Container Configuration
- Uses `mcp-debugger:test` as default image name
- Containers run with `--rm` flag for auto-cleanup
- Unix systems apply user ID mapping to prevent permission issues
- Volume mounts: `/workspace` (examples), `/tmp` (logs)

### MCP Protocol Integration
- All interactions use `callTool` pattern with structured arguments
- Responses parsed via `parseSdkToolResult` utility
- Session management with explicit session IDs for tracking
- Container-specific naming conventions for debug sessions

### Error Handling Strategy
- Docker log retrieval on test failures for debugging
- Tolerant cleanup that handles non-existent resources
- Try-catch blocks around critical Docker operations
- Conditional test execution based on environment capabilities

### Cross-Language Testing
- Consistent debugging workflow patterns across JavaScript, Python, and Rust
- Language-specific file targets and compilation requirements
- Unified breakpoint, variable inspection, and execution control testing

## Dependencies
- MCP SDK for debugger protocol communication
- Docker engine for containerization
- Language-specific runtime environments (Node.js, Python, Rust)
- Jest testing framework with extended timeout configurations

This module serves as the primary validation layer for Docker-based MCP debugger deployments, ensuring debugging functionality works reliably across containerized environments and multiple programming languages.