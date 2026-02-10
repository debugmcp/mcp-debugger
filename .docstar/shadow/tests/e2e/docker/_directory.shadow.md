# tests/e2e/docker/
@generated: 2026-02-09T18:16:10Z

## Overall Purpose

The `tests/e2e/docker` directory provides a comprehensive test suite for validating the MCP (Model Context Protocol) debugger functionality within Docker containers. This module ensures that debugging capabilities work correctly across multiple programming languages (JavaScript, Python, Rust) when the debugger server runs in a containerized environment.

## Key Components and Architecture

### Core Test Utilities (`docker-test-utils.ts`)
Central infrastructure module providing:
- **Docker Image Management**: Singleton-pattern Docker image building with conditional rebuilds
- **Container Lifecycle**: Creation, cleanup, and monitoring of test containers
- **MCP Client Factory**: Creates containerized MCP clients with proper workspace mounting and permissions
- **Path Translation**: Converts host filesystem paths to container-relative paths
- **Resource Management**: Handles container logs, cleanup, and platform-specific user permissions

### Language-Specific Test Suites
- **JavaScript Tests** (`docker-smoke-javascript.test.ts`): Full debugging lifecycle, stepping operations, multiple breakpoints, source context retrieval
- **Python Tests** (`docker-smoke-python.test.ts`): Complete debugging workflow with variable inspection and expression evaluation
- **Rust Tests** (`docker-smoke-rust.test.ts`): Async debugging capabilities with stack frame validation and cross-compilation support

## Public API Surface

### Primary Entry Points
- `buildDockerImage(config?)`: Builds or retrieves cached Docker image for testing
- `createDockerMcpClient(config?)`: Creates containerized MCP client with cleanup function
- `hostToContainerPath(hostPath)`: Translates host paths to container workspace paths
- `getDockerLogs(containerName)`: Retrieves container logs for debugging failures

### Test Suite Organization
Each language test suite follows consistent patterns:
- Conditional execution via environment variables (`SKIP_DOCKER`, `DOCKER_ENABLE_RUST`)
- Comprehensive setup/teardown with timeout management
- Full debugging cycle validation (session → breakpoint → execution → inspection → cleanup)
- Error recovery with Docker log collection

## Internal Organization and Data Flow

### Test Execution Flow
1. **Setup Phase**: Docker image building, container creation, MCP client connection
2. **Test Execution**: Debug session creation, breakpoint operations, step execution, variable inspection
3. **Cleanup Phase**: Session termination, container cleanup, log collection on failures

### Container Architecture
- Uses `mcp-debugger:test` Docker image with workspace mounting at `/workspace`
- Platform-aware user permission handling (Unix UID/GID mapping vs CI environments)
- StdioClientTransport for MCP communication between host and container
- Automatic container cleanup with `--rm` flag and explicit cleanup functions

## Important Patterns and Conventions

### Resource Management
- **Singleton Docker Builds**: Prevents duplicate image building across test runs
- **Timestamp-based Container Naming**: Ensures container isolation and cleanup
- **Comprehensive Error Handling**: Graceful degradation with detailed logging
- **Cleanup Functions**: Returned from utilities to ensure proper resource disposal

### Cross-Platform Support
- **Path Normalization**: Handles Windows/Unix path differences
- **Permission Handling**: Unix user mapping vs CI environment compatibility
- **Environment Detection**: Conditional test execution based on Docker availability

### Testing Best Practices
- **Extended Timeouts**: 120-240 seconds for Docker operations
- **Strategic Delays**: Timing management for session stabilization
- **Isolation Patterns**: Clean debug sessions between tests
- **Comprehensive Validation**: Stack frames, variables, expressions, and source context

## Dependencies and Requirements

- Docker environment with build and run capabilities
- Vitest testing framework for execution and assertions
- MCP SDK for client-server communication
- Platform-specific example files (JavaScript, Python, Rust)
- Network connectivity for container communication
- Sufficient permissions for Docker operations and file mounting