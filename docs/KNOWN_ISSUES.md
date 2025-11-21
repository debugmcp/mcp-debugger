# Known Issues

## Rust debugging inside Docker is disabled

The `mcp-debugger-docker` image now ships only the Python and JavaScript adapters. CodeLLDB had chronic DWARF/symbol issues with binaries compiled outside the container, so the image is built with `DEBUG_MCP_DISABLE_LANGUAGES=rust` and the server refuses to create Rust sessions in that environment. Use the local stdio, SSE, or packed deployments for Rust debugging where the adapter runs on the same host as the toolchain.

## Test Failures in Act Environment

As of July 2025, there are 3 tests that fail when running with Act (local GitHub Actions simulator) but may pass in the actual GitHub Actions CI environment. These tests have been temporarily skipped with `.skip` to allow the project to be pushed to GitHub for further investigation.

### 1. Container Smoke Test - Timeout Issue
- **File**: `tests/e2e/mcp-server-smoke-container.test.ts`
- **Test**: "should successfully debug fibonacci.py in containerized server"
- **Issue**: Test times out after 60 seconds in Act environment
- **Likely Cause**: Docker operations are slower in Act's Docker-in-Docker setup
- **Solution**: May need to increase timeout or optimize Docker image loading

### 2. Container Test Environment Issue
- **File**: `tests/e2e/mcp-server-smoke-container.test.ts`
- **Issue**: Container tests may fail in Act's Docker-in-Docker environment
- **Cause**: Volume mount complexities in nested container environments
- **Solution**: Tests work in real Docker environments; Act limitations only

### 3. Python Discovery Platform Mismatch
- **File**: `tests/integration/python-real-discovery.test.ts`
- **Test**: "should show clear error message when Python is not found on Windows"
- **Issue**: Test forces platform to 'win32' but runs on Linux in Act
- **Root Cause**: Test expects Windows `py` command but Act runs on Linux
- **Solution**: Make test platform-aware or use proper mocking strategy

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
