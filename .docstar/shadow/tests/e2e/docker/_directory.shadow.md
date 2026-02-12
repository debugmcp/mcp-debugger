# tests/e2e/docker/
@generated: 2026-02-11T23:47:43Z

## Purpose
Comprehensive end-to-end test suite for the MCP debugger running inside Docker containers. This directory validates that the debugger MCP server works correctly when containerized, testing debugging functionality across JavaScript, Python, and Rust runtimes in isolated Docker environments.

## Key Components

### Test Utilities (`docker-test-utils.ts`)
Core infrastructure providing Docker container management and MCP client integration:
- **`buildDockerImage()`**: Singleton Docker image builder preventing duplicate builds
- **`createDockerMcpClient()`**: Creates MCP client connected to containerized debugger via stdio transport
- **`hostToContainerPath()`**: Cross-platform path translation from host to container filesystem
- **`cleanupContainer()`**: Container lifecycle management with graceful cleanup
- **`getDockerLogs()`**: Debug log retrieval for troubleshooting

### Language-Specific Test Suites
Three comprehensive smoke test files validating debugging workflows:

#### JavaScript Tests (`docker-smoke-javascript.test.ts`)
- Full debugging cycle with breakpoints, stack inspection, variable access
- Step-over and step-into execution control
- Expression evaluation in debug context
- Multiple concurrent breakpoints
- Source code context retrieval

#### Python Tests (`docker-smoke-python.test.ts`)
- Complete Python debugging workflow validation
- Variable state verification before/after operations
- DAP (Debug Adapter Protocol) integration
- Expression evaluation and execution control

#### Rust Tests (`docker-smoke-rust.test.ts`)
- Basic and async Rust debugging scenarios
- Conditional execution based on environment flags
- Linux target compilation for Docker compatibility
- Async variable inspection with polling mechanisms

## Test Architecture

### Common Patterns
- **Container Isolation**: Each test suite runs in isolated Docker containers with proper cleanup
- **Conditional Execution**: Environment flags (`SKIP_DOCKER`, `DOCKER_RUST_ENABLED`) control test execution
- **Extended Timeouts**: 60-240 second timeouts accommodate Docker operation overhead
- **Resource Management**: Comprehensive cleanup in afterAll/afterEach hooks preventing resource leaks
- **Path Translation**: Host-to-container path mapping for file operations

### Lifecycle Management
1. **Setup**: Docker image building and container creation
2. **Test Execution**: MCP client communication with containerized debugger
3. **Cleanup**: Session closure, container teardown, conditional log extraction

### Error Handling
- Docker log extraction on test failures
- Graceful cleanup tolerating session errors
- Extensive try-catch blocks with debug information collection

## Public API Surface

### Main Entry Points
- **Test Execution**: Jest test suites with conditional Docker execution
- **Docker Utilities**: Exported functions for container management and path translation
- **MCP Integration**: Client creation and protocol communication utilities

### Configuration
- Environment-based test skipping and Docker image override
- Configurable log levels and rebuild flags
- Cross-platform compatibility (Windows/Unix permission handling)

## Internal Organization

### Data Flow
1. Host system triggers test execution
2. Docker utilities build/manage containers
3. MCP clients establish stdio transport to containerized debugger
4. Language-specific tests execute debugging operations
5. Cleanup utilities ensure proper resource disposal

### Key Dependencies
- MCP SDK for protocol communication
- Docker CLI for container operations
- Language-specific example files for debugging targets
- Node.js child_process for command execution

## Critical Constraints
- Requires Docker runtime environment
- Linux target compilation for Rust tests
- Container workspace mounted at `/workspace/`
- Explicit session cleanup prevents resource leaks
- Cross-platform path normalization for Windows/Unix compatibility

This directory serves as the primary validation suite ensuring the MCP debugger functions correctly in containerized deployment scenarios across multiple programming languages.