# Docker JavaScript Debugging Fix Attempt Summary

## Issue
JavaScript debugging fails in the Docker container with the proxy process receiving a SIGTERM signal immediately after initialization. Python debugging works fine in the same container.

## Root Causes Identified

1. **Path Resolution Issue**: JavaScript adapter needs to resolve relative paths to the `/workspace` mount point
2. **Signal Handling Issue**: Node.js child processes receive SIGTERM when running in Docker containers

## Fixes Applied

### 1. Environment Variable for Workspace Root
- Added `MCP_WORKSPACE_ROOT=/workspace` to Dockerfile
- Updated JavaScript adapter to use this environment variable for path resolution
- Modified `transformLaunchConfig` to prepend workspace root to relative paths in container mode

### 2. Tini for PID1 Signal Handling  
- Added `tini` package to the Docker image
- Updated ENTRYPOINT to use tini as PID1: `ENTRYPOINT ["/usr/bin/tini", "--", "/app/entry.sh"]`
- This ensures proper signal forwarding and zombie process reaping

## Current Status
Despite these fixes, the JavaScript debugging still fails with the same SIGTERM issue. The process hierarchy shows:
- PID 1: tini
- PID 7: entry.sh script
- PID 20: Node.js proxy worker (receives SIGTERM)

## Test Results
```
Error: Proxy exited during initialization. Code: 1, Signal: SIGTERM
Expected state: 'paused'
Actual state: 'error'
```

## Next Steps to Investigate

1. **IPC Channel Issue**: The proxy worker uses IPC communication which might be incompatible with the container's process spawning
2. **Detached Process Group**: Try spawning the proxy with `detached: true` to isolate it from parent process signals
3. **Alternative Communication**: Consider using TCP sockets instead of IPC for proxy communication
4. **Node Version Compatibility**: Test with Node.js v18 LTS to rule out v20-specific issues

## Comparison with Python
Python debugging works because:
- Uses TCP communication (not IPC)
- Debugpy handles container environments better
- No complex proxy/worker process spawning

## Code Changes Made

### Dockerfile
```dockerfile
ENV MCP_WORKSPACE_ROOT=/workspace
RUN apt-get install -y tini
ENTRYPOINT ["/usr/bin/tini", "--", "/app/entry.sh"]
```

### JavaScript Adapter (transformLaunchConfig)
```typescript
const isContainer = process.env.MCP_CONTAINER === 'true';
const workspaceRoot = process.env.MCP_WORKSPACE_ROOT || '/workspace';

if (isContainer && program && !path.isAbsolute(program)) {
  program = path.join(workspaceRoot, program);
}

if (isContainer) {
  cwd = workspaceRoot;
}
```

## Conclusion
The issue appears to be deeper than path resolution and basic signal handling. It's likely related to how Node.js spawns child processes with IPC channels in containerized environments. The consistent SIGTERM signal suggests the parent process or Docker runtime is intentionally terminating the child, possibly due to IPC channel issues or process group management.
