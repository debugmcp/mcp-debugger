# src\proxy\utils/
@children-hash: 9d552a0dfeee4a14
@generated: 2026-02-15T09:01:16Z

## Overall Purpose

The `src/proxy/utils` directory provides utility functions for proxy process lifecycle management, specifically focused on orphan detection and container-aware process termination decisions.

## Key Components

**orphan-check.ts** - Core utility module containing functions for determining when a proxy process should terminate due to being orphaned from its parent process.

## Public API Surface

### Main Entry Points

- `shouldExitAsOrphan(ppid: number, inContainer: boolean): boolean` - Core decision function that determines if a process should exit based on PPID and container context
- `shouldExitAsOrphanFromEnv(ppid: number, env?: NodeJS.ProcessEnv): boolean` - Environment-aware wrapper that auto-detects container status from `MCP_CONTAINER` environment variable

## Internal Organization and Data Flow

The module follows a layered approach:
1. **Core Logic Layer**: `shouldExitAsOrphan()` implements the fundamental orphan detection rules
2. **Environment Abstraction Layer**: `shouldExitAsOrphanFromEnv()` handles environment variable parsing and delegates to core logic
3. **Container Detection**: Uses `MCP_CONTAINER` environment variable to determine deployment context

Data flow: Environment variables → Container detection → PPID evaluation → Exit decision

## Important Patterns and Conventions

### Container-Aware Architecture
The utilities implement special handling for containerized environments where PPID=1 is expected behavior (due to PID namespaces) rather than indicating an orphaned process.

### Decision Rules
- **Host Process**: PPID=1 indicates orphaning → should exit
- **Container Process**: PPID=1 is normal → should NOT exit  
- **Any Context**: PPID≠1 indicates living parent → should NOT exit

### Pure Function Design
All functions are pure with explicit parameters, making the utilities easily testable and predictable in behavior.

This directory serves as a critical component for proxy process stability, preventing zombie processes while correctly handling modern containerized deployment scenarios.