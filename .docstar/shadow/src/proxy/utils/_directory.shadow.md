# src/proxy/utils/
@generated: 2026-02-10T21:26:16Z

## Purpose and Responsibility

The `src/proxy/utils` directory provides utility functions for proxy process lifecycle management, specifically focused on orphan detection and container-aware process management. This module serves as a critical component for maintaining proxy process health and preventing zombie processes in both traditional host environments and containerized deployments.

## Key Components and Relationships

Currently contains a single specialized utility module:

- **orphan-check.ts**: Core orphan detection logic with container-aware behavior

The module implements a layered approach where the core decision logic is separated from environment detection, allowing for both explicit control and automatic environment-based decisions.

## Public API Surface

### Main Entry Points

- `shouldExitAsOrphan(ppid: number, inContainer: boolean): boolean` - Core decision function for orphan detection
- `shouldExitAsOrphanFromEnv(ppid: number, env?: NodeJS.ProcessEnv): boolean` - Environment-aware wrapper that automatically detects container status

### Key Parameters

- **ppid**: Process parent ID to evaluate
- **inContainer**: Boolean flag indicating container environment
- **env**: Optional environment variables object (defaults to process.env)

## Internal Organization and Data Flow

The module follows a simple but effective pattern:

1. **Environment Detection**: Uses `MCP_CONTAINER` environment variable to determine deployment context
2. **Core Logic Evaluation**: Applies container-aware rules to PPID analysis
3. **Decision Output**: Returns boolean indication of whether process should exit

Data flows from environment → container detection → PPID evaluation → exit decision.

## Important Patterns and Conventions

### Container-Aware Architecture

The module implements a crucial pattern for modern cloud-native deployments:
- **Host Environment**: PPID=1 indicates orphaned process (should exit)
- **Container Environment**: PPID=1 is expected behavior due to PID namespaces (should NOT exit)
- **Active Parent**: PPID≠1 indicates healthy parent process (should NOT exit)

### Pure Function Design

All functions are pure with no side effects, making them:
- Easily testable
- Predictable in behavior  
- Safe for concurrent usage
- Simple to reason about

### Environment Variable Convention

Uses `MCP_CONTAINER` environment variable as the standard mechanism for container detection, providing a consistent way to signal containerized deployments across the MCP ecosystem.