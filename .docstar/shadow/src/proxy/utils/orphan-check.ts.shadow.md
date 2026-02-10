# src/proxy/utils/orphan-check.ts
@source-hash: e18d72528f6416f5
@generated: 2026-02-09T18:14:33Z

## Purpose
Utility module for determining when a proxy process should exit due to orphaned state. Contains intentionally buggy implementation to support regression testing strategy.

## Key Functions

### `shouldExitAsOrphan(ppid: number, inContainer: boolean): boolean` (L12-15)
Core decision logic for orphan detection. Returns `true` when process should exit as orphaned.
- **Current logic**: Exit when not in container AND PPID equals 1
- **Parameters**: `ppid` - parent process ID, `inContainer` - container environment flag
- **Container awareness**: Avoids false positives in containerized environments where PPID=1 is normal

### `shouldExitAsOrphanFromEnv(ppid: number, env?: NodeJS.ProcessEnv): boolean` (L20-26)
Convenience wrapper that extracts container flag from environment variables.
- **Environment detection**: Reads `MCP_CONTAINER` env var to determine container state (L24)
- **Default parameter**: Uses `process.env` when env not provided (L22)
- **Delegates to**: `shouldExitAsOrphan()` for actual decision logic (L25)

## Architecture Notes
- **Testing strategy**: Implementation intentionally mirrors buggy behavior from `proxy-bootstrap` to ensure unit tests catch regressions
- **Future refactoring**: Comments indicate this is temporary implementation pending test validation
- **Container handling**: Recognizes that PPID=1 in containers (PID namespaces) is expected behavior, not orphaning

## Dependencies
- Node.js `ProcessEnv` type for environment variable typing
- No external dependencies

## Critical Invariants
- Container detection relies on `MCP_CONTAINER=true` environment variable
- PPID=1 only indicates orphaning outside container environments