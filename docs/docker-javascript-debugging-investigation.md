# Docker JavaScript Debugging Investigation Report

## Summary
Investigation into JavaScript debugging regression in containerized environment. Python debugging works correctly in Docker, but JavaScript debugging fails during proxy initialization.

## Findings

### Root Cause
The JavaScript debugging proxy process exits with SIGTERM during initialization in the Docker container. The signal appears to be sent during the proxy's initialization phase, preventing it from completing setup.

### Changes Made & Attempted Fixes

#### 1. Base Image Switch (Alpine → Debian-slim) ✅
- **Reason**: js-debug vendor binary requires glibc, Alpine uses musl libc
- **File**: `Dockerfile`
- **Impact**: Resolved binary compatibility issue

#### 2. Path Resolution Fixes ✅
- **Issue**: Double path prepending (`/workspace//workspace/...`)
- **File**: `tests/e2e/docker/docker-test-utils.ts`
- **Solution**: Modified `hostToContainerPath()` to return relative paths

#### 3. Process Group Management Fix ❌
- **File**: `src/implementations/process-launcher-impl.ts`
- **Changes Made**:
  - Disabled `detached: true` flag when in container environment
  - Disabled process group kill (`process.kill(-pid)`) when in container
- **Result**: Still receiving SIGTERM despite these changes

#### 4. Orphan Process Cleanup ✅
- **File**: `src/proxy/utils/orphan-check.ts`
- **Status**: Confirmed properly disabled in containers (checks `MCP_CONTAINER` flag)

#### 5. Enhanced Logging ✅
- **File**: `packages/adapter-javascript/src/javascript-debug-adapter.ts`
- **Added**: Detailed logging for path resolution and process spawning

### Current Status

#### Working ✅
- Python debugging in Docker (works perfectly)
- JavaScript debugging in non-containerized environment
- Setting breakpoints and retrieving source context
- Docker smoke test suite successfully detects the regression

#### Not Working ❌
- JavaScript debugging session initialization in Docker
- Proxy process consistently receives SIGTERM during initialization

### Error Details
```
Proxy exited during initialization. Code: 1, Signal: SIGTERM
```

The proxy process:
1. Starts successfully
2. Sets up IPC communication
3. Receives the init command
4. Gets terminated with SIGTERM before completing initialization

### Remaining Mysteries

1. **Who sends SIGTERM?**
   - Not the orphan cleanup (disabled in containers)
   - Not process group management (disabled in containers)
   - Could be Docker runtime, Node.js parent, or Linux system

2. **Why only JavaScript?**
   - Python debugging works perfectly in the same container
   - Suggests something specific about Node.js child process spawning with IPC

3. **IPC-related?**
   - The proxy uses Node.js IPC channels (`stdio: ['pipe', 'pipe', 'pipe', 'ipc']`)
   - This might behave differently in Docker's PID namespace

### Docker Test Suite
- `tests/e2e/docker/docker-smoke-python.test.ts` - Python smoke tests ✅ PASSING
- `tests/e2e/docker/docker-smoke-javascript.test.ts` - JavaScript smoke tests ❌ FAILING (correctly detects regression)
- `tests/e2e/docker/docker-test-utils.ts` - Shared utilities
- `scripts/test-docker-local.cmd` - Windows test runner
- `scripts/test-docker-local.sh` - Linux test runner

### Next Steps to Investigate

1. **Deeper Signal Analysis**
   - Use `strace` in container to trace exact source of SIGTERM
   - Add signal handlers in proxy to log sender PID

2. **IPC Alternative**
   - Try different stdio configurations
   - Consider TCP/socket communication instead of IPC

3. **Docker Resource Limits**
   - Check if Docker is enforcing memory/CPU limits
   - Review container security policies

4. **Process Lifecycle**
   - Investigate if Node.js parent is cleaning up child processes differently in containers
   - Check for race conditions in initialization

### Recommendations

1. **Short-term**: 
   - Document the known limitation in README
   - Advise users to use non-containerized version for JavaScript debugging

2. **Medium-term**: 
   - Implement alternative communication mechanism (TCP instead of IPC)
   - Add comprehensive signal tracing

3. **Long-term**: 
   - Redesign proxy architecture for better container compatibility
   - Consider running js-debug as a separate container service

### Technical Details

#### Container Environment
- Base: `python:3.11-slim` (Debian-based)
- Node.js: v20 (installed via NodeSource)
- Python debugpy: >=1.8.14
- Working directory: `/app`
- Examples mounted at: `/workspace`
- Environment flag: `MCP_CONTAINER=true`

#### Process Architecture
```
MCP Server (Node.js)
  └── JavaScript Adapter
       └── Proxy Process (child_process.spawn with IPC)
            └── js-debug DAP server
```

The failure occurs at the Proxy Process level when spawned in Docker.

## Related Files
- `Dockerfile` - Container definition
- `src/implementations/process-launcher-impl.ts` - Process spawning logic
- `packages/adapter-javascript/src/javascript-debug-adapter.ts` - Adapter implementation
- `tests/e2e/docker/` - Docker test suite
- `scripts/test-docker-local.cmd` - Test runner

## Date: October 15, 2025
## Author: Debug Investigation
