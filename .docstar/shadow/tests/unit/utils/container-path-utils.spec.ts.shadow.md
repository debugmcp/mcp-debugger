# tests\unit\utils\container-path-utils.spec.ts
@source-hash: b3a6f7cff98ad93d
@generated: 2026-02-23T15:26:02Z

## Purpose
Unit tests for container path resolution utilities. Tests functionality for detecting container mode, workspace root resolution, path transformation for runtime execution, and path description formatting.

## Key Test Structure

**MockEnvironment Class (L10-30)**: Test double implementing `IEnvironment` interface
- Simulates environment variables and working directory
- Constructor accepts custom env vars and cwd (defaults to '/app')
- Provides `get()`, `getAll()`, and `getCurrentWorkingDirectory()` methods

## Test Suites

**isContainerMode Tests (L33-43)**: Validates container mode detection
- Checks MCP_CONTAINER='true' returns true
- Verifies non-true values return false

**getWorkspaceRoot Tests (L45-63)**: Tests workspace root extraction
- Validates error when not in container mode (L46-49)
- Validates error when MCP_WORKSPACE_ROOT missing (L51-54) 
- Tests trailing slash removal (L56-62)

**resolvePathForRuntime Tests (L65-113)**: Core path resolution logic
- Uses shared containerEnv fixture with MCP_CONTAINER='true' and MCP_WORKSPACE_ROOT='/workspace'
- Tests passthrough behavior in non-container mode (L71-76)
- Tests workspace prefix addition for relative paths (L78-82)
- Tests idempotent behavior for already-prefixed paths (L84-88)
- Tests edge cases: workspace root path (L90-94), leading slash stripping (L96-100), multiple slashes (L102-106), bare filenames (L108-112)

**getPathDescription Tests (L115-132)**: Path display formatting
- Tests passthrough in non-container mode (L116-119)
- Tests original path return when resolved matches original (L121-124)
- Tests descriptive format when paths differ in container mode (L126-131)

## Dependencies
- vitest testing framework
- `@debugmcp/shared` for IEnvironment interface
- Container path utilities from `../../../src/utils/container-path-utils.js`

## Test Patterns
- Uses MockEnvironment for isolated testing
- Comprehensive edge case coverage for path resolution
- Clear separation of container vs non-container behavior
- Validates both success and error conditions