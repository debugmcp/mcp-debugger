# src/proxy/utils/
@generated: 2026-02-11T23:47:32Z

## Purpose and Responsibility

The `src/proxy/utils` directory provides essential utility functions for proxy process lifecycle management. Its primary responsibility is to determine when proxy processes should gracefully exit due to being orphaned, with intelligent handling for different deployment environments (bare metal vs. containerized).

## Key Components

The directory currently contains a single focused utility module:

- **orphan-check.ts**: Core orphan detection logic with container-awareness

## Public API Surface

The module exposes two main entry points:

- `shouldExitAsOrphan(ppid: number, inContainer: boolean): boolean` - Primary decision function for orphan detection
- `shouldExitAsOrphanFromEnv(ppid: number, env?: NodeJS.ProcessEnv): boolean` - Environment-aware wrapper that automatically detects container status

## Internal Organization and Data Flow

The module follows a layered approach:

1. **Core Logic Layer**: `shouldExitAsOrphan()` implements the fundamental orphan detection algorithm
2. **Environment Abstraction Layer**: `shouldExitAsOrphanFromEnv()` adds environment detection capabilities
3. **Decision Flow**: PPID=1 detection → container status check → exit decision

## Important Patterns and Conventions

**Container-Aware Design**: The utility explicitly handles the Docker/container deployment pattern where PID 1 is the normal parent process, not an indication of orphaning.

**Pure Function Architecture**: All functions are stateless and side-effect free, making them easily testable and predictable.

**Environment Variable Convention**: Uses `MCP_CONTAINER` environment variable as the standard way to signal container deployment context.

**Behavioral Rules**:
- Host processes with PPID=1: Exit (truly orphaned)
- Container processes with PPID=1: Continue (expected behavior)
- Any process with active parent (PPID≠1): Continue (healthy state)

This utility is essential for proxy process stability and proper resource cleanup in distributed MCP deployments across different infrastructure environments.