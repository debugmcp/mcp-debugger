# tests/e2e/docker/docker-test-utils.ts
@source-hash: cf8b4f2f2f3de6bc
@generated: 2026-02-10T00:41:27Z

## Purpose
Test utilities for running MCP debugger end-to-end tests against Docker containers. Provides Docker image building, container lifecycle management, and MCP client setup for containerized testing.

## Key Components

### Configuration Interface
- `DockerTestConfig` (L22-28): Configuration interface for Docker test parameters including image name, container name, workspace mount, log level, and force rebuild flag.

### Docker Image Management
- `buildDockerImage()` (L34-65): Main entry point for ensuring Docker image is built. Uses singleton pattern with `dockerBuildPromise` (L20) to prevent duplicate builds. Supports force rebuild via config or environment variable.
- `runDockerBuild()` (L67-77): Internal function that executes raw `docker build` command with error handling.

### Container Lifecycle
- `isContainerRunning()` (L82-89): Checks if named container is currently running using `docker ps` filter.
- `cleanupContainer()` (L94-110): Stops and removes container with graceful error handling for non-existent containers.

### MCP Client Integration
- `createDockerMcpClient()` (L115-197): Creates MCP client connected to Docker container via stdio transport. Handles container setup, user permissions (Unix-specific), volume mounts, and returns client with cleanup function.

### Path Utilities
- `hostToContainerPath()` (L203-240): Converts host filesystem paths to container-relative paths. Handles workspace mapping from `/examples` to `/workspace` mount point with cross-platform path normalization.
- `getDockerLogs()` (L245-252): Retrieves Docker container logs for debugging purposes.

## Dependencies
- Node.js child_process for Docker command execution
- MCP SDK client and stdio transport for protocol communication
- Standard path/URL utilities for cross-platform compatibility

## Architecture Patterns
- Singleton build promise prevents duplicate Docker builds
- Resource cleanup pattern with explicit cleanup functions
- Cross-platform compatibility with Windows/Unix permission handling
- Environment-aware configuration (CI vs local development)

## Key Constants
- `DEFAULT_IMAGE` (L19): Default Docker image name with environment override
- `ROOT` (L18): Project root directory for relative path calculations
- Volume mounts: `/workspace` (examples), `/tmp` (logs)

## Critical Behaviors
- User ID mapping only applied on Unix systems outside CI to prevent permission issues
- Containers use `--rm` flag for auto-cleanup but include manual cleanup as fallback
- Path conversion strips absolute paths and workspace prefixes to create container-relative paths