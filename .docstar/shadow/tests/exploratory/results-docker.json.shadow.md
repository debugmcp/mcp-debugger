# tests\exploratory\results-docker.json
@source-hash: 7d969cf6ce998d65
@generated: 2026-02-24T01:54:04Z

## Test Results Data for Docker Exploratory Testing

This JSON file contains structured test execution results for Docker-based debugging functionality tests. The data represents a test suite run with 5 tests total, showing 3 passes and 2 failures.

### Test Result Structure (L1-34)
- **Root metrics**: Total count, pass/fail tallies (L2-4)
- **Results array**: Individual test case outcomes with timing data (L5-33)

### Test Cases Covered
1. **Language Support Test** (L6-10): Validates Docker container language detection - PASSED
2. **Python Debug Workflow** (L11-16): Tests Python debugging with workspace paths - FAILED due to path resolution issue
3. **JavaScript Debug Workflow** (L17-22): Tests JavaScript debugging - FAILED with identical path resolution error
4. **External File Breakpoints** (L23-27): Tests breakpoint setting outside workspace - PASSED
5. **Concurrent Sessions** (L28-32): Tests multiple simultaneous debug sessions - PASSED

### Key Error Pattern (L14, L20)
Both failed tests exhibit the same path resolution bug where workspace paths are being double-prefixed (`/workspace//workspace/`), indicating a Docker volume mounting or path normalization issue in the debugging infrastructure.

### Performance Data
Test durations range from 11-17 seconds, suggesting these are integration-level tests involving actual Docker container operations and debugging session setup/teardown.