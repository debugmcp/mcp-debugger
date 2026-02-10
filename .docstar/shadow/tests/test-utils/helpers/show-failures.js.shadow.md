# tests/test-utils/helpers/show-failures.js
@source-hash: 5eb35b32c9664c85
@generated: 2026-02-10T00:41:30Z

## Purpose
Test utility script that runs Vitest tests and displays only failure information in a clean, readable format. Filters out verbose stack traces and provides focused failure reporting.

## Key Components

### Main Function: `showFailures()` (L12-87)
- **Purpose**: Orchestrates test execution and failure reporting
- **Process**:
  1. Spawns Vitest with JSON reporter (L19-22)
  2. Waits for test completion (L24-26)
  3. Parses JSON results and filters failures (L29-70)
  4. Displays formatted failure output (L48-69)
  5. Cleans up temporary files (L80)

### Test Execution (L19-26)
- Uses `spawn()` to run `npx vitest run --reporter=json --outputFile`
- Outputs to `test-results.json` in current working directory
- Inherits stdio for real-time feedback during test run

### Failure Processing (L45-70)
- Iterates through test files and filters failed assertions (L46)
- Formats output with file paths, test names, and error messages
- **Error Message Cleaning** (L58-66): Filters out `node_modules` references and async stack traces
- Displays numbered failure list with separators

### Error Handling
- **Missing Results File** (L30-33): Exits with error if JSON file doesn't exist
- **Parse Errors** (L82-86): Catches JSON parsing issues and provides diagnostic info
- **Top-level Error Handler** (L90-93): Catches unexpected errors in main execution

## Dependencies
- **Node.js Built-ins**: `child_process.spawn`, `fs`, `path`, `url.fileURLToPath`
- **External**: Vitest test runner (invoked via npx)

## Key Patterns
- **Promise Wrapper**: Converts event-based `spawn` to Promise (L24-26)
- **Defensive Programming**: Multiple error checks for missing/malformed data
- **Temporary File Management**: Creates and cleans up JSON results file
- **Output Formatting**: Uses Unicode symbols (❌/✅) and text separators for readability

## Execution Context
Designed as a standalone script (L90-93) for development/CI environments where focused failure reporting is needed over verbose test output.