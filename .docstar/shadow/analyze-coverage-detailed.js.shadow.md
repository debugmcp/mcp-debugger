# analyze-coverage-detailed.js
@source-hash: 5ec3112a272df397
@generated: 2026-02-10T00:42:03Z

## Primary Purpose
Coverage analysis tool for the mcp-debugger project that parses Istanbul/NYC coverage reports and provides detailed file-by-file impact analysis. Identifies which files contribute most to overall coverage gaps and prioritizes testing efforts.

## Key Functionality

### Main Processing Logic (L13-100)
- **Coverage Data Loading (L14-22)**: Reads `coverage/coverage-summary.json`, exits with error if missing
- **File Analysis Loop (L28-45)**: Iterates through coverage data, calculates uncovered lines per file, normalizes file paths for display
- **Impact Calculation (L48-50)**: Determines each file's contribution to overall coverage deficit as percentage points
- **Sorting & Display (L52-75)**: Orders files by uncovered line count (descending), formats tabular output

### Output Sections
- **Summary Header (L55-64)**: Overall stats with decorative separators
- **File Table (L65-75)**: Shows uncovered lines, coverage percentage, and impact for each file
- **Insights Generation (L85-94)**: Analyzes top 5 files, calculates potential coverage improvement, identifies priority files

## Key Data Structures
- **files array (L26, L39-44)**: Objects containing `{path, coverage, uncovered, total, impact}`
- **coverage object (L21-22)**: Parsed JSON with per-file line coverage statistics

## Dependencies
- Standard Node.js modules: `fs`, `path`, `url` (L6-8)
- ES modules setup with `__dirname` polyfill (L10-11)

## Notable Patterns
- **Error-first design**: Graceful handling of missing coverage data (L16-19)
- **Path normalization**: Cross-platform file path cleaning (L36-37)
- **Formatted console output**: Uses Unicode box-drawing characters for professional reports
- **Metric prioritization**: Focuses on uncovered line count rather than percentage for impact assessment

## Critical Constraints
- Requires Istanbul/NYC coverage format with `lines` property structure
- Expects `coverage-summary.json` in relative `coverage/` directory
- Designed for manual execution via npm script, not programmatic use