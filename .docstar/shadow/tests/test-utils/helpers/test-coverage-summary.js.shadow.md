# tests/test-utils/helpers/test-coverage-summary.js
@source-hash: 5e19c8b50e3b59b7
@generated: 2026-02-10T00:41:29Z

## Purpose
Test utility that executes Vitest with coverage reporting and displays a minimal, formatted summary of results. Designed as a standalone CLI script that runs tests, captures output, parses results, and provides clean exit codes.

## Core Function
- **testCoverageSummary()** (L12-125): Main async function that orchestrates the entire test-with-coverage workflow

## Key Operations

### Test Execution (L18-46)
- Spawns `npx vitest run --coverage --reporter=dot` as child process (L21-25)
- Captures stdout to extract progress indicators (dots) while suppressing verbose logs (L28-37)
- Ignores stderr output (L39)
- Tracks execution duration (L41, L47)

### Result Parsing (L50-87)
- Parses test results from `test-results.json` if available (L59-67)
  - Extracts: totalTests, passed, failed, skipped counts
- Parses coverage data from `coverage/coverage-summary.json` if available (L77-87)
  - Extracts: statements, branches, functions, lines percentages

### Output Formatting (L89-96)
- Displays minimal summary with horizontal separators
- Shows test counts, duration, and coverage percentages
- Conditional display logic for failed/skipped tests

### Cleanup & Exit (L98-124)
- Determines exit code based on test failures (L99)
- Removes temporary JSON result files (L102-104, L119-121)
- Handles errors gracefully with fallback summary display (L108-124)

## Dependencies
- `child_process.spawn`: Process execution
- `fs`: File system operations for result parsing and cleanup
- `path`: Path manipulation
- `url.fileURLToPath`: ES module path resolution

## Architecture Notes
- Uses ES modules with __filename/__dirname compatibility (L6-7)
- Defensive programming with file existence checks and error handling
- Immediate process.exit() calls for both success and failure paths
- Self-executing script with top-level catch handler (L128-131)

## Critical Behavior
- Always exits the process (never returns normally)
- Exit code 0 for success, 1 for test failures or errors
- Temporary file cleanup occurs in both success and error paths