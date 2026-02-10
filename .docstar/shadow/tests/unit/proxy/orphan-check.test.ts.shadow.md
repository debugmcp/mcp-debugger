# tests/unit/proxy/orphan-check.test.ts
@source-hash: d09512c453933f03
@generated: 2026-02-10T00:41:30Z

## Purpose
Unit test suite for orphan process detection utilities in the proxy module, ensuring proper behavior of orphan exit conditions based on parent process ID and container environment.

## Key Test Functions

### `shouldExitAsOrphan` Tests (L5-17)
Tests the core orphan detection logic with direct parameters:
- **Init process outside containers** (L6-8): Verifies exit when parent PID is 1 and not in container
- **Container namespace protection** (L10-12): Ensures no exit when running inside containers (PID 1 + container flag)  
- **Non-init parent handling** (L14-16): Confirms no exit when parent is not init process (PID 42)

### `shouldExitAsOrphanFromEnv` Tests (L19-42)
Tests environment-aware wrapper function:
- **Environment flag derivation** (L20-27): Validates `MCP_CONTAINER` env var interpretation (`'true'`/`'false'`)
- **Process.env fallback** (L29-41): Tests default behavior when no env argument provided, with proper cleanup

## Dependencies
- **Vitest** (L1): Testing framework
- **Source module** (L2): `../../../src/proxy/utils/orphan-check.js` - imports `shouldExitAsOrphan` and `shouldExitAsOrphanFromEnv`

## Test Patterns
- Direct boolean assertions for exit conditions
- Environment variable manipulation with cleanup (L30-40)
- Container vs non-container scenario coverage
- PID 1 (init process) as primary test case for orphan detection