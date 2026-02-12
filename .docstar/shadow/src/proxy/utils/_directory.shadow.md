# src\proxy\utils/
@generated: 2026-02-12T21:05:40Z

## Overview

The `src/proxy/utils` directory provides utility functions for proxy process lifecycle management, specifically focused on orphan detection and process termination decisions in both traditional host and containerized environments.

## Core Responsibility

This module handles the critical decision of when a proxy process should terminate due to being orphaned by its parent process. It provides container-aware logic that prevents inappropriate shutdowns in Docker/containerized deployments where PID 1 behavior differs from traditional Unix processes.

## Key Components

### Orphan Detection (`orphan-check.ts`)
- **`shouldExitAsOrphan(ppid, inContainer)`**: Core decision engine that evaluates whether a process should exit based on parent PID and container context
- **`shouldExitAsOrphanFromEnv(ppid, env?)`**: Environment-aware wrapper that automatically detects container status via `MCP_CONTAINER` environment variable

## Public API Surface

**Main Entry Points:**
- `shouldExitAsOrphan(ppid: number, inContainer: boolean): boolean` - Direct orphan check with explicit container flag
- `shouldExitAsOrphanFromEnv(ppid: number, env?: NodeJS.ProcessEnv): boolean` - Environment-based orphan check (recommended)

## Architecture Patterns

**Container-Aware Design**: The module explicitly handles the container deployment pattern where PID 1 is the normal parent process, unlike traditional Unix systems where PID 1 indicates an orphaned process.

**Pure Function Pattern**: All functions are stateless and deterministic, taking explicit parameters rather than relying on global state, making them easily testable and predictable.

**Environment Abstraction**: Provides both low-level control (explicit container flag) and high-level convenience (environment-based detection) to suit different usage patterns.

## Decision Logic

- **Host Process (PPID=1, not container)** → Exit (true orphan)
- **Container Process (PPID=1, in container)** → Continue (normal)  
- **Any Process (PPID≠1)** → Continue (has parent)

This utility module is essential for proxy process stability in mixed deployment environments, preventing premature shutdowns in containerized scenarios while maintaining proper cleanup behavior on traditional hosts.