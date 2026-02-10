# scripts/test-docker-local.sh
@source-hash: 6e7615e6b0bdcdd5
@generated: 2026-02-09T18:15:16Z

## Purpose
Local Docker smoke test runner script for verifying MCP debugger functionality in containerized environments. Orchestrates the complete testing pipeline from build to execution to results analysis.

## Key Components

### Environment Setup (L6-33)
- **Error handling**: `set -e` ensures script exits on any command failure (L6)
- **Color constants**: Terminal color codes for output formatting (L14-17)
- **Path resolution**: Dynamically determines project root directory using script location (L20-21)
- **Docker validation**: Checks if Docker daemon is running before proceeding (L25-30)

### Build Pipeline (L34-52)
- **Project build**: Executes `npm run build` with error checking (L35-42)
- **Docker image creation**: Builds `mcp-debugger:test` image from project Dockerfile (L44-51)
- Both steps include explicit error handling and colored status output

### Test Environment Management (L54-58)
- **Container cleanup**: Removes any existing `mcp-debugger-test` containers to ensure clean state (L56)
- Uses grep/awk/xargs pipeline for bulk container removal

### Test Execution Framework (L60-82)
- **Result tracking**: Maintains separate exit codes for Python and JavaScript tests (L67-68)
- **Python tests**: Runs `tests/e2e/docker/docker-smoke-python.test.ts` via Vitest (L71-74)
- **JavaScript tests**: Runs `tests/e2e/docker/docker-smoke-javascript.test.ts` via Vitest (L78-81)

### Results Analysis Logic (L84-124)
- **Expected failure handling**: Acknowledges known JavaScript regression in Docker (L100, L112)
- **Three result scenarios**:
  1. Python pass + JavaScript fail = Expected state, exit 0 (L111-117)
  2. Python pass + JavaScript pass = Regression fixed, exit 0 (L118-120)
  3. Any other combination = Unexpected, exit 1 (L121-124)

## Dependencies
- Docker daemon (validated at runtime)
- npm/Node.js ecosystem
- Vitest test runner
- Project Dockerfile in root directory

## Architectural Decisions
- **Graceful degradation**: Script treats JavaScript test failures as expected rather than blocking
- **Comprehensive validation**: Checks Docker availability before attempting any operations
- **Clean state guarantee**: Always removes old containers before testing
- **Detailed reporting**: Provides colored output and clear next steps for each scenario

## Critical Invariants
- Must run from project root directory
- Requires Docker daemon to be running
- Expects specific test file locations in `tests/e2e/docker/`
- JavaScript test failure is currently expected behavior (regression acknowledgment)