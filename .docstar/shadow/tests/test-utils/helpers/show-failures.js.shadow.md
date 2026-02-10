# tests/test-utils/helpers/show-failures.js
@source-hash: 5eb35b32c9664c85
@generated: 2026-02-09T18:14:38Z

## Purpose
Test utility script that executes Vitest and displays only failed tests with cleaned error messages. Designed for focused debugging by filtering out noise from successful tests.

## Key Functions
- **showFailures() (L12-87)**: Main function that orchestrates test execution and failure reporting
  - Spawns Vitest with JSON reporter (L19-22)
  - Parses JSON results from temporary file (L35)
  - Filters and formats failure messages (L46-69)
  - Cleans up temporary files (L80)

## Architecture & Flow
1. **Test Execution (L19-26)**: Uses `spawn()` to run `npx vitest run` with JSON output to temporary file
2. **Result Processing (L29-41)**: Validates JSON file existence and parses test results
3. **Failure Analysis (L44-70)**: Iterates through test files, filters failed assertions, formats output
4. **Error Message Cleaning (L58-66)**: Removes noise from stack traces (node_modules, async traces)

## Dependencies
- **child_process.spawn** (L1): For executing Vitest subprocess
- **fs** (L2): File system operations for JSON result file
- **path** (L3): Path manipulations and relative path display
- **url.fileURLToPath** (L4): ES module compatibility

## Key Data Structures
- **results.testResults**: Array of test file objects from Vitest JSON output
- **testFile.assertionResults**: Array of individual test assertions with status
- **failure.failureMessages**: Array of error message strings per failed test

## Error Handling
- Process exit on missing JSON file (L32)
- Graceful handling of malformed results (L37-40)
- Catch block for JSON parsing errors (L82-86)
- Top-level error handler for unexpected failures (L90-93)

## Output Format
- Uses emoji indicators (❌ for failures, ✅ for success)
- Displays relative file paths for readability
- Numbered failure list with cleaned error messages
- Summary statistics at end