# analyze-coverage.js
@source-hash: 607ea8ca1b309805
@generated: 2026-02-10T00:42:02Z

## analyze-coverage.js

**Purpose**: Post-test coverage analysis tool that parses Jest/Istanbul coverage data and displays actionable insights about which files need attention to improve test coverage.

**Core Functionality**:
- **Coverage Data Processing** (L21-45): Parses `coverage-summary.json` from the coverage directory, extracts line coverage metrics for each file, and calculates uncovered line counts
- **Impact Calculation** (L47-50): Computes each file's relative impact on overall coverage by calculating what percentage of total uncovered lines each file represents
- **Prioritized Display** (L52-89): Sorts files by uncovered line count (descending) and displays top 10 files in a formatted table with coverage percentage, impact score, and truncated file paths

**Key Components**:
- **File Path Handling** (L10-11, L36-37): Uses ES modules pattern for `__dirname` equivalent and normalizes file paths for cross-platform display
- **Error Handling** (L16-19, L91-94): Gracefully exits if coverage data doesn't exist or parsing fails, designed not to disrupt test workflows
- **Output Formatting** (L55-89): Creates structured console output with Unicode box-drawing characters and aligned columns

**Dependencies**: 
- Node.js built-ins: `fs`, `path`, `url`
- External: Expects Jest/Istanbul coverage output format in `coverage/coverage-summary.json`

**Integration Point**: Designed to run automatically after `npm run test:coverage` as indicated by the header comment and exit strategy.

**Data Flow**: Reads coverage JSON → Processes file metrics → Calculates impact scores → Sorts by priority → Displays top contributors to coverage gaps

**Notable Design Decisions**:
- Silent failure mode to avoid disrupting CI/CD pipelines
- Focus on uncovered lines rather than percentage for actionable insights  
- Path truncation (L68-72) for readable terminal output
- Limits display to top 10 files to avoid information overload