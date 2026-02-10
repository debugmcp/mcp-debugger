# tests/e2e/docker/docker-test-utils.ts
@source-hash: cf8b4f2f2f3de6bc
@generated: 2026-02-09T18:14:36Z

## Primary Purpose
Test utilities for running MCP (Model Context Protocol) debugger integration tests against Docker containers. Provides Docker image management, container lifecycle control, and MCP client creation for end-to-end testing scenarios.

## Key Functions and Classes

**buildDockerImage** (L34-65): Manages Docker image building with singleton pattern caching via `dockerBuildPromise` (L20). Supports force rebuild via config or environment variable. Delegates to external script `scripts/docker-build-if-needed.js` for conditional builds.

**runDockerBuild** (L67-77): Internal helper that executes `docker build` command directly, bypassing conditional logic.

**isContainerRunning** (L82-89): Checks if named container exists in running state using `docker ps` filtering.

**cleanupContainer** (L94-110): Forcibly stops and removes containers with graceful error handling for non-existent containers.

**createDockerMcpClient** (L115-197): Core function that:
- Creates unique container names with timestamps
- Mounts workspace and logs directories 
- Handles platform-specific user permissions (Unix vs Windows/CI)
- Returns MCP client, transport, and cleanup function
- Uses StdioClientTransport for communication

**hostToContainerPath** (L203-240): Path transformation utility converting host filesystem paths to container-relative paths. Handles multiple path formats and normalizes to relative workspace paths.

**getDockerLogs** (L245-252): Retrieval utility for container logs with 100-line tail limit.

## Key Dependencies
- `@modelcontextprotocol/sdk/client`: MCP client and stdio transport
- Node.js `child_process`: Docker command execution
- Path utilities for filesystem operations

## Configuration Interface
**DockerTestConfig** (L22-28): Optional configuration object supporting image name, container name, workspace mount path, log level, and force rebuild flag.

## Architectural Patterns
- Singleton pattern for Docker build caching to prevent duplicate builds
- Resource cleanup pattern with comprehensive error handling
- Platform-aware user permission handling for local development vs CI environments
- Path normalization for cross-platform compatibility

## Critical Constraints
- Default image name: `mcp-debugger:local` (L19)
- Workspace mount point: `/workspace` in container
- Containers use `--rm` flag for automatic cleanup
- Unix platforms use current user UID/GID to prevent root-owned files
- CI environments skip user mapping to avoid permission conflicts