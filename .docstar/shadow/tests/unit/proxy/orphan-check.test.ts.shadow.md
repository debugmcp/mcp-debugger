# tests/unit/proxy/orphan-check.test.ts
@source-hash: d09512c453933f03
@generated: 2026-02-09T18:14:43Z

## Purpose
Unit test suite for orphan process detection utilities, ensuring proper behavior of proxy process lifecycle management based on parent process ID and container environment detection.

## Test Structure

### shouldExitAsOrphan Tests (L5-17)
Tests the core orphan detection logic with three scenarios:
- **Init process outside containers (L6-8)**: Verifies orphan detection when parent PID is 1 and not in container
- **Container namespace protection (L10-12)**: Ensures processes don't exit as orphans when running inside containers
- **Non-init parent process (L14-16)**: Confirms no orphan exit when parent PID is not 1

### shouldExitAsOrphanFromEnv Tests (L19-42)
Tests environment-aware orphan detection wrapper:
- **Environment variable parsing (L20-27)**: Validates MCP_CONTAINER flag interpretation ('true'/'false')
- **Process.env fallback (L29-41)**: Tests default behavior when no explicit env object provided, with proper cleanup of modified environment state

## Key Dependencies
- **Vitest testing framework**: `describe`, `it`, `expect` (L1)
- **Orphan check utilities**: `shouldExitAsOrphan`, `shouldExitAsOrphanFromEnv` from `../../../src/proxy/utils/orphan-check.js` (L2)

## Testing Patterns
- Uses boolean parameters to simulate container/non-container environments
- Employs proper environment variable cleanup in try/finally blocks (L32-40)
- Tests both direct function calls and environment-driven behavior
- Covers edge cases like undefined environment variables (L35-38)

## Critical Test Logic
The tests validate that orphan detection correctly identifies when a proxy process should terminate itself based on:
1. Parent process ID (1 = init process, indicating orphaned state)
2. Container environment flag (containers handle orphan processes differently)
3. Environment variable parsing and fallback mechanisms