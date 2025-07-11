# Task 24: Skipped Tests Investigation Report

## Summary
After investigating the test suite, I found 10 skipped tests across different files. These tests are skipped for various reasons including missing Docker support, environment-specific conditions, and Python runtime requirements.

## Skipped Tests Report

### Skipped Test #1
- **File**: tests/adapters/python/integration/python-real-discovery.test.ts:144
- **Test**: "should show clear error message when Python is not found on Windows (verifying production bug fix)"
- **Reason**: `it.skip()` - Hardcoded skip
- **Action**: Keep skipped - This test requires a Windows environment without Python installed, which is difficult to simulate in CI

### Skipped Test #2
- **File**: tests/e2e/mcp-server-smoke-container.test.ts:53
- **Test**: "should successfully debug fibonacci.py in containerized server"
- **Reason**: `it.skip()` - Docker container tests disabled
- **Action**: Keep skipped - Requires Docker environment which is not available in current test setup

### Skipped Test #3
- **File**: tests/e2e/mcp-server-smoke-container.test.ts:135
- **Test**: "should reject absolute paths in container mode"
- **Reason**: `it.skip()` - Docker container tests disabled
- **Action**: Keep skipped - Requires Docker environment

### Skipped Test #4-5
- **File**: tests/e2e/full-debug-session.test.ts:253
- **Tests**: "python debugging > should complete full debugging workflow" and "python debugging > should handle multiple breakpoints correctly"
- **Reason**: `describe.skipIf(!process.env.SKIP_PYTHON_TESTS)` - Conditional skip based on environment variable
- **Action**: Keep skipped by default - These are integration tests that require Python runtime

### Skipped Test #6
- **File**: tests/unit/implementations/process-launcher-impl-debug.test.ts:159
- **Test**: "should handle Windows paths correctly"
- **Reason**: `it.skipIf(process.platform !== 'win32')` - Platform-specific test
- **Action**: Keep skipped - Only runs on Windows platform

### Skipped Tests #7-10
- **Files**: Various Python-related test files with `@requires-python` tag
  - tests/adapters/python/integration/python-discovery.failure.test.ts
  - tests/adapters/python/unit/python-adapter.test.ts
  - tests/adapters/python/unit/python-utils.test.ts
  - tests/adapters/python/integration/python-real-discovery.test.ts
- **Reason**: Tests tagged with `@requires-python` are being filtered out during test runs
- **Action**: Keep current behavior - These tests require Python runtime and are appropriately tagged

## Root Cause Analysis

### 1. Docker Container Tests (2 tests)
- Tests in `mcp-server-smoke-container.test.ts` are skipped because they require Docker
- The project has moved away from Docker-based testing to direct execution

### 2. Python Runtime Tests (6-7 tests)
- Multiple tests require Python to be installed and available
- These are appropriately tagged with `@requires-python` or use conditional skips
- The test suite correctly handles environments without Python

### 3. Platform-Specific Tests (1 test)
- Windows-specific path handling test that only runs on Windows
- Appropriately uses `skipIf` to avoid running on other platforms

### 4. Environment Simulation Tests (1 test)
- Test that requires Python to NOT be installed is difficult to simulate
- Kept as skip to avoid false positives

## Recommendations

1. **Docker Tests**: Consider removing the skipped Docker tests entirely since the project no longer uses Docker-based architecture.

2. **Python Tests**: The current approach of tagging tests with `@requires-python` is appropriate. Consider:
   - Setting up a CI matrix that includes Python-enabled and Python-disabled environments
   - Using the `SKIP_PYTHON_TESTS` environment variable consistently

3. **Platform Tests**: The platform-specific skip is appropriate and should remain.

4. **Documentation**: Update test documentation to clearly explain:
   - Which tests require specific environments
   - How to run Python-specific tests
   - The purpose of the `SKIP_PYTHON_TESTS` environment variable

## Python Test Fixes Completed

During this task, I also fixed 3 failing Python tests:
- ✅ `debugpy-connection.test.ts` - Fixed by creating proper mock debugpy server
- ✅ `python-discovery.test.ts` - Fixed path resolution for dist/index.js
- ✅ `python_debug_workflow.test.ts` - Fixed by creating missing test fixture and adjusting breakpoint line

All Python tests now pass when Python is available on the system.
