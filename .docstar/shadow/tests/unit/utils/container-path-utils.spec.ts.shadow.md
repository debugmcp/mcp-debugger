# tests/unit/utils/container-path-utils.spec.ts
@source-hash: fa5b82e665d0eb94
@generated: 2026-02-10T00:41:34Z

**Purpose:** Test suite for container path utilities, providing comprehensive coverage for path resolution functionality in both container and non-container environments.

**Key Components:**

- **MockEnvironment (L9-29):** Test double implementing `IEnvironment` interface with configurable environment variables and current working directory. Supports setting arbitrary env vars via constructor and provides standard environment interface methods.

- **isContainerMode tests (L32-42):** Validates container mode detection based on `MCP_CONTAINER` environment variable, testing both true and false scenarios.

- **getWorkspaceRoot tests (L44-62):** Tests workspace root resolution with error conditions:
  - Throws when not in container mode (L45-48)
  - Throws when `MCP_WORKSPACE_ROOT` missing (L50-53)  
  - Normalizes paths by removing trailing slashes (L55-61)

- **resolvePathForRuntime tests (L64-81):** Validates path resolution behavior:
  - Returns original path in non-container mode (L65-70)
  - Prefixes workspace root in container mode (L72-80)

- **getPathDescription tests (L83-100):** Tests path description generation:
  - Returns original path in non-container mode (L84-87)
  - Returns original when resolved equals original (L89-92)
  - Returns descriptive format when paths differ (L94-99)

**Testing Patterns:**
- Uses Vitest framework with describe/it structure
- Employs mock environment for isolated testing
- Tests both positive and negative scenarios
- Validates error conditions with appropriate error messages
- Tests edge cases like trailing slash normalization

**Dependencies:** 
- Vitest testing framework (L1)
- Container path utilities under test (L2-7)
- Assumes `IEnvironment` interface exists (referenced but not imported)

**Critical Test Coverage:**
- Container mode detection logic
- Workspace root validation and normalization  
- Path resolution with workspace prefixing
- Descriptive path formatting for user feedback