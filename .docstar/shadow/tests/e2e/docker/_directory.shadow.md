# tests\e2e\docker/
@children-hash: dea48e027b3ad0b5
@generated: 2026-02-23T15:26:35Z

## Purpose
Docker-based end-to-end testing module for the MCP debugger, providing comprehensive integration tests that validate debugging functionality across multiple programming languages (JavaScript, Python, Rust) when the debugger runs inside Docker containers.

## Key Components and Architecture

### Test Infrastructure (`docker-test-utils.ts`)
Central utility module providing Docker container management and MCP client integration:
- **Image Management**: Singleton-pattern Docker image building with force rebuild capabilities
- **Container Lifecycle**: Start, cleanup, and status checking for test containers
- **MCP Client Factory**: Creates containerized MCP clients with stdio transport and proper volume mounting
- **Path Translation**: Converts between host and container filesystem paths (`/examples` → `/workspace`)

### Language-Specific Test Suites
Three comprehensive smoke test suites that follow consistent patterns:
- **JavaScript Tests** (`docker-smoke-javascript.test.ts`): Node.js debugging with breakpoints, stepping, and variable inspection
- **Python Tests** (`docker-smoke-python.test.ts`): Python DAP debugging with swap operation validation
- **Rust Tests** (`docker-smoke-rust.test.ts`): Async Rust debugging with conditional execution based on environment flags

### Docker Entrypoint Testing (`docker-entrypoint.test.ts`)
Regression test suite specifically for Docker container argument passing, preventing CLI argument corruption issues.

## Public API Surface

### Main Entry Points
- `buildDockerImage()`: Ensures Docker test image is available
- `createDockerMcpClient()`: Creates containerized MCP client with cleanup function
- `hostToContainerPath()`: Path translation utility for container compatibility
- Test suites exported as Vitest test files for CI/CD integration

### Configuration Interface
- `DockerTestConfig`: Standardized configuration for Docker test parameters
- Environment variable controls: `SKIP_DOCKER`, `DOCKER_RUST_ENABLED`, `DOCKER_IMAGE_NAME`

## Internal Organization and Data Flow

### Test Execution Pattern
1. **Setup Phase**: Build Docker image, create containerized MCP client
2. **Debug Session Lifecycle**: Create session → Set breakpoints → Start debugging → Inspect state → Control execution → Cleanup
3. **Teardown Phase**: Close debug sessions, stop containers, collect logs on failure

### Resource Management
- Singleton Docker build promise prevents duplicate operations
- Comprehensive cleanup hooks (`afterAll`, `afterEach`) prevent resource leaks
- Container auto-removal with manual cleanup fallback
- Extended timeouts (60-240 seconds) accommodate Docker operation overhead

### Path and Permission Handling
- Unix-specific user ID mapping for file permission compatibility
- Volume mounting strategy: `/workspace` for examples, `/tmp` for logs
- Cross-platform path normalization and container path translation

## Important Patterns and Conventions

### Error Handling Strategy
- Docker log collection on test failures for debugging
- Graceful cleanup with error tolerance
- Comprehensive try-catch blocks around critical Docker operations

### Container Isolation
- Dynamic container naming with timestamps for parallel test execution
- Isolated workspace environments prevent test interference
- Proper container lifecycle management ensures clean test environments

### Cross-Language Testing Consistency
All language-specific tests follow the same structural pattern:
- Session creation and naming
- Breakpoint setting and validation
- Debug launch with DAP configuration
- Stack frame and variable inspection
- Execution control (step, continue)
- Expression evaluation
- Session cleanup

This module serves as the comprehensive Docker integration testing framework for the MCP debugger, ensuring that containerized debugging workflows function correctly across all supported programming languages and deployment scenarios.