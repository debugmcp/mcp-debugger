# tests\e2e\docker/
@children-hash: a47f831d8d2bf34c
@generated: 2026-02-15T09:01:25Z

## Purpose
End-to-end Docker integration test suite for the MCP Debugger. This module validates that debugging functionality works correctly when the MCP debugger server runs inside Docker containers across multiple programming languages (JavaScript, Python, Rust). Ensures containerized debugging maintains full protocol compatibility and path resolution accuracy.

## Key Components

### Core Test Infrastructure
- **docker-test-utils.ts**: Central utilities providing Docker container lifecycle management, MCP client setup, and path translation between host and container filesystems
- **Language-specific test suites**: Comprehensive smoke tests for JavaScript, Python, and Rust debugging scenarios

### Docker Test Utilities (Public API)
- `buildDockerImage(config?)`: Builds or reuses Docker image with singleton pattern
- `createDockerMcpClient(config)`: Creates MCP client connected to containerized debugger
- `hostToContainerPath(hostPath)`: Translates host paths to container-relative paths
- `cleanupContainer(name)`: Stops and removes Docker containers
- `getDockerLogs(name)`: Retrieves container logs for debugging

### Test Suite Architecture
Each language test follows consistent patterns:
- **Environment-based execution**: Conditional test running via `SKIP_DOCKER` or language-specific flags
- **Container lifecycle management**: Docker image building, container creation, and cleanup
- **Complete debugging workflows**: Session creation, breakpoint management, execution control, variable inspection
- **Comprehensive error handling**: Docker log extraction on failures, graceful cleanup

## Internal Organization

### Test Execution Flow
1. **Setup Phase**: Build Docker image (`mcp-debugger:test`), create containerized MCP client
2. **Test Phase**: Execute full debugging cycles with language-specific examples
3. **Cleanup Phase**: Close debug sessions, remove containers, collect logs on failure

### Path Resolution System
- Host workspace (`/examples`) maps to container mount (`/workspace`)
- Cross-platform path normalization for Windows/Unix compatibility
- Automatic conversion of host file paths to container-accessible paths

### Data Flow
```
Host Test Runner → Docker Container → MCP Debugger Server → Debug Adapter Protocol → Language Runtime
```

## Public API Surface

### Main Entry Points
- `docker-smoke-javascript.test.ts`: JavaScript debugging validation
- `docker-smoke-python.test.ts`: Python debugging validation  
- `docker-smoke-rust.test.ts`: Rust debugging validation
- `docker-test-utils.ts`: Shared Docker infrastructure utilities

### Configuration
- Environment variables: `SKIP_DOCKER`, `DOCKER_RUST_ENABLED`, `FORCE_DOCKER_BUILD`
- Docker image: `mcp-debugger:test` with configurable naming
- Timeouts: Extended (60-240s) to accommodate Docker overhead

## Key Patterns

### Resource Management
- Singleton Docker build pattern prevents duplicate image creation
- Explicit cleanup functions returned from setup operations
- Comprehensive error handling with container log collection
- Auto-removal containers with manual cleanup fallback

### Cross-Platform Compatibility
- Unix-specific user ID mapping for permission handling
- CI environment detection for permission adjustments
- Path normalization for Windows/Unix filesystem differences

### Testing Conventions
- Complete debugging cycles: session → breakpoint → execution → inspection → cleanup
- Multiple test scenarios per language: basic debugging, stepping, multiple breakpoints, source context
- Consistent error handling with Docker log extraction for failure diagnosis

## Dependencies
- MCP SDK for debugger protocol communication
- Docker Engine for containerized test execution
- Language-specific debug adapters and example programs
- Node.js child_process for Docker command execution

This module serves as the primary validation layer ensuring the MCP Debugger maintains full functionality when deployed in containerized environments, critical for production deployment scenarios.