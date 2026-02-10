# src/proxy/utils/
@generated: 2026-02-09T18:16:02Z

## Purpose
The `src/proxy/utils` directory provides utility functions for proxy process lifecycle management, specifically focused on orphan detection and process termination logic. This module helps proxy processes determine when they should gracefully exit due to becoming orphaned (losing their parent process).

## Key Components

### Orphan Detection System
- **Core logic**: `shouldExitAsOrphan()` - Primary decision engine for orphan state detection
- **Environment integration**: `shouldExitAsOrphanFromEnv()` - Convenience wrapper with environment variable support
- **Container awareness**: Built-in logic to handle containerized environments where PPID=1 is normal

## Public API Surface

### Main Entry Points
- `shouldExitAsOrphan(ppid: number, inContainer: boolean): boolean` - Direct orphan check with explicit parameters
- `shouldExitAsOrphanFromEnv(ppid: number, env?: NodeJS.ProcessEnv): boolean` - Environment-aware orphan check

### Usage Pattern
```typescript
// Environment-based detection (recommended)
if (shouldExitAsOrphanFromEnv(process.ppid)) {
  process.exit(0);
}

// Direct control
if (shouldExitAsOrphan(process.ppid, isInContainer)) {
  process.exit(0);
}
```

## Internal Organization
- **Single module design**: Currently contains only orphan detection utilities
- **Environment abstraction**: Separates container detection logic from core orphan logic
- **Testing alignment**: Implementation intentionally mirrors buggy patterns to support regression testing

## Data Flow
1. Process PPID obtained from system
2. Container state determined via `MCP_CONTAINER` environment variable
3. Orphan decision made based on PPID=1 + container state combination
4. Boolean result indicates whether process should exit

## Important Patterns & Conventions

### Container Handling
- Uses `MCP_CONTAINER=true` environment variable for container detection
- Treats PPID=1 as normal in containers (due to PID namespaces)
- Only considers PPID=1 as orphaning outside container environments

### Testing Strategy
- **Intentional bug preservation**: Maintains buggy behavior patterns from parent modules
- **Regression protection**: Ensures unit tests catch when bugs are accidentally fixed
- **Future refactoring**: Temporary implementation pending test validation

## Critical Invariants
- Container detection relies exclusively on `MCP_CONTAINER` environment variable
- PPID=1 indicates orphaning only in non-containerized environments
- Process lifecycle decisions based on parent-child process relationships