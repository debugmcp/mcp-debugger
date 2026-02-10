# tests/test-utils/helpers/test-results-analyzer.js
@source-hash: 16d6ae7eff77bea4
@generated: 2026-02-09T18:14:41Z

## Purpose
A command-line test results analyzer utility that parses Jest JSON output and generates formatted reports with multiple detail levels. Designed to enhance test result visibility through structured analysis and formatted console output.

## Core Class
**TestResultsAnalyzer (L11-233)** - Main analyzer class that processes test result JSON files and generates formatted reports.

### Constructor (L12-14)
- Accepts optional JSON file path (defaults to 'test-results.json')
- Resolves file path relative to current working directory

### Key Methods

**analyze(level) (L16-48)** - Main entry point that orchestrates analysis flow
- Validates file existence, exits with error guidance if missing (L18-22)
- Parses JSON test results with error handling (L24, L41-47)
- Routes to appropriate display method based on level parameter (L26-40)
- Supports 'summary', 'failures', 'detailed' levels

**showSummary(results) (L50-82)** - Generates high-level test metrics overview
- Extracts and displays test suite/test counts with pass/fail breakdown (L51-76)
- Shows completion status when available (L72-75)
- Hints at coverage data if present (L77-81)

**showFailures(results) (L84-143)** - Focuses on failed test analysis
- Filters and groups failed tests by file (L92-100)
- Displays failure details with stack trace filtering (L120-137)
- Extracts error messages while excluding stack traces (L127-135)

**showDetailed(results) (L145-232)** - Comprehensive analysis with performance metrics
- Combines summary with hierarchical file breakdown (L149-202)
- Groups tests by directory structure (L162-178)
- Identifies slow tests (>1s) with performance rankings (L209-231)

## CLI Integration (L235-267)
- Argument parsing for --level, --file, and --help flags (L240-260)
- Help text generation with usage examples (L246-258)
- Direct execution with error handling (L262-267)

## Dependencies
- Node.js fs/path for file operations (L1-2)
- ES module URL utilities for __dirname polyfill (L3-6)

## Key Features
- Graceful error handling with user-friendly messages
- Hierarchical test organization by directory
- Performance analysis for slow test identification
- Multiple output verbosity levels
- JSON malformation detection
- Relative path display for cleaner output

## Data Structure Assumptions
Expects Jest JSON format with:
- `numTotalTests`, `numPassedTests`, `numFailedTests` metrics
- `testResults` array with `assertionResults` containing test details
- Optional `coverageMap` for coverage data
- Test duration and status information