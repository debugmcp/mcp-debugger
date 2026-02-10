# analyze-coverage-detailed.js
@source-hash: 5ec3112a272df397
@generated: 2026-02-09T18:15:16Z

## analyze-coverage-detailed.js

**Purpose**: Coverage analysis utility that reads Jest/Istanbul coverage data and generates detailed, human-readable reports with prioritized insights for improving test coverage in the mcp-debugger project.

**Architecture**: Standalone Node.js script executed via `npm run test:coverage:analyze` command. Processes coverage-summary.json file and outputs formatted console analysis.

### Key Components

**Main Script Flow (L13-100)**:
- Validates coverage data existence (L16-19)
- Parses coverage-summary.json (L21)
- Processes file-level coverage metrics (L28-45)
- Calculates impact scores and generates insights (L47-96)

**Coverage Data Processing (L28-50)**:
- Iterates through coverage entries, skipping 'total' aggregate
- Calculates uncovered lines per file (L31)
- Normalizes file paths for display (L36-37)
- Computes impact percentage (percentage points overall coverage would gain if file reaches 100%)

**Report Generation (L55-96)**:
- Displays tabular coverage data sorted by uncovered lines (descending)
- Shows files with uncovered lines only (L66-75)
- Generates actionable insights including top 5 files analysis (L85-94)

### Dependencies
- `fs`: File system operations for reading coverage data
- `path`: Path manipulation utilities
- `url`: ES module compatibility (__dirname equivalent)

### Key Calculations
- **Impact Score (L49)**: `(uncoveredLines / totalLines) * 100` - measures how much overall coverage would improve
- **Coverage Percentage**: Uses `data.lines.pct` from Istanbul coverage format
- **Priority Ranking**: Sorts by absolute uncovered lines count (L53)

### Output Format
Produces structured console output with:
- Overall coverage statistics
- File-by-file breakdown with impact scores
- Strategic insights for coverage improvement priorities
- Special highlighting for high-impact files (>50 uncovered lines)

### Error Handling
Basic try-catch wrapper (L98-100) with process.exit(1) for missing coverage data.