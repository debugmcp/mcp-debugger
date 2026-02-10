# scripts/test-docker-local.sh
@source-hash: 6e7615e6b0bdcdd5
@generated: 2026-02-10T00:42:04Z

## Docker Smoke Test Runner Script

**Primary Purpose**: Automated script for running Docker containerized debugging smoke tests locally, specifically designed to verify and track the status of a known JavaScript adapter regression in Docker environments.

### Key Components

**Setup and Environment (L1-24)**
- Bash script with strict error handling (`set -e` L6)
- Color output definitions for user feedback (L14-17)
- Project root directory detection and navigation (L20-23)

**Pre-flight Checks (L25-43)**
- Docker daemon availability validation (L27-30)
- Project build execution via npm (L35-41)
- Both checks use exit-on-failure pattern with colored status output

**Docker Image Management (L44-58)**
- Builds tagged Docker image `mcp-debugger:test` (L46)
- Cleanup of existing test containers using grep/awk pipeline (L56)
- Container name pattern: `mcp-debugger-test`

**Test Execution Engine (L60-82)**
- Runs two separate Vitest test suites:
  - Python Docker tests: `tests/e2e/docker/docker-smoke-python.test.ts` (L73)
  - JavaScript Docker tests: `tests/e2e/docker/docker-smoke-javascript.test.ts` (L80)
- Captures exit codes in `PYTHON_RESULT` and `JS_RESULT` variables (L67-68, L74, L81)

**Results Analysis and Expected State Logic (L84-124)**
- Implements sophisticated test result interpretation based on known regression state
- **Expected behavior**: Python passes, JavaScript fails (L111-117)
- **Fixed state**: Both pass (L118-120)
- **Error state**: Unexpected combinations (L121-124)

### Architecture Decisions

**State-Aware Testing**: The script embeds knowledge of a known JavaScript adapter regression, treating certain "failures" as expected rather than true failures. This allows continuous integration while tracking fix progress.

**Defensive Programming**: Multiple validation layers (Docker running, build success, image creation) with immediate failure on any step.

**User Experience Focus**: Extensive use of colored output, clear section headers, and contextual guidance for next steps.

### Dependencies

- Docker daemon and CLI
- Node.js/npm ecosystem
- Vitest test runner
- Project build system accessible via `npm run build`

### Critical Constraints

- Must be run from project root context
- Requires Docker to be running and accessible
- Depends on specific test file paths in `tests/e2e/docker/` directory
- Exit codes have semantic meaning for CI/automation integration