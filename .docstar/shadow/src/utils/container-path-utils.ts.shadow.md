# src/utils/container-path-utils.ts
@source-hash: a5ae1c3b7b4015ba
@generated: 2026-02-10T00:41:50Z

**Primary Purpose**: Centralized path resolution utilities for container and host deployment modes. Provides deterministic path handling without OS-specific transformations or validation heuristics.

**Key Functions**:
- `isContainerMode(environment)` (L17-19): Environment mode detection based on `MCP_CONTAINER` env var
- `getWorkspaceRoot(environment)` (L25-40): Container workspace root retrieval with validation and normalization (removes trailing slashes)
- `resolvePathForRuntime(inputPath, environment)` (L52-64): Core path resolution - passthrough for host mode, workspace prefix for container mode
- `getPathDescription(originalPath, resolvedPath, environment)` (L70-84): Debug-friendly path display for error messages

**Architecture & Policy**:
- Single source of truth for all path resolution across the application
- Container mode requires `MCP_WORKSPACE_ROOT` environment variable (mount point)
- No smart heuristics or OS transformations - simple prefix-based resolution
- Clear separation between host mode (unchanged paths) and container mode (workspace-prefixed paths)

**Dependencies**:
- `IEnvironment` from `@debugmcp/shared` - environment variable abstraction

**Runtime Behavior**:
- Host mode: Input paths returned unchanged
- Container mode: All paths prefixed with normalized workspace root (`/workspace/inputPath`)
- Strict error handling when required environment variables missing

**Critical Constraints**:
- Container mode detection relies solely on `MCP_CONTAINER=true`
- Workspace root normalization ensures no trailing slashes for consistency
- No path validation or rejection - simple deterministic transformation