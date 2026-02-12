# tests\e2e\docker/
@generated: 2026-02-12T21:05:45Z

## Purpose
End-to-end test suite for validating MCP debugger functionality when running inside Docker containers. This directory contains comprehensive smoke tests that verify the debugger works correctly across multiple language runtimes (JavaScript, Python, Rust) in containerized environments.

## Key Components

### Core Test Files
- **docker-smoke-javascript.test.ts**: Tests JavaScript/Node.js debugging workflows including breakpoints, stepping, variable inspection, and expression evaluation
- **docker-smoke-python.test.ts**: Validates Python debugging functionality with comprehensive debugging cycle tests including variable state verification and source context retrieval
- **docker-smoke-rust.test.ts**: Tests Rust debugging capabilities with focus on async code debugging and variable inspection in compiled environments

### Infrastructure Utilities
- **docker-test-utils.ts**: Shared Docker infrastructure providing image building, container lifecycle management, MCP client setup, and path translation utilities

## Public API Surface

### Main Entry Points
Each test file exports test suites that can be executed independently:
- JavaScript smoke tests with 6 comprehensive test scenarios
- Python smoke tests covering full debugging workflows
- Rust smoke tests with conditional execution based on environment flags

### Docker Utilities API
- `buildDockerImage(config)`: Ensures Docker image is built for testing
- `createDockerMcpClient(config)`: Creates MCP client connected to containerized debugger
- `hostToContainerPath(path)`: Converts host paths to container-relative paths
- `cleanupContainer(name)`: Handles container lifecycle cleanup
- `getDockerLogs(name)`: Retrieves container logs for debugging

## Internal Organization

### Test Architecture Pattern
All test files follow consistent structure:
1. **Setup Phase**: Docker image building and container creation with extended timeouts (240s)
2. **Test Execution**: Language-specific debugging workflows with comprehensive error handling
3. **Cleanup Phase**: Session closure, container teardown, and conditional log extraction

### Common Testing Workflow
Each language test implements similar debugging cycle:
1. Debug session creation with container-specific naming
2. Breakpoint setting using container path translation
3. Debug launch with DAP protocol configuration
4. Stack trace and variable inspection
5. Execution control (step over, step into, continue)
6. Expression evaluation in debug context
7. Proper session termination and cleanup

### Path Resolution Strategy
- Host paths converted to container paths via `hostToContainerPath()`
- Workspace mounted at `/workspace/` with examples directory mapping
- Cross-platform compatibility with Windows/Unix path normalization

## Data Flow

### Container Lifecycle
1. **Image Build**: Singleton pattern prevents duplicate builds across tests
2. **Container Creation**: Dynamic naming with timestamps for isolation
3. **MCP Client Setup**: Stdio transport connection to containerized debugger
4. **Test Execution**: Debug protocol operations via MCP tool calls
5. **Resource Cleanup**: Container removal and client disconnection

### Error Handling Pipeline
- Docker operation failures trigger log extraction for debugging
- Session cleanup includes error tolerance to prevent test cascade failures
- Extended timeouts (60-120s) accommodate Docker operation overhead

## Important Patterns

### Conditional Execution
Tests use environment flags (`SKIP_DOCKER`, `DOCKER_RUST_ENABLED`) to enable selective test execution based on environment capabilities.

### Resource Management
- Explicit cleanup functions prevent resource leaks
- Container auto-removal with manual cleanup fallback
- Session lifecycle tracking across test boundaries

### Cross-Platform Compatibility
- User ID mapping only on Unix systems outside CI
- Path normalization handles Windows/Unix differences
- Volume mount strategies adapt to platform requirements

## Critical Invariants
- All file operations use container paths, not host paths
- Debug sessions must be explicitly closed to prevent resource leaks
- Container cleanup is essential for test isolation between runs
- Error states trigger comprehensive log collection for post-mortem analysis