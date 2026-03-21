# Known Issues

## Rust debugging inside Docker is disabled

The `mcp-debugger-docker` image disables Rust by default via `DEBUG_MCP_DISABLE_LANGUAGES`. CodeLLDB had chronic DWARF/symbol issues with binaries compiled outside the container. Rust Docker debugging is supported behind the `DOCKER_ENABLE_RUST=true` gate in tests, but is not enabled by default in the production image. Use the local stdio, SSE, or packed deployments for Rust debugging where the adapter runs on the same host as the toolchain.

## Test Failures in Act Environment

There are 3 tests that fail when running with Act (local GitHub Actions simulator) but may pass in the actual GitHub Actions CI environment. These tests use two different gating mechanisms:
- **`describe.skipIf(SKIP_DOCKER_TESTS)`**: Skips entire test suites at the Vitest framework level based on the `SKIP_DOCKER_TESTS` environment variable (used by Docker smoke tests).
- **Runtime platform checks** (e.g., `if (process.platform !== 'win32') { return; }`): Individual tests return early within the test body when the current platform does not match expectations (used by the Python discovery test).

### 1. Container Smoke Test - Timeout Issue
- **File**: `tests/e2e/docker/docker-smoke-python.test.ts` (and other `docker-smoke-*.test.ts` files)
- **Test**: Container-based debugging smoke tests
- **Issue**: Test times out after 60 seconds in Act environment
- **Likely Cause**: Docker operations are slower in Act's Docker-in-Docker setup
- **Solution**: May need to increase timeout or optimize Docker image loading

### 2. Container Test Environment Issue
- **File**: `tests/e2e/docker/docker-smoke-python.test.ts`
- **Issue**: Container tests may fail in Act's Docker-in-Docker environment
- **Cause**: Volume mount complexities in nested container environments
- **Solution**: Tests work in real Docker environments; Act limitations only

### 3. Python Discovery Platform Mismatch
- **File**: `tests/adapters/python/integration/python-discovery.test.ts`
- **Test**: "should find Python on Windows without explicit path"
- **Issue**: This is a Windows-only success-path discovery test that returns early on non-Windows platforms
- **Root Cause**: Test is deliberately Windows-only; it does not mock platform or assert error messages
- **Solution**: Test works correctly on Windows; on non-Windows platforms the test returns early without executing Windows-specific assertions

## Running Tests Locally

### With Act
```bash
# Windows (use cmd, not PowerShell)
scripts\act-test.cmd

# Linux/macOS/WSL2
./scripts/act-test.sh
```

### WSL2 Requirements
- Must run Act from within WSL2 on Windows
- Docker Desktop WSL2 integration must be enabled
- Use the sync scripts to copy files to WSL2:
  ```bash
  scripts\sync-to-wsl.cmd
  ```

### Direct Test Execution
If Act continues to have issues, you can run tests directly:
```bash
npm test
```

## Next Steps
1. Push to GitHub to see if tests pass in real CI environment
2. If tests pass in CI, these are Act-specific issues that can be addressed later
3. If tests fail in CI, the error messages may provide better diagnostics
4. Consider using Testcontainers as an alternative for container testing
