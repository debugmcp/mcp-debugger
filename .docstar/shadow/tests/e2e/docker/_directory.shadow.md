# tests\e2e\docker/
@generated: 2026-02-12T21:00:59Z

## Purpose and Scope
This directory contains comprehensive end-to-end test suites for validating MCP (Model Context Protocol) debugger functionality within Docker containerized environments. Tests multiple language runtimes (JavaScript, Python, Rust) to ensure the debugger works correctly when running inside Docker containers, handling path resolution, breakpoint management, and debugging protocol operations across different execution environments.

## Core Components

### Language-Specific Test Suites
- **docker-smoke-javascript.test.ts**: JavaScript debugging validation with Node.js runtime
- **docker-smoke-python.test.ts**: Python debugging validation with DAP protocol integration  
- **docker-smoke-rust.test.ts**: Rust debugging validation with async/await support and conditional execution
- **docker-test-utils.ts**: Shared Docker infrastructure utilities and MCP client management

### Test Infrastructure Architecture
All test suites follow a consistent pattern:
1. **Container Lifecycle Management**: `beforeAll` builds Docker images, creates containerized MCP clients
2. **Resource Cleanup**: `afterAll` handles session closure, container teardown, log extraction on failures
3. **Per-Test Isolation**: `afterEach` ensures debug sessions are properly closed between tests

## Key Test Workflows

### Standard Debug Cycle Validation
Each language suite tests a complete 8-9 step debugging workflow:
1. Debug session creation with container-specific naming
2. Breakpoint setting using container-translated paths
3. Debug launch with DAP protocol configuration
4. Stack frame retrieval and validation
5. Local variable inspection and state verification
6. Step execution control (step-over, step-into)
7. Expression evaluation in debug context
8. Execution continuation and session termination

### Additional Test Scenarios
- **Multiple Breakpoints**: Concurrent breakpoint management without interference
- **Source Context**: Source code retrieval with configurable context windows
- **Path Resolution**: Host-to-container path mapping validation
- **Error Handling**: Comprehensive error capture with Docker log extraction

## Public API Surface

### Entry Points
- `buildDockerImage(config?)`: Singleton Docker image builder with force rebuild support
- `createDockerMcpClient(config)`: MCP client factory for containerized debugging
- `hostToContainerPath(hostPath)`: Path translation utility for container file access
- `getDockerLogs(containerName)`: Debug log extraction for troubleshooting

### Configuration Interface
- `DockerTestConfig`: Standardized configuration for image names, container settings, workspace mounts, and logging levels
- Environment variables: `SKIP_DOCKER`, `DOCKER_RUST_ENABLED`, `FORCE_DOCKER_BUILD`

## Internal Organization

### Resource Management Pattern
- **Singleton Build**: `dockerBuildPromise` prevents duplicate Docker builds across test suites
- **Cleanup Functions**: Each MCP client returns cleanup function for proper resource deallocation
- **Container Auto-removal**: Uses `--rm` flag with manual cleanup fallback

### Path Translation System
- **Workspace Mapping**: `/examples` host directory → `/workspace` container mount
- **Cross-platform Support**: Handles Windows/Unix path differences
- **Absolute Path Resolution**: Converts relative paths to container-absolute paths

### Error Handling Strategy
- **Extended Timeouts**: 240s for Docker setup, 60-120s for individual tests
- **Graceful Degradation**: Tolerates cleanup errors during test teardown  
- **Debug Log Capture**: Automatic Docker log extraction on test failures
- **Conditional Execution**: Environment-based test skipping for CI/local flexibility

## Critical Dependencies
- **MCP SDK**: Core protocol client for debugger communication
- **Docker Engine**: Container runtime for isolated test execution
- **Language Runtimes**: Node.js, Python interpreter, Rust compiler toolchain
- **Debug Adapters**: DAP protocol support for each target language

## Integration Patterns
The directory serves as the primary validation layer for Docker-specific debugger functionality, ensuring that:
- Container path resolution works correctly across all supported languages
- Debug protocol operations function identically in containerized vs native environments  
- Resource cleanup prevents container/session leaks in CI/CD pipelines
- Cross-platform compatibility is maintained for development environments