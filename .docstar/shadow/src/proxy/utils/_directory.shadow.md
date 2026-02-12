# src\proxy\utils/
@generated: 2026-02-12T21:00:49Z

## Overall Purpose

The `src/proxy/utils` directory provides utility functions for proxy process lifecycle management, specifically focused on orphan detection and process cleanup decisions in both host and containerized environments.

## Key Components

### Orphan Detection Module (`orphan-check.ts`)
- **Core Function**: `shouldExitAsOrphan(ppid, inContainer)` - Primary decision logic for orphan detection
- **Environment Wrapper**: `shouldExitAsOrphanFromEnv(ppid, env?)` - Convenience function with automatic container detection
- **Container Detection**: Uses `MCP_CONTAINER` environment variable to identify containerized deployments

## Public API Surface

**Main Entry Points:**
- `shouldExitAsOrphanFromEnv(ppid, env?)` - Recommended entry point that automatically detects container environment
- `shouldExitAsOrphan(ppid, inContainer)` - Low-level function for explicit container status scenarios

**Input Parameters:**
- `ppid`: Parent process ID to evaluate
- `inContainer`: Boolean flag for container environment (explicit)
- `env`: Environment variables object (defaults to `process.env`)

## Internal Organization & Data Flow

1. **Environment Detection**: Check `MCP_CONTAINER` environment variable
2. **Container-Aware Logic**: Apply different orphan rules based on deployment context
3. **Decision Output**: Return boolean indicating whether proxy should exit

## Key Behavioral Patterns

**Orphan Detection Rules:**
- **Host Environment**: PPID=1 indicates orphaned process → should exit
- **Container Environment**: PPID=1 is normal (init process parent) → should NOT exit
- **Active Parent**: PPID≠1 in any environment → should NOT exit

**Architecture Conventions:**
- Pure functions with no side effects
- Explicit container-awareness to handle Docker/container deployment patterns
- Environment variable-based configuration
- Defensive defaults using `process.env`

## Integration Context

This utility module supports proxy process management by providing reliable orphan detection that works correctly across different deployment environments, preventing premature process termination in containerized scenarios while maintaining proper cleanup behavior on host systems.