# tests/test-utils/helpers/test-summary.js
@source-hash: 065512cc6753418e
@generated: 2026-02-09T18:14:38Z

## Primary Purpose
Test utility that executes Vitest test suite and generates a clean, formatted summary of test results with failure details. Acts as a test runner wrapper that suppresses verbose output and provides structured reporting.

## Key Functions
- **testSummary() (L12-130)**: Main async function that orchestrates test execution and result reporting
  - Spawns Vitest process with JSON reporter (L17-34)
  - Parses JSON results and calculates summary statistics (L39-62)
  - Displays formatted test summary with pass/fail counts (L64-71)
  - Shows detailed failure information for failed tests (L72-108)
  - Handles cleanup and process exit codes (L110-129)

## Architecture & Dependencies
- **Node.js modules**: Uses `child_process.spawn` for test execution, `fs` for file operations, `path` for file paths
- **ES Module setup**: Uses `import.meta.url` and `fileURLToPath` for __dirname equivalent (L6-7)
- **External dependency**: Assumes Vitest testing framework is available via npx

## Key Data Structures
- **Summary object (L53-62)**: Aggregates test metrics from Vitest JSON output
  - Test counts: totalTests, passed, failed, skipped
  - Suite counts: testSuites, passedSuites, failedSuites
  - Execution duration in seconds
- **JSON results format**: Expects Vitest JSON structure with testResults array and assertion results

## Notable Patterns
- **Output suppression**: Captures but ignores stdout/stderr during test execution (L26-28)
- **Error handling**: Multiple fallback strategies for malformed JSON or missing results (L118-129)
- **Graceful degradation**: Shows partial error messages when full failure details unavailable (L87-101)
- **Process lifecycle**: Sets appropriate exit codes and performs cleanup (L111-116)

## Critical Constraints
- Requires 'test-results.json' file to be writable in current working directory
- Depends on Vitest JSON reporter format structure
- Process exits with code 1 on test failures or execution errors
- Temporary JSON file is always cleaned up, even on errors