# src/utils/container-path-utils.ts
@source-hash: a5ae1c3b7b4015ba
@generated: 2026-02-09T18:15:03Z

## Purpose
Centralized path resolution utilities for container and host deployment modes. Provides deterministic path transformation based on runtime environment, with strict policy enforcement for container mode requirements.

## Key Functions

**isContainerMode** (L17-19): Determines if application is running in container mode by checking `MCP_CONTAINER` environment variable equals 'true'.

**getWorkspaceRoot** (L25-40): Retrieves and normalizes workspace root directory for container mode. Throws error if called in host mode or if `MCP_WORKSPACE_ROOT` is missing. Removes trailing slashes for consistency.

**resolvePathForRuntime** (L52-64): Main path resolution function. In host mode, returns input path unchanged. In container mode, prefixes input path with workspace root using simple concatenation (no validation or smart handling).

**getPathDescription** (L70-84): Creates descriptive error message strings showing both original and resolved paths for debugging purposes.

## Dependencies
- `@debugmcp/shared.IEnvironment`: Environment variable access interface

## Architecture & Policies
- Single source of truth for path resolution across deployment scenarios
- Container mode strictly requires `MCP_WORKSPACE_ROOT` environment variable
- No OS-specific transformations or heuristics applied
- Simple prefix-based resolution in container mode with no path validation
- Deterministic behavior guaranteed across environments

## Key Invariants
- Container mode detection is binary based on exact string match
- Workspace root is normalized (no trailing slashes)
- Path resolution is fail-fast with clear error messages
- Host mode paths pass through unmodified