# src\utils\container-path-utils.ts
@source-hash: e072b8b97f6f0bbd
@generated: 2026-02-23T15:25:59Z

**Purpose**: Centralized path resolution utilities for handling container vs host runtime environments in the DebugMCP application. Implements deterministic path transformation logic with clear error handling and policy enforcement.

**Key Functions**:

- `isContainerMode(environment)` (L17-19): Detects container mode by checking `MCP_CONTAINER=true` environment variable
- `getWorkspaceRoot(environment)` (L25-40): Retrieves and normalizes workspace root from `MCP_WORKSPACE_ROOT`, throws descriptive errors if missing in container mode
- `resolvePathForRuntime(inputPath, environment)` (L52-69): Core path resolution logic - passes through unchanged in host mode, prefixes with workspace root in container mode with idempotent handling
- `getPathDescription(originalPath, resolvedPath, environment)` (L75-89): Generates debugging-friendly path descriptions showing original→resolved transformation

**Dependencies**: 
- `@debugmcp/shared` for `IEnvironment` interface (L12)

**Architecture**: 
- Stateless utility functions following functional programming patterns
- Single source of truth for path resolution across deployment modes
- Environment-driven behavior switching without OS-specific logic
- Defensive programming with clear error messages and validation

**Key Policies** (L4-10):
- No smart heuristics or OS transformations
- Container mode strictly requires `MCP_WORKSPACE_ROOT` 
- Deterministic behavior across all scenarios
- Centralized path resolution to avoid inconsistencies

**Critical Logic**:
- Container path detection uses exact string matching on workspace root prefix (L62)
- Leading slash normalization prevents double-slash artifacts (L67)
- Trailing slash removal ensures consistent workspace root format (L39)
- Idempotent resolution - already-resolved paths pass through unchanged (L62-64)