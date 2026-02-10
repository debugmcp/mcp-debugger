# src/proxy/utils/orphan-check.ts
@source-hash: 25d1a00cf87a291a
@generated: 2026-02-10T01:18:49Z

**Purpose**: Utility module for determining when a proxy process should exit due to being orphaned, with special handling for containerized environments.

**Core Logic**: 
- `shouldExitAsOrphan(ppid, inContainer)` (L11-14): Primary decision function that returns true only when PPID=1 (orphaned) AND not in a container environment. In containers, PPID=1 is normal due to PID namespaces.
- `shouldExitAsOrphanFromEnv(ppid, env?)` (L19-25): Convenience wrapper that determines container status from `MCP_CONTAINER` environment variable before calling core logic.

**Key Behavioral Rules**:
- Normal host process with PPID=1 → should exit (orphaned)
- Container process with PPID=1 → should NOT exit (expected behavior)
- Any process with PPID≠1 → should NOT exit (has living parent)

**Dependencies**: 
- NodeJS.ProcessEnv type for environment variable handling
- process.env as default parameter

**Architecture Pattern**: Simple pure functions with explicit container-awareness to handle the common Docker/container deployment scenario where init process (PID 1) is the normal parent.