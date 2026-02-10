# packages/adapter-rust/vendor/codelldb/linux-x64/lldb/lib/python3.12/doctest.py
@source-hash: 8fb954ef7e775270
@generated: 2026-02-09T18:09:50Z

Python's **doctest** module provides a framework for running and validating code examples embedded in docstrings.

## Core Architecture

The module implements a pipeline with 4 main classes:

- **Example (L443-509)**: Represents a single test case with source code, expected output, line number, indentation, and option flags
- **DocTest (L511-582)**: Collection of Examples with metadata (name, filename, lineno, docstring, globals)
- **DocTestFinder (L823-1154)**: Extracts DocTests from objects' docstrings recursively 
- **DocTestRunner (L1160-1615)**: Executes DocTests and reports results

## Key Components

### Option Flags System
- **register_optionflag() (L132-134)**: Dynamic flag registration using bit manipulation
- **Comparison flags (L136-148)**: DONT_ACCEPT_TRUE_FOR_1, NORMALIZE_WHITESPACE, ELLIPSIS, SKIP, IGNORE_EXCEPTION_DETAIL
- **Reporting flags (L150-160)**: REPORT_UDIFF, REPORT_CDIFF, REPORT_NDIFF, REPORT_ONLY_FIRST_FAILURE, FAIL_FAST

### Parser System  
- **DocTestParser (L588-817)**: Uses regex patterns to extract examples from docstrings
  - `_EXAMPLE_RE (L597-608)`: Matches >>> prompts and expected output
  - `_EXCEPTION_RE (L619-630)`: Handles exception traceback parsing
  - `parse() (L636-673)`: Main parsing method returning alternating Examples and text

### Test Discovery
- **DocTestFinder.find() (L854-954)**: Recursively discovers tests in modules, classes, functions
- **_from_module() (L956-983)**: Determines if object belongs to specified module
- **_find_lineno() (L1095-1154)**: Locates docstring line numbers for error reporting

### Test Execution
- **DocTestRunner.run() (L1474-1542)**: Main execution method with stdout capture and debugger integration
- **__run() (L1311-1451)**: Core test execution loop with exception handling
- **OutputChecker (L1617-1761)**: Compares expected vs actual output with various matching strategies

### Output Comparison
- **_ellipsis_match() (L277-324)**: Implements "..." wildcard matching algorithm
- **check_output() (L1631-1691)**: Multi-strategy output comparison (exact, whitespace normalization, ellipsis)
- **output_difference() (L1717-1761)**: Generates diff reports using difflib

## Utility Functions

- **_extract_future_flags() (L183-193)**: Extracts __future__ import compiler flags
- **_normalize_module() (L195-218)**: Resolves module from string/object/None
- **_load_testfile() (L224-240)**: Loads test files with proper encoding handling
- **_module_relative_path() (L397-429)**: Resolves module-relative file paths

## High-Level APIs

### Direct Testing
- **testmod() (L913-2015)**: Tests all doctests in a module
- **testfile() (L2017-2138)**: Tests doctests in external files  
- **run_docstring_examples() (L2140-2161)**: Tests single object's docstring

### unittest Integration
- **DocTestSuite() (L2391-2453)**: Converts doctests to unittest.TestSuite
- **DocFileSuite() (L2494-2561)**: Creates test suite from doctest files
- **DocTestCase (L2205-2366)**: unittest.TestCase wrapper for DocTest objects

### Debugging Support
- **DebugRunner (L1801-1902)**: Raises exceptions on failures instead of reporting
- **script_from_examples() (L2567-2647)**: Converts doctest to executable Python script
- **debug() (L2690-2699)**: Interactive debugging of specific doctest

## Error Handling
- **DocTestFailure (L1763-1780)**: Exception for test output mismatches
- **UnexpectedException (L1782-1799)**: Exception for unexpected runtime errors
- **_OutputRedirectingPdb (L360-394)**: Custom debugger with stdout redirection

## Special Features
- **_SpoofOut (L262-274)**: StringIO subclass ensuring trailing newlines
- Global **master** runner instance (L1911) for result aggregation
- Command-line interface via **_test() (L2799-2841)** with argparse
- **__test__** dictionary support for additional test discovery (L2748-2796)

The module handles various edge cases including syntax errors, module loading via PEP 302 loaders, interactive sessions, and cross-platform path resolution.