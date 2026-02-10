# tests/test-utils/helpers/test-summary.js
@source-hash: 065512cc6753418e
@generated: 2026-02-10T00:41:29Z

## Purpose
Test utility that executes Vitest test suites with JSON output and displays a clean, formatted summary of results. Designed for CI/CD environments where concise test reporting is needed.

## Core Function
**`testSummary()` (L12-130)**: Main orchestrator that runs tests via spawn, processes JSON results, and displays formatted output.

Key responsibilities:
- Spawns Vitest with JSON reporter to `test-results.json` (L13, L19-24)
- Captures test duration timing (L30, L36)
- Parses JSON test results and extracts summary statistics (L45, L53-62)
- Displays formatted summary with pass/fail counts (L65-70)
- Lists failed tests with error details when failures exist (L73-108)
- Cleans up temporary JSON file and exits with appropriate code (L114-116)

## Key Dependencies
- `child_process.spawn`: For executing Vitest subprocess
- `fs`: File system operations for JSON result file handling
- `path`: Path manipulation for relative file display

## Architecture Patterns
- **Process spawning**: Uses `npx vitest` with separate arguments array to handle paths with spaces (L19)
- **Silent execution**: Suppresses test output during run but captures for error reporting (L26-28)
- **Error handling**: Multi-layer error handling for missing files, malformed JSON, and execution failures (L40-43, L118-129)
- **Graceful cleanup**: Always removes temporary JSON file, even on errors (L114, L125)

## Output Format
- Summary section with test suite and individual test counts
- Failed tests grouped by file with first error message line
- Duration tracking and relative file path display
- Exit codes: 0 for success, 1 for failures or errors

## Critical Constraints
- Requires Vitest to be available via npx
- Depends on specific JSON result format from Vitest
- Creates temporary `test-results.json` in current working directory
- Exits process directly rather than returning values