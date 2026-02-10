# tests/e2e/docker/
@generated: 2026-02-10T21:26:25Z

## Purpose
Docker-based end-to-end test suite for the MCP debugger, validating debugging functionality across multiple language runtimes (JavaScript, Python, Rust) when the debugger server runs inside Docker containers. Ensures the debugger protocol works correctly in containerized environments with proper path resolution, session management, and debugging workflow support.

## Key Components

### Test Infrastructure (`docker-test-utils.ts`)
Core Docker integration utilities providing:
- **Docker Image Management**: Singleton build system with `buildDockerImage()` preventing duplicate builds
- **Container Lifecycle**: Setup, cleanup, and health checking with `createDockerMcpClient()` and `cleanupContainer()`
- **Path Translation**: Host-to-container path mapping via `hostToContainerPath()` handling workspace mount points
- **MCP Client Factory**: Creates containerized MCP clients with stdio transport and proper resource cleanup

### Language-Specific Test Suites
Three comprehensive test files implementing identical debugging workflow patterns:

**JavaScript Tests (`docker-smoke-javascript.test.ts`)**
- Tests Node.js debugging with extensive breakpoint, stepping, and evaluation scenarios
- 6 test cases covering full debugging cycle, step operations, multiple breakpoints, and source context

**Python Tests (`docker-smoke-python.test.ts`)**
- Validates Python DAP debugging with variable inspection and execution control
- 3 test cases focusing on complete debugging workflow and concurrent breakpoint management

**Rust Tests (`docker-smoke-rust.test.ts`)**
- Tests Rust debugging including async code support with conditional execution based on environment
- 2 test cases for basic and async debugging scenarios with stack frame polling

## Public API Surface

### Primary Entry Points
- **Test Utilities**: `buildDockerImage()`, `createDockerMcpClient()`, `hostToContainerPath()`, `getDockerLogs()`
- **Test Suites**: Language-specific describe blocks with comprehensive debugging workflow validation
- **Configuration**: Environment-based test skipping (`SKIP_DOCKER`, `DOCKER_RUST_ENABLED`)

### Common Test Patterns
All test suites implement standardized debugging workflow:
1. Session creation with container-specific naming
2. Breakpoint setting using container paths
3. Debug launch with DAP configuration
4. Stack trace and variable inspection
5. Execution control (step, continue)
6. Expression evaluation
7. Session cleanup

## Internal Organization

### Data Flow
1. **Setup Phase**: Docker image built, containers launched with MCP server
2. **Test Execution**: MCP client sends debugging commands via stdio transport
3. **Path Resolution**: Host paths converted to container workspace paths (`/workspace/`)
4. **Protocol Communication**: DAP/MCP debugging protocol operations
5. **Cleanup Phase**: Sessions closed, containers terminated, resources released

### Resource Management
- **Lifecycle Hooks**: `beforeAll`/`afterAll` for Docker setup/teardown
- **Session Tracking**: Per-test session IDs with explicit cleanup in `afterEach`
- **Error Handling**: Docker log extraction on test failures for debugging
- **Timeout Management**: Extended timeouts (60-240s) accommodating Docker overhead

## Important Patterns

### Container Isolation
- Each test run uses timestamped container names preventing conflicts
- Workspace mounted at `/workspace/` with examples directory mapping
- User ID mapping on Unix systems for permission compatibility

### Environment Awareness
- Conditional test execution based on Docker availability
- CI-specific configuration adjustments
- Force rebuild capabilities for development workflows

### Path Resolution Strategy
- Host paths: `/path/to/examples/lang/file.ext`
- Container paths: `/workspace/lang/file.ext`
- Automatic workspace prefix stripping and container mount mapping

### Error Resilience
- Graceful handling of container cleanup failures
- Docker log capture for debugging test failures
- Retry mechanisms for async operations (stack frame polling)

## Dependencies
- **MCP SDK**: Core protocol client and transport
- **Docker Engine**: Container runtime for test isolation
- **Language Examples**: Target debugging files in `/examples/` directory
- **Node.js Process**: Child process spawning for Docker command execution

This directory provides comprehensive validation that the MCP debugger works correctly in containerized deployments across multiple programming languages, ensuring production readiness for Docker-based development environments.