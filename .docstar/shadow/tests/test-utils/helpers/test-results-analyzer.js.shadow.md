# tests/test-utils/helpers/test-results-analyzer.js
@source-hash: 16d6ae7eff77bea4
@generated: 2026-02-10T00:41:30Z

## Purpose
Test utility script that parses JSON test results and provides formatted analysis output with multiple detail levels. Designed as both a CLI tool and importable class for test result visualization.

## Architecture
**TestResultsAnalyzer class (L11-233)**: Core analyzer with three analysis modes
- Constructor (L12-14): Takes JSON file path, defaults to 'test-results.json' in cwd
- `analyze(level)` (L16-48): Main entry point, handles file validation and error handling
- `showSummary(results)` (L50-82): Basic test/suite counts and coverage hints
- `showFailures(results)` (L84-143): Failed test details with error message parsing
- `showDetailed(results)` (L145-232): Comprehensive breakdown with directory grouping and performance metrics

## Key Dependencies
- Node.js fs/path modules for file operations
- ES modules with `__dirname` emulation (L5-6)

## CLI Interface (L235-267)
Command line argument parsing for:
- `--level=` (summary|failures|detailed)
- `--file=` (custom JSON path)
- `--help/-h` (usage information)

## Data Processing Patterns
- **Error-first validation**: File existence check before JSON parsing (L18-22)
- **Defensive data access**: Optional chaining and fallback values throughout
- **Hierarchical organization**: Groups tests by directory in detailed mode (L161-202)
- **Performance analysis**: Identifies slow tests (>1s) in detailed view (L209-231)

## Output Formatting
Uses Unicode symbols (✓, ✗, ⊘) and box-drawing characters for visual hierarchy. Error message filtering excludes stack traces for cleaner output (L127-135).

## Critical Invariants
- Process exits with status 1 on any error condition
- Expects Jest/similar test runner JSON output format
- File paths are resolved relative to process.cwd()
- Slow test threshold hardcoded to 1000ms (L213)