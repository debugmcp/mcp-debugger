# tests/test-utils/helpers/test-coverage-summary.js
@source-hash: 5e19c8b50e3b59b7
@generated: 2026-02-09T18:14:38Z

## Purpose
Test execution utility that runs Vitest with coverage collection and displays a minimal, formatted summary of test results and coverage metrics.

## Primary Function
**testCoverageSummary** (L12-125) - Main orchestrator function that:
- Spawns Vitest process with coverage and JSON reporting
- Captures and filters test output to show only progress dots
- Parses JSON results files for test metrics and coverage data
- Displays formatted summary with test counts, duration, and coverage percentages
- Handles cleanup and sets appropriate exit codes

## Key Implementation Details

**Process Management** (L18-46):
- Spawns `npx vitest` with coverage flags using child_process.spawn
- Uses dot reporter and JSON output file for structured result parsing
- Captures stdout selectively, filtering for progress indicators only
- Measures execution duration from start to process completion

**Results Parsing** (L50-87):
- Reads `test-results.json` for test counts (total, passed, failed, skipped)
- Reads `coverage/coverage-summary.json` for coverage percentages
- Provides fallback default values if files don't exist or parsing fails

**Output Formatting** (L89-96):
- Displays results in Jest-like format with horizontal rule separators
- Conditionally shows failed test counts and skipped test counts
- Formats coverage with varying decimal precision (statements/functions: 2dp, branches/lines: 1dp)

## File Structure & Dependencies
- **Dependencies**: child_process.spawn, fs, path, url.fileURLToPath
- **Input Files**: `test-results.json`, `coverage/coverage-summary.json` (created by Vitest)
- **Output**: Console summary, process exit code (0 success, 1 failure)

## Error Handling
- Graceful degradation if result files don't exist (L59, L77)
- Try-catch wrapper provides basic completion message on parsing errors (L108-124)
- Cleanup ensures temporary JSON files are removed in all scenarios

## Architectural Notes
- Script executes immediately via top-level await pattern (L127-131)
- Uses ES modules with __dirname polyfill for file path resolution
- Designed as standalone utility, not importable module