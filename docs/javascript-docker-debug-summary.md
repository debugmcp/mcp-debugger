# JavaScript Docker Debugging Issue Summary

## Problem
JavaScript debugging in Docker fails with "Proxy exited during initialization. Code: 1, Signal: SIGTERM"

## Current Status

### What's Working
1. ✅ File exists at `/workspace/examples/javascript/mcp_target.js`
2. ✅ Node.js v20.19.5 is available in container
3. ✅ js-debug vendor files are present at `/app/packages/adapter-javascript/vendor/js-debug/`
4. ✅ Environment variables set correctly (MCP_CONTAINER=true, MCP_WORKSPACE_ROOT=/workspace)
5. ✅ Python debugging works in the same container setup
6. ✅ Tini is installed and configured as entrypoint for proper signal handling

### The Issue
The proxy process starts but immediately receives SIGTERM during initialization:
```
[Proxy Worker] Starting DAP Proxy worker process...
[Proxy Worker] Node.js version: v20.19.5
[Proxy Worker] Current working directory: /
[INFO] [ProxyRunner] Starting proxy runner...
[INFO] [ProxyRunner] Ready to receive commands
[Signal Debug] Setting up signal handlers for session...
[Signal Debug] Signal handlers installed
```
Then the process receives SIGTERM and exits.

### Path Resolution Flow
1. Test provides path: `examples/javascript/mcp_target.js` (relative)
2. SimpleFileChecker resolves to: `/workspace/examples/javascript/mcp_target.js` (absolute)
3. This path is passed to JavaScript adapter
4. JavaScript adapter launches the proxy with this path

### Key Difference from Python
- Python adapter receives `/workspace/examples/javascript/mcp_target.js` and it works
- JavaScript adapter receives the same path but the proxy exits with SIGTERM

### Hypothesis
The JavaScript adapter or the proxy might be having issues with:
1. The working directory being `/` instead of `/workspace`
2. The executable path for Node.js (`/usr/bin/node`)
3. Some other initialization parameter

## Next Steps
1. Check what command the JavaScript adapter is actually running
2. Verify the proxy can handle absolute paths starting with `/workspace`
3. Check if there's a working directory issue
