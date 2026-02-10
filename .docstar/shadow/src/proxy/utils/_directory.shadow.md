# src/proxy/utils/
@generated: 2026-02-10T01:19:28Z

## Purpose

The `src/proxy/utils` directory provides utility functions for proxy process lifecycle management, specifically focused on detecting and handling orphaned processes in various deployment environments.

## Key Components

**orphan-check.ts** - Core orphan detection module containing:
- `shouldExitAsOrphan(ppid, inContainer)` - Primary decision logic for orphan detection
- `shouldExitAsOrphanFromEnv(ppid, env?)` - Environment-aware convenience wrapper

## Public API Surface

**Primary Entry Points:**
- `shouldExitAsOrphanFromEnv(ppid, env?)` - Recommended high-level interface that automatically detects container environments
- `shouldExitAsOrphan(ppid, inContainer)` - Lower-level interface for explicit container state control

## Internal Organization

The module follows a layered approach:
1. **Core Logic Layer**: Pure function implementing the orphan detection algorithm
2. **Environment Abstraction Layer**: Wrapper that handles environment variable detection and defaults

## Data Flow

1. Process PPID and environment variables flow into detection functions
2. Container status is determined from `MCP_CONTAINER` environment variable
3. Decision logic evaluates PPID=1 condition against container context
4. Boolean result indicates whether process should exit as orphaned

## Key Patterns & Conventions

**Container-Aware Design**: The module explicitly handles the containerization paradigm where PPID=1 is normal behavior rather than indicating orphaned status.

**Environment Variable Convention**: Uses `MCP_CONTAINER` as the standard indicator for container deployment context.

**Pure Function Architecture**: All functions are stateless and side-effect free, making them easily testable and predictable.

**Defensive Defaults**: The environment-aware wrapper uses `process.env` as default, providing convenient usage while maintaining flexibility.