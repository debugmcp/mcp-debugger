# packages/adapter-rust/vendor/codelldb/win32-x64/lldb/lib/doctest.py
@source-hash: 8fb954ef7e775270
@generated: 2026-02-09T18:13:27Z

## Python Doctest Framework Module

**Primary Purpose**: Core implementation of Python's doctest framework for extracting and running tests embedded in docstrings and text files. This is the standard library's doctest.py module vendored in an LLDB adapter package.

### Core Data Structures

- **Example (L443-509)**: Represents a single doctest example with source code, expected output, line number, indentation, and options
- **DocTest (L511-582)**: Collection of Example objects with metadata (name, filename, lineno, docstring, globals)
- **TestResults (L108)**: Named tuple for (failed, attempted) test counts

### Key Processing Classes

- **DocTestParser (L588-817)**: Extracts doctest examples from strings using regex patterns
  - `_EXAMPLE_RE` (L597): Main regex for finding doctest examples (>>> prompts)
  - `_EXCEPTION_RE` (L619): Regex for parsing expected exceptions
  - `parse()` (L636): Converts string to alternating Examples and text
  - `get_doctest()` (L675): Creates DocTest from string
  
- **DocTestFinder (L823-1154)**: Discovers DocTest objects in modules/objects
  - `find()` (L854): Main entry point for extracting doctests
  - `_find()` (L996): Recursive search through object hierarchies
  - `_get_test()` (L1057): Creates DocTest for individual objects

- **DocTestRunner (L1160-1615)**: Executes DocTest cases and reports results
  - `run()` (L1474): Main execution method with stdout redirection
  - `__run()` (L1311): Internal runner with example-by-example execution
  - `report_*` methods (L1256-1305): Various reporting strategies
  - `summarize()` (L1547): Aggregate results display

- **OutputChecker (L1617-1761)**: Compares expected vs actual output
  - `check_output()` (L1631): Main comparison logic with option flag support
  - `output_difference()` (L1717): Generates diff reports

### Option Flags System

Option flags control test behavior and reporting (L131-160):
- **Comparison flags**: `DONT_ACCEPT_TRUE_FOR_1`, `NORMALIZE_WHITESPACE`, `ELLIPSIS`, `SKIP`, `IGNORE_EXCEPTION_DETAIL`
- **Reporting flags**: `REPORT_UDIFF`, `REPORT_CDIFF`, `REPORT_NDIFF`, `REPORT_ONLY_FIRST_FAILURE`, `FAIL_FAST`
- `register_optionflag()` (L132): Dynamic flag registration

### Public API Functions

- **testmod()** (L913-2015): Test all doctests in a module
- **testfile()** (L2017-2138): Test doctests in external files  
- **run_docstring_examples()** (L2140-2161): Run tests from single docstring

### Unittest Integration

- **DocTestCase (L2205-2367)**: Wraps DocTest as unittest.TestCase
- **DocTestSuite()** (L2391-2453): Converts module doctests to test suite
- **DocFileSuite()** (L2494-2561): Creates suite from doctest files

### Debugging Support

- **DebugRunner (L1801-1902)**: Raises exceptions instead of reporting failures
- **DocTestFailure/UnexpectedException (L1763-1799)**: Exception classes for debugging
- **debug functions** (L2690-2699): Interactive debugging utilities
- **_OutputRedirectingPdb (L360-394)**: Custom debugger with output redirection

### Utility Functions

- `_extract_future_flags()` (L183): Extract __future__ compiler flags
- `_normalize_module()` (L195): Resolve module from string/None/module
- `_ellipsis_match()` (L277): Pattern matching with "..." wildcards
- `_load_testfile()` (L224): Load test files with encoding support

### Architecture Notes

The framework follows a pipeline: **DocTestFinder** → **DocTest** objects → **DocTestRunner** → results. Output comparison is handled by **OutputChecker** with extensive option flag customization. The design supports both standalone usage and unittest framework integration.

### Global State

- `master` (L1911): Global DocTestRunner instance for backward compatibility
- `_unittest_reportflags` (L2167): Global unittest integration flags