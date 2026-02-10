# tests/unit/utils/container-path-utils.spec.ts
@source-hash: fa5b82e665d0eb94
@generated: 2026-02-09T18:14:43Z

**Test File for Container Path Utilities**

Comprehensive unit tests for container path resolution utilities using vitest framework. Tests the behavior of path manipulation functions in both container and non-container execution modes.

## Key Components

**MockEnvironment class (L9-29):** Test double implementing IEnvironment interface
- Constructor accepts custom environment variables and working directory (L13-16)  
- Provides `get()`, `getAll()`, and `getCurrentWorkingDirectory()` methods (L18-28)
- Defaults to `/app` working directory for consistent testing

**Test Suites:**

**isContainerMode tests (L32-42):** Validates container mode detection
- Tests MCP_CONTAINER environment variable parsing
- Covers both true and false cases

**getWorkspaceRoot tests (L44-62):** Validates workspace root resolution
- Tests error conditions: non-container mode (L45-48), missing MCP_WORKSPACE_ROOT (L50-53)
- Verifies trailing slash normalization (L55-61)

**resolvePathForRuntime tests (L64-81):** Tests path resolution logic
- Non-container mode: returns original path unchanged (L65-70)
- Container mode: prefixes workspace root to relative paths (L72-80)

**getPathDescription tests (L83-100):** Tests user-friendly path descriptions
- Non-container mode: returns original path (L84-87)
- Container mode with identical paths: returns original (L89-92)  
- Container mode with different paths: returns descriptive format (L94-99)

## Dependencies
- vitest testing framework
- container-path-utils module functions
- IEnvironment interface (imported implicitly)

## Test Patterns
- Uses dependency injection via MockEnvironment for clean isolation
- Tests both positive and negative cases for each function
- Validates error messages for exceptional conditions
- Focuses on container vs non-container mode behavioral differences